import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireQueryRole
} from "../authz";
import {
  addProjectEvent,
  closeOpenProjectTasks,
  hasProjectEvent,
  latestAcceptedQuoteForProject,
  toSupplierOrder,
  toSupplierOrderLine
} from "../portalUtils";

const NO_SUPPLIER_KEY = "__none__";

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function ensureNotFieldMode(workspaceMode: string) {
  // Buitendienst-werkplek (field) krijgt geen inkoopfinanciën: de veld-UI stript
  // bedragen bewust (fieldService), maar zonder deze server-side grens kon een
  // monteur de inkoopprijzen via een directe API-aanroep alsnog opvragen.
  if (workspaceMode === "field") {
    throw new ConvexError("Leveranciersbestellingen zijn niet beschikbaar in de buitendienst-werkplek.");
  }
}

/**
 * Kiest de inkoopprijs uit de productPrices: voorkeur net_purchase boven purchase,
 * daarna de nieuwste geldige. Nooit klant-/adviesprijzen — die zijn bewust gescheiden.
 */
export function selectPurchasePrice(
  prices: Doc<"productPrices">[],
  now: number
): { bedrag?: number; bron: "net_purchase" | "purchase" | "none" } {
  const candidates = prices.filter(
    (price) =>
      (price.prijsSoort === "net_purchase" || price.prijsSoort === "purchase") &&
      // Een 0/negatieve inkoopprijs telt als afwezig (anders valt 'm bron != "none"
      // en verdwijnt de "regels zonder inkoopprijs"-waarschuwing stil).
      Number.isFinite(price.bedrag) &&
      price.bedrag > 0 &&
      (price.geldigVanaf ?? 0) <= now &&
      (price.geldigTot ?? Number.POSITIVE_INFINITY) >= now
  );
  const rank = (price: Doc<"productPrices">) => (price.prijsSoort === "net_purchase" ? 0 : 1);
  const best = candidates.sort((left, right) => {
    if (rank(left) !== rank(right)) {
      return rank(left) - rank(right);
    }
    return (right.geldigVanaf ?? right._creationTime) - (left.geldigVanaf ?? left._creationTime);
  })[0];

  return best
    ? { bedrag: best.bedrag, bron: best.prijsSoort as "net_purchase" | "purchase" }
    : { bron: "none" };
}

/**
 * Genereert leveranciersbestellingen uit de laatst geaccepteerde offerte van een project.
 * Productregels worden per leverancier gegroepeerd; per leverancier ontstaat één draft-order.
 * Idempotent: bestaande draft-orders van dezelfde offerte worden vervangen; reeds geplaatste
 * (niet-draft) orders blijven staan en hun leverancier wordt overgeslagen.
 */
export const generateSupplierOrdersFromQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    const quote = await latestAcceptedQuoteForProject(ctx, tenant._id, project._id);

    if (!quote) {
      throw new ConvexError("Accepteer eerst een offerte voordat je bestellingen genereert.");
    }

    // Bestaande orders van deze offerte: drafts vervangen, geplaatste leveranciers overslaan.
    const existingOrders = (
      await ctx.db
        .query("supplierOrders")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect()
    ).filter((order: Doc<"supplierOrders">) => order.quoteId === quote._id);

    const placedSupplierKeys = new Set<string>();

    for (const order of existingOrders) {
      if (order.status === "draft") {
        const lines = await ctx.db
          .query("supplierOrderLines")
          .withIndex("by_order", (q: any) =>
            q.eq("tenantId", tenant._id).eq("bestellingId", order._id)
          )
          .collect();
        for (const line of lines) {
          await ctx.db.delete(line._id);
        }
        await ctx.db.delete(order._id);
      } else {
        placedSupplierKeys.add(order.leverancierId ? String(order.leverancierId) : NO_SUPPLIER_KEY);
      }
    }

    const quoteLines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q: any) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
      .collect();

    const productLines = quoteLines.filter(
      (line: Doc<"quoteLines">) => line.regelType === "product" && line.productId
    );
    const nonProductCount = quoteLines.length - productLines.length;

    type Bucket = {
      leverancierId?: Id<"suppliers">;
      lines: Array<{ qLine: Doc<"quoteLines">; product: Doc<"products"> }>;
    };
    const buckets = new Map<string, Bucket>();
    let missingSupplierCount = 0;

    for (const qLine of productLines) {
      const product = await ctx.db.get(qLine.productId as Id<"products">);

      if (!product || product.tenantId !== tenant._id) {
        continue;
      }

      const key = product.leverancierId ? String(product.leverancierId) : NO_SUPPLIER_KEY;

      if (!product.leverancierId) {
        missingSupplierCount++;
      }

      if (!buckets.has(key)) {
        buckets.set(key, { leverancierId: product.leverancierId, lines: [] });
      }
      buckets.get(key)!.lines.push({ qLine, product });
    }

    const now = Date.now();
    let created = 0;
    let skipped = 0;
    let missingPriceCount = 0;

    for (const [key, bucket] of buckets) {
      if (placedSupplierKeys.has(key)) {
        skipped++;
        continue;
      }

      const orderId = await ctx.db.insert("supplierOrders", {
        tenantId: tenant._id,
        projectId: project._id,
        quoteId: quote._id,
        leverancierId: bucket.leverancierId,
        status: "draft",
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      let sortOrder = 0;
      for (const { qLine, product } of bucket.lines) {
        const prices = await ctx.db
          .query("productPrices")
          .withIndex("by_product", (q: any) =>
            q.eq("tenantId", tenant._id).eq("productId", product._id)
          )
          .collect();
        const purchase = selectPurchasePrice(prices, now);

        if (purchase.bron === "none") {
          missingPriceCount++;
        }

        const regelTotaal =
          purchase.bedrag !== undefined ? roundCents(qLine.aantal * purchase.bedrag) : undefined;

        await ctx.db.insert("supplierOrderLines", {
          tenantId: tenant._id,
          bestellingId: orderId,
          productId: product._id,
          quoteLineId: qLine._id,
          projectRuimteId: qLine.projectRuimteId,
          omschrijving: qLine.titel,
          // V2-producten dragen hun bestelcode in sku; zonder terugval zou de
          // bestelregel naar de leverancier géén artikelnummer hebben.
          artikelnummer: product.artikelnummer ?? product.sku,
          leverancierCode: product.leverancierCode,
          aantal: qLine.aantal,
          eenheid: qLine.eenheid,
          inkoopPrijsExBtw: purchase.bedrag,
          inkoopPrijsBron: purchase.bron,
          regelTotaalExBtw: regelTotaal,
          status: "ordered",
          sortOrder: sortOrder++,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }

      created++;
    }

    const warnings: string[] = [];
    if (nonProductCount > 0) {
      warnings.push(
        `${nonProductCount} niet-product-regel(s) overgeslagen (alleen catalogusproducten worden besteld).`
      );
    }
    if (missingSupplierCount > 0) {
      warnings.push(
        `${missingSupplierCount} regel(s) zonder leverancier — verzameld onder "Leverancier onbekend".`
      );
    }
    if (missingPriceCount > 0) {
      // Regels zijn (nog) niet los te bewerken; wijs dus naar de routes die wél bestaan.
      warnings.push(
        `${missingPriceCount} regel(s) zonder inkoopprijs — voeg de inkoopprijs toe in de catalogus en genereer opnieuw (concept-bestellingen worden vervangen), of noteer de prijs op de bestelbon.`
      );
    }
    if (skipped > 0) {
      warnings.push(`${skipped} leverancier(s) met een reeds geplaatste bestelling overgeslagen.`);
    }

    // Koppel het bestellen aan de dossier-workflow: het aanmaken van échte
    // bestellingen zette voorheen geen status en geen tijdlijn-event, terwijl de
    // losse tijdlijn-actie dat juist wél deed zonder bestelling — twee losgekoppelde
    // sporen. Status alleen vooruit vanuit 'quote_accepted' (geen regressie op
    // dossiers die al verder zijn), event met dedup zodat hergenereren en de
    // tijdlijn-actie samen geen dubbele events opleveren.
    if (created > 0) {
      const workflowNow = Date.now();
      if (project.status === "quote_accepted") {
        await ctx.db.patch(project._id, {
          status: "ordering",
          besteldOp: project.besteldOp ?? workflowNow,
          gewijzigdOp: workflowNow
        });
      }
      const alreadyLogged = await hasProjectEvent(
        ctx,
        tenant._id,
        project._id,
        "supplier_order_created"
      );
      if (!alreadyLogged) {
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "supplier_order_created",
          "Bestelling aangemaakt",
          externalUserId,
          `${created} leveranciersbestelling(en) gegenereerd uit offerte ${quote.offertenummer}.`
        );
      }
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "execution_call", "done");
    }

    return { created, skipped, warnings };
  }
});

export const listSupplierOrders = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant, workspaceMode } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      return [];
    }

    const orders = await ctx.db
      .query("supplierOrders")
      .withIndex("by_project", (q: any) =>
        q.eq("tenantId", tenant._id).eq("projectId", project._id)
      )
      .order("desc")
      .collect();

    return await Promise.all(
      orders.map(async (order: Doc<"supplierOrders">) => {
        const lines = await ctx.db
          .query("supplierOrderLines")
          .withIndex("by_order", (q: any) =>
            q.eq("tenantId", tenant._id).eq("bestellingId", order._id)
          )
          .collect();
        const totaal = lines.reduce(
          (sum: number, line: Doc<"supplierOrderLines">) => sum + (line.regelTotaalExBtw ?? 0),
          0
        );
        let leverancierNaam: string | undefined;
        if (order.leverancierId) {
          const supplier = await ctx.db.get(order.leverancierId);
          // Tenant-hercontrole na de cross-tabel-get: gebruik de naam alleen bij dezelfde tenant.
          leverancierNaam =
            supplier && supplier.tenantId === tenant._id ? supplier.naam : undefined;
        }
        return toSupplierOrder(tenant.slug, order, {
          leverancierNaam,
          regelAantal: lines.length,
          totaalInkoopExBtw: roundCents(totaal)
        });
      })
    );
  }
});

