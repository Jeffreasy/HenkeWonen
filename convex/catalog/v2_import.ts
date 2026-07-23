import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole } from "../authz";
import type { Id } from "../_generated/dataModel";
import { resolveStairMaterialMetadata } from "../../src/lib/quotes/stairMaterialCatalog";
import { STAIR_SERVICE_METADATA_BY_SKU, type StairServiceMetadata } from "../stairServiceProducts";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll("_", "-")
    .replaceAll(".", "")
    .replaceAll(",", "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function findV2Supplier(ctx: any, tenantId: Id<"tenants">, sourceName: string) {
  const importSleutel = `v2:${slugify(sourceName)}`;
  const byImportKey = await ctx.db
    .query("suppliers")
    .withIndex("by_import_key", (q: any) =>
      q.eq("tenantId", tenantId).eq("importSleutel", importSleutel)
    )
    .first();
  if (byImportKey) return byImportKey;

  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("naam"), sourceName))
    .first();
}

export const clearCatalogProducts = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;

    // Alleen producten en productPrices verwijderen om categorie-instellingen te behouden
    const prices = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .take(250);

    for (const p of prices) {
      await ctx.db.delete(p._id);
    }

    let products = [];
    if (prices.length < 250) {
      products = await ctx.db
        .query("products")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .take(250);

      for (const p of products) {
        await ctx.db.delete(p._id);
      }
    }

    return {
      deletedPrices: prices.length,
      deletedProducts: products.length,
      morePrices: prices.length === 250,
      moreProducts: products.length === 250
    };
  }
});

export const clearCatalogDataIssues = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;

    const issues = await ctx.db
      .query("catalogDataIssues")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .take(250);

    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }

    return { deleted: issues.length };
  }
});

export const clearOldImportData = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;
    let deleted = 0;
    let moreRows = false;

    // First clear productImportRows by looping over batches
    const batchesForRows = await ctx.db
      .query("productImportBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();

    for (const batch of batchesForRows) {
      const rows = await ctx.db
        .query("productImportRows")
        .withIndex("by_batch", (q: any) => q.eq("tenantId", tenantId).eq("batchId", batch._id))
        .take(100);

      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }

      if (rows.length === 100) {
        moreRows = true;
        break; // Stop and let next chunk handle it
      }
    }

    if (moreRows) {
      return { deleted, moreRows: true };
    }

    // If we've deleted all rows, we can now safely delete the batches and profiles
    const batches = await ctx.db
      .query("productImportBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();
    for (const b of batches) {
      await ctx.db.delete(b._id);
      deleted++;
    }

    const priceLists = await ctx.db
      .query("priceLists")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();
    for (const pl of priceLists) {
      await ctx.db.delete(pl._id);
      deleted++;
    }

    const profiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();
    for (const p of profiles) {
      await ctx.db.delete(p._id);
      deleted++;
    }

    return { deleted, moreRows: false };
  }
});

export const fixSupplierBatches = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string(),
    counts: v.array(
      v.object({
        supplier: v.string(),
        productCount: v.number(),
        priceCount: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;
    const now = Date.now();

    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();

    let fixed = 0;
    for (const supplier of suppliers) {
      const countData = args.counts.find(
        (c: any) =>
          supplier.importSleutel === `v2:${slugify(c.supplier)}` || c.supplier === supplier.naam
      );
      if (!countData) continue; // Skip suppliers that weren't in this import run

      const existingV2Batch = await ctx.db
        .query("productImportBatches")
        .withIndex("by_supplier", (q: any) =>
          q.eq("tenantId", tenantId).eq("leverancierId", supplier._id)
        )
        .filter((q: any) => q.eq(q.field("bestandsnaam"), "V2_Direct_Import"))
        .first();

      if (!existingV2Batch) {
        await ctx.db.insert("productImportBatches", {
          tenantId,
          leverancierId: supplier._id,
          bestandsnaam: "V2_Direct_Import",
          bestandsType: "jsonl",
          status: "imported",
          vastgelegdOp: now,
          geimporteerdOp: now,
          aangemaaktOp: now,
          gewijzigdOp: now,
          foutRijen: 0,
          geldigeRijen: countData.productCount,
          totaalRijen: countData.productCount,
          waarschuwingRijen: 0,
          productRijen: countData.productCount,
          geimporteerdePrijzen: countData.priceCount,
          onbekendeBtwModusRijen: 0 // V2 data already has correct VAT
        });
      } else {
        await ctx.db.patch(existingV2Batch._id, {
          vastgelegdOp: now,
          geimporteerdOp: now,
          gewijzigdOp: now,
          geldigeRijen: countData.productCount,
          totaalRijen: countData.productCount,
          productRijen: countData.productCount,
          geimporteerdePrijzen: countData.priceCount,
          onbekendeBtwModusRijen: 0
        });
      }

      await ctx.db.patch(supplier._id, {
        gewijzigdOp: now,
        laatsteContactOp: now
      });

      fixed++;
    }
    return { fixed };
  }
});

