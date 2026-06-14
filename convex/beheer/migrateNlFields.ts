/**
 * NL-veldnaam-datamigratie (Fase 2) — hernoemt de OPGESLAGEN veldnamen van
 * bestaande documenten van Engels naar Nederlands, conform de bevroren spec
 * tools/nl-rename-spec.json (afgeleid uit het schema-diff + gekruist met
 * tools/nl-rename-map.mjs.fieldMap).
 *
 * Volgorde van de hele operatie (per omgeving; dev eerst met backup, prod = eigenaar):
 *   1. Backup: npx convex export [--prod] --path <duurzaam pad buiten repo>.zip
 *   2. defineSchema(..., { schemaValidation: false }) → deploy NL-schema/code.
 *   3. Deze mutatie chunked draaien (dryRun → apply) per tabel — zie
 *      tools/migrate_nl_fields.mjs (driver, cursor-loop).
 *   4. { schemaValidation: true } terug → deploy; de deploy-validatie bevestigt
 *      dat ALLE docs NL zijn (faalt zodra er nog een EN-veld rest).
 *
 * Eigenschappen: admin-rol + letterlijke confirm + dryRun-default; scant de HELE
 * tabel (deployment-breed, niet tenant-gescoped); IDEMPOTENT/herrunbaar (een al
 * gemigreerd doc wordt overgeslagen); patch met `oud: undefined` verwijdert het
 * oude veld. v.any-blobs (measurementLines.invoer/resultaat, attributen, metadata)
 * worden als geheel verplaatst — hun interne sleutels blijven ongemoeid.
 *
 * Aansturing: tools/migrate_nl_fields.mjs
 */
import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { mutationActorValidator, requireMutationRole } from "../authz";

const renameFieldsValidator = v.record(v.string(), v.string());

/** Hernoemt de sleutels van één (genest) object volgens oud→nieuw; onbekende sleutels blijven. */
function renameObjectKeys(obj: Record<string, unknown>, fields: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    out[fields[k] ?? k] = val;
  }
  return out;
}

export const renameFieldsChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("RENAME_NL_FIELDS"),
    table: v.string(),
    spec: v.object({
      fields: renameFieldsValidator,
      nestedArrays: v.array(
        v.object({
          oldOuter: v.string(),
          newOuter: v.string(),
          fields: renameFieldsValidator
        })
      )
    }),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Autorisatie-gate (admin van de opgegeven tenant). De migratie zelf is
    // deployment-breed: ze scant de hele tabel, ongeacht tenant.
    await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const batchSize = Math.min(Math.max(args.batchSize ?? 500, 50), 1000);
    const dryRun = args.dryRun ?? true;
    const { fields, nestedArrays } = args.spec;

    const paginated = await ctx.db
      .query(args.table as any)
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    let patched = 0;
    const samples: Array<{ id: string; changed: string[] }> = [];

    for (const doc of paginated.page) {
      const raw = doc as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      const changed: string[] = [];

      // 1. Top-level renames (idempotent: alleen als oud aanwezig en nieuw nog leeg).
      for (const [oldK, newK] of Object.entries(fields)) {
        if (oldK === newK) continue;
        if (raw[oldK] !== undefined && raw[newK] === undefined) {
          patch[newK] = raw[oldK];
          patch[oldK] = undefined; // verwijdert het oude veld
          changed.push(`${oldK}→${newK}`);
        }
      }

      // 2. Geneste array-van-objecten (binnenste sleutels hernoemen).
      for (const nested of nestedArrays) {
        const src = raw[nested.oldOuter];
        if (!Array.isArray(src)) continue;

        const innerNeedsRename = src.some(
          (el) =>
            el &&
            typeof el === "object" &&
            Object.keys(el as Record<string, unknown>).some((k) => nested.fields[k] !== undefined)
        );
        const outerRenamed = nested.oldOuter !== nested.newOuter;
        if (!innerNeedsRename && !outerRenamed) continue;

        patch[nested.newOuter] = src.map((el) =>
          el && typeof el === "object"
            ? renameObjectKeys(el as Record<string, unknown>, nested.fields)
            : el
        );
        if (outerRenamed) {
          patch[nested.oldOuter] = undefined;
        }
        changed.push(`${nested.oldOuter}[]→${nested.newOuter}[]`);
      }

      if (changed.length === 0) continue;

      matched += 1;
      if (samples.length < 5) {
        samples.push({ id: String(raw._id), changed });
      }

      if (!dryRun) {
        await ctx.db.patch((raw._id as any), patch);
        patched += 1;
      }
    }

    return {
      dryRun,
      table: args.table,
      scanned: paginated.page.length,
      matched,
      patched: dryRun ? 0 : patched,
      samples,
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

/**
 * Read-only verificatie: telt per tabel hoeveel docs nog een OUD (Engels) veld
 * bevatten. Na een geslaagde migratie moet dit overal 0 zijn. Chunked.
 */
export const countRemainingOldFields = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    table: v.string(),
    oldFieldNames: v.array(v.string()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    if (args.oldFieldNames.length === 0) {
      throw new ConvexError("oldFieldNames mag niet leeg zijn.");
    }
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 50), 2000);

    const paginated = await ctx.db
      .query(args.table as any)
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    const perField: Record<string, number> = {};
    let docsWithAnyOld = 0;

    for (const doc of paginated.page) {
      const raw = doc as unknown as Record<string, unknown>;
      let hasOld = false;
      for (const oldName of args.oldFieldNames) {
        if (raw[oldName] !== undefined) {
          perField[oldName] = (perField[oldName] ?? 0) + 1;
          hasOld = true;
        }
      }
      if (hasOld) docsWithAnyOld += 1;
    }

    return {
      table: args.table,
      scanned: paginated.page.length,
      docsWithAnyOld,
      perField: Object.entries(perField).map(([field, count]) => ({ field, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});
