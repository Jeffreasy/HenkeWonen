import { defineMiddleware } from "astro:middleware";
import { authProvider } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  const session = await authProvider.getSession(context.request);

  context.locals.session = session;

  const pathname = new URL(context.request.url).pathname;

  if (pathname.startsWith("/portal") && !session) {
    return context.redirect("/login");
  }

  return next();
});