export const syncSupplierStatuses = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;
    const now = Date.now();

    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();

    let updated = 0;
    for (const supplier of suppliers) {
      const hasProducts = await ctx.db
        .query("products")
        .withIndex("by_supplier_status", (q: any) =>
          q.eq("tenantId", tenantId).eq("leverancierId", supplier._id).eq("status", "active")
        )
        .first();

      // Alleen opwaarderen naar "received" bij daadwerkelijke producten.
      // Leveranciers zonder producten blijven ongemoeid: hun prijslijstStatus
      // ("requested" e.d.) is opvolgadministratie die een import niet mag wissen.
      if (hasProducts && supplier.prijslijstStatus !== "received") {
        await ctx.db.patch(supplier._id, {
          prijslijstStatus: "received",
          gewijzigdOp: now
        });
        updated++;
      }
    }
    return { updated };
  }
});

export const cleanLegacySuppliers = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;

    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();

    let deletedCount = 0;
    for (const supplier of suppliers) {
      const hasProducts = await ctx.db
        .query("products")
        .withIndex("by_supplier_status", (q: any) =>
          q.eq("tenantId", tenantId).eq("leverancierId", supplier._id).eq("status", "active")
        )
        .first();

      if (!hasProducts) {
        // Find and delete any batches associated
        const batches = await ctx.db
          .query("productImportBatches")
          .withIndex("by_supplier", (q: any) =>
            q.eq("tenantId", tenantId).eq("leverancierId", supplier._id)
          )
          .collect();
        for (const b of batches) await ctx.db.delete(b._id);

        // Find and delete any priceLists
        const priceLists = await ctx.db
          .query("priceLists")
          .withIndex("by_supplier", (q: any) =>
            q.eq("tenantId", tenantId).eq("leverancierId", supplier._id)
          )
          .collect();
        for (const pl of priceLists) await ctx.db.delete(pl._id);

        // Find and delete any importProfiles
        const profiles = await ctx.db
          .query("importProfiles")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
          .collect();
        for (const p of profiles) {
          if (p.leverancierId === supplier._id) {
            await ctx.db.delete(p._id);
          }
        }

        await ctx.db.delete(supplier._id);
        deletedCount++;
      }
    }
    return { deletedCount };
  }
});

/**
 * Werksoort (productGroep) per V2-subcategorie, zodat de productkiezer-tabs en
 * het categorie-menu de nieuwe categorieën direct goed groeperen. Beheer kan
 * dit daarna nog aanpassen via /instellingen/categorieen; een bestaande,
 * handmatig gezette waarde wordt hier bewust NIET overschreven.
 */
const V2_CATEGORY_GROUPS: Record<string, string> = {
  PVC: "flooring",
  Tapijt: "flooring",
  Vinyl: "flooring",
  "Tapijt & Vinyl": "flooring",
  Karpetten: "flooring",
  Plinten: "plinths",
  Traprenovatie: "stairs",
  "Traprenovatie (arbeid)": "stairs",
  Gordijnen: "curtains",
  Gordijnstoffen: "curtains",
  Rolgordijnen: "curtains",
  Jaloezieën: "curtains",
  Behang: "wallpaper",
  "Akoestische Panelen": "wall_panels",
  Badkamer: "wall_panels"
};

