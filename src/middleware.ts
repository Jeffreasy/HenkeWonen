import { defineMiddleware } from "astro:middleware";
import { authProvider } from "./lib/auth";
import { createSessionAuthzToken } from "./lib/auth/authzToken";
import { refreshLaventeCareSession } from "./lib/auth/laventeCareAuthProvider";
import { syncSessionToConvex } from "./lib/auth/sessionSync";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const protectsPortal = pathname.startsWith("/portal");
  const rawSession =
    (await authProvider.getSession(context.request)) ??
    (protectsPortal ? await refreshLaventeCareSession(context.request, context.cookies) : null);
  const session = rawSession
    ? {
        ...rawSession,
        authzToken: await createSessionAuthzToken(rawSession)
      }
    : null;

  context.locals.session = session;

  if (session && pathname.startsWith("/portal")) {
    try {
      await syncSessionToConvex(session);
    } catch (syncError) {
      console.error("Kon sessie niet voorbereiden.", syncError);
    }
  }

  if (protectsPortal && !session) {
    return context.redirect("/login");
  }

  if (
    session?.workspaceMode === "field" &&
    pathname === "/portal" &&
    url.searchParams.get("full") !== "1"
  ) {
    return context.redirect("/portal/buitendienst/vandaag");
  }

  return next();
});