export const supplierOrderDetail = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    bestellingId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant, workspaceMode } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const order = await ctx.db.get(args.bestellingId as Id<"supplierOrders">);

    if (!order || order.tenantId !== tenant._id) {
      return null;
    }

    const lines = (
      await ctx.db
        .query("supplierOrderLines")
        .withIndex("by_order", (q: any) =>
          q.eq("tenantId", tenant._id).eq("bestellingId", order._id)
        )
        .collect()
    ).sort(
      (left: Doc<"supplierOrderLines">, right: Doc<"supplierOrderLines">) =>
        left.sortOrder - right.sortOrder
    );

    const totaal = lines.reduce(
      (sum: number, line: Doc<"supplierOrderLines">) => sum + (line.regelTotaalExBtw ?? 0),
      0
    );

    let leverancier: {
      naam: string;
      contactpersoon?: string;
      email?: string;
      telefoon?: string;
    } | null = null;
    if (order.leverancierId) {
      const supplier = await ctx.db.get(order.leverancierId);
      // Tenant-hercontrole: geen leveranciercontacten van een andere tenant lekken.
      leverancier =
        supplier && supplier.tenantId === tenant._id
          ? {
              naam: supplier.naam,
              contactpersoon: supplier.contactpersoon,
              email: supplier.email,
              telefoon: supplier.telefoon
            }
          : null;
    }

    const project = await ctx.db.get(order.projectId);
    const projectSameTenant = project && project.tenantId === tenant._id ? project : null;

    return {
      order: toSupplierOrder(tenant.slug, order, {
        leverancierNaam: leverancier?.naam,
        regelAantal: lines.length,
        totaalInkoopExBtw: roundCents(totaal)
      }),
      lines: lines.map(toSupplierOrderLine),
      leverancier,
      project: projectSameTenant
        ? { id: String(projectSameTenant._id), titel: projectSameTenant.titel }
        : null
    };
  }
});

export const updateSupplierOrderStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    bestellingId: v.string(),
    // Bewust beperkt: draft (genereren) en cancelled (cancelSupplierOrder, dat ook
    // de regelstatussen bijwerkt) lopen via eigen paden, niet via deze route.
    status: v.union(
      v.literal("ordered"),
      v.literal("confirmed"),
      v.literal("partially_received"),
      v.literal("received")
    ),
    verwachteLeverdatumOp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const order = await ctx.db.get(args.bestellingId as Id<"supplierOrders">);

    if (!order || order.tenantId !== tenant._id) {
      throw new ConvexError("Bestelling niet gevonden.");
    }

    // Overgangsguard: zonder deze checks kon een (door bv. een offerte-afwijzing)
    // geannuleerde bestelling bij gelijktijdig werken alsnog op "Ontvangen" worden
    // gezet — en telde dan weer mee als lopende inkoop.
    if (order.status === "cancelled") {
      throw new ConvexError(
        "Deze bestelling is geannuleerd en kan niet meer worden bijgewerkt. Genereer zo nodig een nieuwe bestelling."
      );
    }
    if (order.status === "received" && args.status !== "partially_received") {
      throw new ConvexError(
        "Deze bestelling is al volledig ontvangen. Zet 'm zo nodig terug naar 'Deels ontvangen' om een correctie te doen."
      );
    }

    const now = Date.now();
    const patch: Record<string, unknown> = { status: args.status, gewijzigdOp: now };

    if (args.verwachteLeverdatumOp !== undefined) {
      patch.verwachteLeverdatumOp = args.verwachteLeverdatumOp;
    }
    if (args.status === "ordered" && !order.besteldOp) {
      patch.besteldOp = now;
    }
    if (args.status === "received") {
      patch.ontvangenOp = now;
    }
    // Correctie terug vanuit 'Ontvangen': de ontvangst-datum hoort dan weer leeg.
    if (order.status === "received" && args.status === "partially_received") {
      patch.ontvangenOp = undefined;
    }

    await ctx.db.patch(order._id, patch);

    return order._id;
  }
});

export const cancelSupplierOrder = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    bestellingId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const order = await ctx.db.get(args.bestellingId as Id<"supplierOrders">);

    if (!order || order.tenantId !== tenant._id) {
      throw new ConvexError("Bestelling niet gevonden.");
    }

    const now = Date.now();
    await ctx.db.patch(order._id, { status: "cancelled", gewijzigdOp: now });

    const lines = await ctx.db
      .query("supplierOrderLines")
      .withIndex("by_order", (q: any) =>
        q.eq("tenantId", tenant._id).eq("bestellingId", order._id)
      )
      .collect();
    for (const line of lines) {
      if (line.status !== "received") {
        await ctx.db.patch(line._id, { status: "cancelled", gewijzigdOp: now });
      }
    }

    return order._id;
  }
});