async function ensureCategory(
  ctx: any,
  tenantId: Id<"tenants">,
  name: string,
  parentId?: Id<"categories">
) {
  const now = Date.now();
  const slug = slugify(name);
  const productGroep = V2_CATEGORY_GROUPS[name];
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_slug", (q: any) => q.eq("tenantId", tenantId).eq("slug", slug))
    .first();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (parentId && existing.bovenliggendeCategorieId !== parentId) {
      patch.bovenliggendeCategorieId = parentId;
    }
    if (productGroep && existing.productGroep === undefined) {
      patch.productGroep = productGroep;
    }
    if (Object.keys(patch).length > 0) {
      patch.gewijzigdOp = now;
      await ctx.db.patch(existing._id, patch);
    }
    return existing._id;
  }

  return await ctx.db.insert("categories", {
    tenantId,
    naam: name,
    slug,
    bovenliggendeCategorieId: parentId,
    productGroep,
    sortOrder: 999,
    status: "active",
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function ensureSupplier(
  ctx: any,
  tenantId: Id<"tenants">,
  name: string
): Promise<{ id: Id<"suppliers">; verkoopBtwModus?: "exclusive" | "inclusive" }> {
  const now = Date.now();
  const importSleutel = `v2:${slugify(name)}`;
  const existing = await findV2Supplier(ctx, tenantId, name);

  if (existing) {
    // Een leverancier waarvoor we zojuist producten importeren mag niet
    // gearchiveerd/inactief blijven staan (bv. Moduleo stond nog op
    // "archived" van vóór de V2-migratie).
    if (
      existing.status === "archived" ||
      existing.status === "inactive" ||
      existing.importSleutel !== importSleutel
    ) {
      await ctx.db.patch(existing._id, {
        importSleutel,
        ...(existing.status === "archived" || existing.status === "inactive"
          ? { status: "active" as const }
          : {}),
        gewijzigdOp: now
      });
    }
    return { id: existing._id, verkoopBtwModus: existing.verkoopBtwModus };
  }

  const id = await ctx.db.insert("suppliers", {
    tenantId,
    naam: name,
    prijslijstStatus: "received",
    aangemaaktOp: now,
    importSleutel,
    gewijzigdOp: now
  });
  return { id };
}

/**
 * Eenheden die de V2-pipeline aanlevert. Alles daarbuiten valt terug op
 * "piece" zodat een pipeline-uitbreiding nooit de import laat klappen.
 */
const V2_UNITS = new Set(["m2", "m1", "pack", "piece", "roll", "step"]);

function v2Unit(raw: string): "m2" | "m1" | "pack" | "piece" | "roll" | "step" {
  return (V2_UNITS.has(raw) ? raw : "piece") as "m2" | "m1" | "pack" | "piece" | "roll" | "step";
}

type V2ServiceMetadataInput = {
  family?: string;
  covering?: string;
  shape?: string;
  role?: string;
  sectionKey?: string;
  section_key?: string;
};

/**
 * Stabiele fallback voor de huidige V2-werkzaamhedenbron, die nog geen
 * service_metadata bevat. De SKU is de catalogusidentiteit; productnamen zijn
 * uitsluitend presentatie en worden bewust nooit voor businesslogica geparsed.
 */
function nonEmptyText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Bronmetadata is leidend en wordt veld voor veld aangevuld met de SKU-fallback.
 * Voor een nieuwe/onbekende SKU moet de bron minimaal family, role en sectionKey
 * aanleveren; een onvolledig object wordt niet als bruikbare metadata opgeslagen.
 */
function resolveV2ServiceMetadata(
  supplierName: string,
  sku: string,
  source?: V2ServiceMetadataInput
): StairServiceMetadata | undefined {
  const fallback =
    supplierName.trim().toLocaleLowerCase("nl") === "henke wonen diensten"
      ? STAIR_SERVICE_METADATA_BY_SKU[sku.trim().toUpperCase()]
      : undefined;
  const family = nonEmptyText(source?.family) ?? fallback?.family;
  const role = nonEmptyText(source?.role) ?? fallback?.role;
  const sectionKey =
    nonEmptyText(source?.sectionKey) ?? nonEmptyText(source?.section_key) ?? fallback?.sectionKey;

  if (!family || !role || !sectionKey) {
    return undefined;
  }

  const covering = nonEmptyText(source?.covering) ?? fallback?.covering;
  const shape = nonEmptyText(source?.shape) ?? fallback?.shape;

  return {
    family,
    ...(covering ? { covering } : {}),
    ...(shape ? { shape } : {}),
    role,
    sectionKey
  };
}

export const importChunk = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string(),
    rows: v.array(
      v.object({
        supplier: v.string(),
        main_category: v.string(),
        sub_category: v.string(),
        product_type: v.string(),
        product_name: v.string(),
        // Toelichting bij het product; voor diensten de tekst die de
        // werkzaamheid-kiezer als regelomschrijving voorstelt.
        description: v.optional(v.string()),
        sku: v.string(),
        ean: v.optional(v.string()),
        purchase_price_excl: v.optional(v.number()),
        purchase_condition: v.optional(v.string()),
        // Tweede inkoopconditie (bv. Floorlife: twee prijslijsten met
        // verschillende commissieprijzen) — wordt een tweede net_purchase-rij.
        purchase_price_excl_b: v.optional(v.number()),
        purchase_condition_b: v.optional(v.string()),
        sales_price: v.optional(v.number()),
        sales_vat_mode: v.union(v.literal("exclusive"), v.literal("inclusive")),
        vat_rate: v.number(),
        price_unit: v.string(),
        unit: v.string(),
        pack_content_m2: v.optional(v.number()),
        width_cm: v.optional(v.number()),
        // Optionele, bron-gestuurde classificatie voor dienstproducten. Het
        // genormaliseerde object wordt opgeslagen onder attributen.serviceMetadata.
        // section_key wordt naast sectionKey geaccepteerd voor Python/JSONL-bronnen.
        service_metadata: v.optional(
          v.object({
            family: v.optional(v.string()),
            covering: v.optional(v.string()),
            shape: v.optional(v.string()),
            role: v.optional(v.string()),
            sectionKey: v.optional(v.string()),
            section_key: v.optional(v.string())
          })
        ),
        // Product-BOM metadata voor traprenovatie. De huidige Floorlife-SKU's
        // krijgen daarnaast een stabiele fallback, zodat bestaande JSONL direct werkt.
        stair_material_metadata: v.optional(
          v.object({
            family: v.optional(v.string()),
            covering: v.optional(v.string()),
            componentRole: v.optional(v.string()),
            component_role: v.optional(v.string()),
            isPrimary: v.optional(v.boolean()),
            is_primary: v.optional(v.boolean()),
            piecesPerPack: v.optional(v.number()),
            pieces_per_pack: v.optional(v.number()),
            orderUnit: v.optional(v.string()),
            order_unit: v.optional(v.string()),
            lengthMPerUnit: v.optional(v.number()),
            length_m_per_unit: v.optional(v.number())
          })
        )
      })
    )
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const row of args.rows) {
      const supplier = await ensureSupplier(ctx, tenantId, row.supplier);
      const supplierId = supplier.id;
      const mainCatId = await ensureCategory(ctx, tenantId, row.main_category);
      const subCatId = await ensureCategory(ctx, tenantId, row.sub_category, mainCatId);
      const unit = v2Unit(row.unit);
      const serviceMetadata = resolveV2ServiceMetadata(row.supplier, row.sku, row.service_metadata);
      const stairMaterialMetadata =
        row.stair_material_metadata ||
        row.main_category.trim().toLocaleLowerCase("nl") === "trappen"
          ? resolveStairMaterialMetadata({ sku: row.sku }, row.stair_material_metadata)
          : undefined;

      // Upsert op leverancier+sku: productId's blijven stabiel over
      // prijslijst-updates heen, zodat offerteregels en bestellingen die naar
      // een product verwijzen niet breken bij een her-import.
      const existing = await ctx.db
        .query("products")
        .withIndex("by_supplier_sku", (q: any) =>
          q.eq("tenantId", tenantId).eq("leverancierId", supplierId).eq("sku", row.sku)
        )
        .first();

      const fields = {
        categorieId: subCatId,
        leverancierId: supplierId,
        naam: row.product_name,
        omschrijving: row.description,
        sku: row.sku,
        ean: row.ean,
        productAard: (row.main_category === "Werkzaamheden" ? "service" : "standard") as
          | "service"
          | "standard",
        eenheid: unit,
        pakinhoudM2: row.pack_content_m2,
        stuksPerPak: stairMaterialMetadata?.piecesPerPack,
        verkoopEenheid: unit,
        inkoopEenheid: unit,
        bestelEenheid: stairMaterialMetadata?.orderUnit ?? unit,
        bestelVeelvoud: stairMaterialMetadata?.orderUnit ? 1 : undefined,
        breedteMm: row.width_cm !== undefined ? Math.round(row.width_cm * 10) : undefined,
        status: "active" as const,
        gewijzigdOp: now,
        attributen: {
          product_type: row.product_type,
          price_unit_raw: row.price_unit,
          ...(serviceMetadata ? { serviceMetadata } : {}),
          ...(stairMaterialMetadata ? { stairMaterialMetadata } : {})
        }
      };

      let productId: Id<"products">;
      if (existing) {
        productId = existing._id;
        await ctx.db.patch(productId, fields);
        // Prijzen volledig vervangen: de prijslijst is de waarheid.
        const oldPrices = await ctx.db
          .query("productPrices")
          .withIndex("by_product", (q: any) =>
            q.eq("tenantId", tenantId).eq("productId", productId)
          )
          .collect();
        for (const price of oldPrices) {
          await ctx.db.delete(price._id);
        }
        updated++;
      } else {
        productId = await ctx.db.insert("products", {
          tenantId,
          aangemaaktOp: now,
          ...fields
        });
        inserted++;
      }

      const insertPurchase = async (bedrag: number, conditie?: string) => {
        await ctx.db.insert("productPrices", {
          tenantId,
          productId,
          prijsSoort: "net_purchase",
          prijsEenheid: unit,
          bedrag,
          btwTarief: row.vat_rate,
          btwModus: "exclusive",
          currency: "EUR",
          bronKolomNaam: conditie,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      };

      if (row.purchase_price_excl !== undefined && row.purchase_price_excl > 0) {
        await insertPurchase(row.purchase_price_excl, row.purchase_condition);
      }
      if (row.purchase_price_excl_b !== undefined && row.purchase_price_excl_b > 0) {
        await insertPurchase(row.purchase_price_excl_b, row.purchase_condition_b);
      }

      if (row.sales_price !== undefined && row.sales_price > 0) {
        await ctx.db.insert("productPrices", {
          tenantId,
          productId,
          prijsSoort: "advice_retail",
          prijsEenheid: unit,
          bedrag: row.sales_price,
          btwTarief: row.vat_rate,
          // Portaal-instelling op de leverancier is leidend; de JSONL-waarde
          // (vat_config.json) is alleen de default zolang er niets is ingesteld.
          btwModus: supplier.verkoopBtwModus ?? row.sales_vat_mode,
          currency: "EUR",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    return { inserted, updated };
  }
});

/**
 * Naloop van een upsert-import: producten van een leverancier die deze run
 * niet zijn aangeraakt (gewijzigdOp < runStartMs) staan niet meer op de
 * prijslijst. Ze worden GEARCHIVEERD, niet verwijderd: offerteregels en
 * bestellingen die ernaar verwijzen blijven werken, maar picker/catalogus
 * (status "active") tonen ze niet meer.
 */
export const archiveVanishedProducts = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string(),
    supplierName: v.string(),
    runStartMs: v.number(),
    cursor: v.optional(v.union(v.string(), v.null()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const tenantId = tenant._id;
    const now = Date.now();

    const supplier = await findV2Supplier(ctx, tenantId, args.supplierName);
    if (!supplier) {
      return { supplierFound: false, archived: 0, isDone: true, continueCursor: null };
    }

    const paginated = await ctx.db
      .query("products")
      .withIndex("by_supplier_status", (q: any) =>
        q.eq("tenantId", tenantId).eq("leverancierId", supplier._id).eq("status", "active")
      )
      .paginate({ numItems: 200, cursor: args.cursor ?? null });

    let archived = 0;
    for (const product of paginated.page) {
      if (product.gewijzigdOp < args.runStartMs) {
        await ctx.db.patch(product._id, { status: "archived", gewijzigdOp: now });
        archived++;
      }
    }

    return {
      supplierFound: true,
      archived,
      isDone: paginated.isDone,
      continueCursor: paginated.isDone ? null : paginated.continueCursor
    };
  }
});

/**
 * Zet de btw-modus van alle advice_retail-prijzen van een leverancier om
 * (exclusive <-> inclusive), zonder her-import. Chunked + dryRun standaard.
 * Legt de keuze ook vast als suppliers.verkoopBtwModus: die instelling is
 * leidend bij een volgende her-import (importChunk volgt haar), dus de
 * wijziging overleeft pipeline-herruns.
 */
export const setSupplierSalesVatMode = mutation({
  args: {
    actor: mutationActorValidator,
    tenantSlug: v.string(),
    supplierName: v.string(),
    mode: v.union(v.literal("exclusive"), v.literal("inclusive")),
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const dryRun = args.dryRun ?? true;
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 1), 500);
    const now = Date.now();

    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("naam"), args.supplierName))
      .first();
    if (!supplier) {
      return {
        supplierFound: false,
        dryRun,
        scanned: 0,
        patched: 0,
        isDone: true,
        continueCursor: null
      };
    }

    if (!dryRun && supplier.verkoopBtwModus !== args.mode) {
      await ctx.db.patch(supplier._id, { verkoopBtwModus: args.mode, gewijzigdOp: now });
    }

    const paginated = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q: any) =>
        q.eq("tenantId", tenantId).eq("leverancierId", supplier._id)
      )
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let patched = 0;
    for (const product of paginated.page) {
      const prices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q: any) =>
          q.eq("tenantId", tenantId).eq("productId", product._id)
        )
        .collect();
      for (const price of prices) {
        if (price.prijsSoort !== "advice_retail" || price.btwModus === args.mode) continue;
        patched++;
        if (!dryRun) {
          await ctx.db.patch(price._id, { btwModus: args.mode, gewijzigdOp: now });
        }
      }
    }

    return {
      supplierFound: true,
      dryRun,
      scanned: paginated.page.length,
      patched: dryRun ? 0 : patched,
      wouldPatch: dryRun ? patched : undefined,
      isDone: paginated.isDone,
      continueCursor: paginated.isDone ? null : paginated.continueCursor
    };
  }
});

