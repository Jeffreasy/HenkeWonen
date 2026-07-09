import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import { createToolMutationActor } from "./tools/authz_actor.mjs";

const client = new ConvexHttpClient("https://kindly-greyhound-592.eu-west-1.convex.cloud");

async function check() {
  const result = await client.mutation(api.catalog.v2_import.clearCatalogProducts, {
    tenantSlug: "henke-wonen",
    actor: createToolMutationActor("henke-wonen"),
  });
  console.log(result);
}
check();
