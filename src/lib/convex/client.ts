import { ConvexHttpClient } from "convex/browser";
import { authzActorFromSession } from "../auth/authzToken";
import type { AppSession } from "../auth/session";

export const convexUrl = import.meta.env.PUBLIC_CONVEX_URL;

type SessionConvexHttpClient = Omit<ConvexHttpClient, "query"> & {
  query: (queryReference: any, args?: Record<string, unknown>) => Promise<any>;
};

export function createConvexHttpClient(session?: AppSession): SessionConvexHttpClient | null {
  if (!convexUrl) {
    return null;
  }

  const client = new ConvexHttpClient(convexUrl);

  if (!session) {
    return client as SessionConvexHttpClient;
  }

  const query = client.query.bind(client);
  client.query = ((queryReference: any, args?: Record<string, unknown>) =>
    query(queryReference, {
      ...(args ?? {}),
      actor: authzActorFromSession(session)
    })) as typeof client.query;

  return client as SessionConvexHttpClient;
}
