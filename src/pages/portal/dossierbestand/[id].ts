import type { APIRoute } from "astro";
import { api } from "../../../../convex/_generated/api";
import { createConvexHttpClient } from "../../../lib/convex/client";
import { dossierContentDisposition, resolveDossierContentType } from "../../../lib/dossierBestand";

export const prerender = false;

// Begrensd: zonder timeout houdt een hangende storage-verbinding het SSR-request eeuwig open.
const STORAGE_FETCH_TIMEOUT_MS = 15_000;

/**
 * Sessie-beveiligde proxyroute voor dossierbestanden (plattegronden, foto's, scans, oude
 * offertes).
 *
 * Waarom deze route bestaat: Convex `storage.getUrl` levert een permanente, publieke,
 * login-loze URL op. Zo'n link mag niet naar de browser — wie 'm ooit ziet (browserhistorie,
 * gedeelde link, referrer) houdt eeuwig toegang, ook zonder in te loggen. In plaats daarvan
 * verwijst de portal naar /portal/dossierbestand/<attachmentId>. Deze route:
 *   1. leunt op de portal-middleware (redirect naar /login als er geen geldige sessie is);
 *   2. resolvet server-side de storage-URL via een rol-gecheckte, tenant-scoped Convex-query
 *      (afgeschermd met DOSSIERBESTAND_PROXY_SECRET zodra dat op beide omgevingen staat);
 *   3. haalt de bytes server-side op en streamt ze terug.
 * De publieke storage-URL verlaat de server dus nooit. (AVG-audit 2026-07-03, punt 1.)
 *
 * Let op: de bestanden worden hierdoor op de portal-origin zelf geserveerd (mét sessie-
 * cookies). Het content-type en de weergavemodus (inline vs. download) worden daarom
 * bewust NIET blind uit het user-aangeleverde `bestandstype` overgenomen — zie
 * src/lib/dossierBestand.ts (alleen render-veilige types openen inline).
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const session = locals.session;
  // De middleware redirect /portal-paden zonder sessie al naar /login; deze check is
  // defensief (en dekt een onverhoopt lek in de routing af).
  if (!session) {
    return new Response("Niet ingelogd.", { status: 401 });
  }

  const attachmentId = params.id;
  if (!attachmentId) {
    return new Response("Geen dossierstuk opgegeven.", { status: 400 });
  }

  const client = createConvexHttpClient(session);
  if (!client) {
    return new Response("Bestandsopslag is niet geconfigureerd.", { status: 503 });
  }

  let file: { url: string; bestandsnaam?: string; bestandstype?: string } | null;
  try {
    // De actor (met rol) wordt door createConvexHttpClient automatisch aan de query gehangen;
    // de query weigert stukken van een andere tenant of gearchiveerde/bestandsloze stukken.
    file = await client.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: session.tenantId,
      attachmentId,
      proxySecret: import.meta.env.DOSSIERBESTAND_PROXY_SECRET || undefined
    });
  } catch (error) {
    console.error("Kon dossierbestand niet ophalen.", error);
    return new Response("Kon het bestand niet ophalen.", { status: 502 });
  }

  if (!file) {
    return new Response("Bestand niet gevonden.", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(file.url, { signal: AbortSignal.timeout(STORAGE_FETCH_TIMEOUT_MS) });
  } catch (fetchError) {
    console.error("Bestandsopslag niet bereikbaar.", fetchError);
    return new Response("Bestand is nu niet beschikbaar. Probeer het opnieuw.", { status: 504 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Bestand is niet beschikbaar.", { status: 502 });
  }

  const contentType = resolveDossierContentType(
    file.bestandstype,
    upstream.headers.get("content-type")
  );

  const headers = new Headers();
  headers.set("content-type", contentType);
  // Content-length alleen doorgeven als upstream ongecomprimeerd levert: fetch decomprimeert
  // een content-encoding-antwoord transparant en dan klopt de lengte niet meer met de bytes.
  const contentLength = upstream.headers.get("content-length");
  if (contentLength && !upstream.headers.get("content-encoding")) {
    headers.set("content-length", contentLength);
  }
  // Persoonsgegevens: alleen de privé-browsercache en kort — herhaald bekijken op de tablet
  // blijft snel, maar gedeelde caches (proxies/CDN) houden het bestand nooit vast.
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", dossierContentDisposition(contentType, file.bestandsnaam));

  return new Response(upstream.body, { status: 200, headers });
};
