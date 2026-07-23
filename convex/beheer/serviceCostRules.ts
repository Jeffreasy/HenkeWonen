import { query } from "../_generated/server";
import { readActorValidator, requireQueryRoleForTenantId, requireQueryRole } from "../authz";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { GUIDED_STAIR_SERVICE_FAMILY, resolveStairServiceMetadata } from "../stairServiceProducts";

/**
 * Leesfallback voor reeds geïmporteerde omgevingen. Na een V2-herimport staat
 * dezelfde metadata in products.attributen.serviceMetadata; tot die tijd zorgt
 * de stabiele SKU ervoor dat de trapcomposer direct betrouwbaar kan filteren.
 */
async function getServiceRuleDocs(ctx: any, tenantId: string) {
  // Dienstsoort is de stabiele identiteit. De zichtbare leveranciersnaam mag
  // worden hernoemd en is daarom bewust geen functioneel filter meer.
  const serviceProducts = (await ctx.db
    .query("products")
    .withIndex("by_product_kind_status", (q: any) =>
      q.eq("tenantId", tenantId).eq("productAard", "service").eq("status", "active")
    )
    .collect()) as Doc<"products">[];

  const now = Date.now();
  const serviceRuleDocs = [];
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .collect();
  const categoryById = new Map<string, Doc<"categories">>(
    categories.map((category: Doc<"categories">) => [String(category._id), category])
  );

  // Haal voor elk actief dienstproduct de actuele prijs op en formatteer als ServiceRuleDoc.
  for (const product of serviceProducts) {
    const prices = await ctx.db
      .query("productPrices")
      .withIndex("by_product", (q: any) => q.eq("tenantId", tenantId).eq("productId", product._id))
      .collect();

    // Eigen diensten hebben klantzichtbare verkoopprijzen: de V2-import
    // schrijft die als prijsSoort "advice_retail" (er bestaat geen "sales").
    const validPrices = prices.filter(
      (p: any) =>
        (p.prijsSoort === "advice_retail" || p.prijsSoort === "retail") &&
        (p.btwModus === "exclusive" || p.btwModus === "inclusive")
    );

    // Valideer datum
    const currentPrices = validPrices.filter(
      (p: any) => (!p.geldigVanaf || p.geldigVanaf <= now) && (!p.geldigTot || p.geldigTot >= now)
    );

    if (currentPrices.length === 0) continue;

    // Deterministische keuze bij meerdere geldige rijen (bv. na een herimport):
    // zelfde tie-break als selectIndicativePrice — nieuwste geldigVanaf, dan
    // nieuwste wijziging, dan nieuwste rij. Anders kan de dienst-kiezer een
    // verouderde prijs tonen die als snapshot in offertes belandt.
    currentPrices.sort(
      (a: any, b: any) =>
        (b.geldigVanaf ?? 0) - (a.geldigVanaf ?? 0) ||
        (b.gewijzigdOp ?? 0) - (a.gewijzigdOp ?? 0) ||
        (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );

    const price = currentPrices[0];
    const serviceMetadata = resolveStairServiceMetadata(product);
    const productCategory = categoryById.get(String(product.categorieId));
    const parentCategory = productCategory?.bovenliggendeCategorieId
      ? categoryById.get(String(productCategory.bovenliggendeCategorieId))
      : undefined;
    const productGroup =
      productCategory?.productGroep ??
      parentCategory?.productGroep ??
      (serviceMetadata?.family === GUIDED_STAIR_SERVICE_FAMILY ? "stairs" : undefined);

    // prijsExBtw doorgeven; btwModus-literals zijn "inclusive"/"exclusive".
    const rawPrijsEx =
      price.btwModus === "inclusive" ? price.bedrag / (1 + price.btwTarief / 100) : price.bedrag;

    // Afronden op 2 decimalen (bijv. 37.19 in plaats van 37.190082644628095)
    // zodat de frontend input velden in de offertes netjes worden gevuld!
    const prijsExBtw = Math.round(rawPrijsEx * 100) / 100;

    // Rekentype uit de gestructureerde prijseenheid (V2: m2/m1/roll/piece/...),
    // met de oude vrije-tekst-herkenning als vangnet voor legacy data.
    const unit = (price.prijsEenheid ?? "").toLowerCase();
    let berekeningType = "manual";
    if (unit === "m2") berekeningType = "per_m2";
    else if (unit === "m1" || unit === "meter") berekeningType = "per_meter";
    else if (unit === "roll") berekeningType = "per_roll";
    else if (unit === "piece" || unit === "pack" || unit === "package") berekeningType = "fixed";
    else {
      const normalized = unit.replace(/[\s\-_]/g, "");
      if (/m2|m²|vierkantemeter/.test(normalized)) berekeningType = "per_m2";
      else if (/m1|meter|strekkendemeter/.test(normalized)) berekeningType = "per_meter";
      else if (/rol|rollen/.test(normalized)) berekeningType = "per_roll";
      else if (/trap|trappen/.test(normalized)) berekeningType = "per_staircase";
      else if (/zijde|zijden|kant|kanten/.test(normalized)) berekeningType = "per_side";
      else if (/vast|stuk|piece|stuks/.test(normalized)) berekeningType = "fixed";
    }

    serviceRuleDocs.push({
      _id: String(product._id),
      id: String(product._id),
      productId: String(product._id),
      tenantId: product.tenantId, // For portal variant if needed
      naam: product.naam,
      // Toon de leesbare eenheid ("per m²", "Vast") als er geen omschrijving is.
      omschrijving: product.omschrijving || product.attributen?.price_unit_raw,
      sku: product.sku,
      category: parentCategory?.naam ?? productCategory?.naam,
      subcategory: parentCategory ? productCategory?.naam : undefined,
      prijsEenheid: price.prijsEenheid,
      priceUnit: price.prijsEenheid,
      verkoopEenheid: product.verkoopEenheid ?? product.eenheid,
      eenheid: product.eenheid,
      productGroup,
      serviceMetadata,
      serviceFamily: serviceMetadata?.family,
      covering: serviceMetadata?.covering,
      stairShape: serviceMetadata?.shape,
      serviceRole: serviceMetadata?.role,
      sectionKey: serviceMetadata?.sectionKey,
      berekeningType,
      prijsExBtw,
      btwTarief: price.btwTarief,
      status: product.status
    });
  }

  // Sort them alphabetically by name
  serviceRuleDocs.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return serviceRuleDocs;
}

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    // Lezen mag door iedereen die mag inmeten/offreren (user/editor/admin).
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["user", "editor", "admin"]);
    return await getServiceRuleDocs(ctx, args.tenantId);
  }
});

export const listServiceRules = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const docs = await getServiceRuleDocs(ctx, tenant._id);

    // De oude listServiceRules gaf een net iets andere vorm terug voor de settings tabel.
    return docs.map((doc) => ({
      id: doc.id,
      productId: doc.productId,
      tenantId: args.tenantSlug,
      name: doc.naam,
      description: doc.omschrijving,
      sku: doc.sku,
      category: doc.category,
      subcategory: doc.subcategory,
      priceUnit: doc.priceUnit,
      productGroup: doc.productGroup,
      serviceMetadata: doc.serviceMetadata,
      serviceFamily: doc.serviceFamily,
      covering: doc.covering,
      stairShape: doc.stairShape,
      serviceRole: doc.serviceRole,
      sectionKey: doc.sectionKey,
      calculationType: doc.berekeningType,
      priceExVat: doc.prijsExBtw,
      vatRate: doc.btwTarief,
      status: doc.status
    }));
  }
});