export const cleanupOldLogsCron = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete logs older than 7 days
    const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoffDate = Date.now() - RETENTION_MS;
    let deleted = 0;

    // We fetch old batches
    const oldBatches = await ctx.db
      .query("productImportBatches")
      .filter((q) => q.lt(q.field("aangemaaktOp"), cutoffDate))
      .take(10); // Take a small chunk to prevent memory limit

    for (const batch of oldBatches) {
      // Find rows for this batch
      const rows = await ctx.db
        .query("productImportRows")
        .withIndex("by_batch", (q: any) =>
          q.eq("tenantId", batch.tenantId).eq("batchId", batch._id)
        )
        .take(100);

      // If this batch has rows, delete them and break to let the next cron run handle the rest (or next loop)
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }

      // If we deleted rows, don't delete the batch yet because there might be more rows.
      if (rows.length === 100) {
        console.log(`Cron: Deleted ${deleted} rows, stopping chunk to avoid limits.`);
        return { deleted, more: true };
      }

      // If no more rows for this batch, we can delete the batch itself
      if (rows.length < 100) {
        await ctx.db.delete(batch._id);
      }
    }

    console.log(`Cron: Deleted ${deleted} old logs. Batches cleaned: ${oldBatches.length}`);
    return { deleted, more: false };
  }
});
