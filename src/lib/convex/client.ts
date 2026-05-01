import { ConvexHttpClient } from "convex/browser";

export const convexUrl = import.meta.env.PUBLIC_CONVEX_URL;

export function createConvexHttpClient(): ConvexHttpClient | null {
  if (!convexUrl) {
    return null;
  }

  return new ConvexHttpClient(convexUrl);
}
