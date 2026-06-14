import { query } from "../_generated/server";
import { v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";

export const getMetadata = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const [suppliers, importProfiles] = await Promise.all([
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("importProfiles")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
    ]);

    return {
      suppliers: suppliers.map((item) => ({ id: String(item._id), name: item.naam })),
      importProfiles: importProfiles.map((item) => ({
        id: String(item._id),
        supplierName: item.leverancierNaam,
        name: item.naam,
        filePattern: item.bestandPatroon ?? null,
        expectedFileExtension: item.verwachteBestandsextensie ?? null,
        supportsXlsx: item.ondersteuntXlsx,
        supportsXls: item.ondersteuntXls,
        status: item.status,
      })),
    };
  },
});

export const getProductsPage = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const result = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((item) => ({
        id: String(item._id),
        supplierId: item.leverancierId ? String(item.leverancierId) : null,
        articleNumber: item.artikelnummer ?? null,
        name: item.naam,
        status: item.status,
      })),
    };
  },
});

export const getProductPricesPage = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const result = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((item) => ({
        id: String(item._id),
        productId: String(item.productId),
        sourceKey: item.bronSleutel ?? null,
        sourceFileName: item.bronBestandsnaam ?? null,
        sourceSheetName: item.bronBladNaam ?? null,
        sourceRowNumber: item.bronRijNummer ?? null,
        sourceColumnIndex: item.bronKolomIndex ?? null,
        sourceColumnName: item.bronKolomNaam ?? null,
        sourceValue: item.bronWaarde ?? null,
        amount: item.bedrag,
        priceType: item.prijsSoort,
        vatMode: item.btwModus,
      })),
    };
  },
});
