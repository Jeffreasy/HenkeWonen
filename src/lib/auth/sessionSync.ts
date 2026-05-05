import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createConvexSyncToken } from "./authzToken";
import type { AppSession } from "./session";

const convexUrl = import.meta.env.PUBLIC_CONVEX_URL;
const tenantName = import.meta.env.AUTH_TENANT_NAME ?? "Henke Wonen";

export async function syncSessionToConvex(session: AppSession) {
  if (!convexUrl) {
    return;
  }

  const client = new ConvexHttpClient(convexUrl);
  const syncToken = await createConvexSyncToken(session);
  const tenantId = await client.mutation(api.tenants.ensureTenant, {
    slug: session.tenantId,
    name: tenantName,
    syncToken
  });

  await client.mutation(api.users.ensureUser, {
    tenantId,
    externalUserId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    workspaceMode: session.workspaceMode,
    syncToken
  });
}
