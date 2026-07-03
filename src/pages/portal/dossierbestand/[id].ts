import type { APIRoute } from "astro";
import { api } from "../../../../convex/_generated/api";
import { createConvexHttpClient } from "../../../lib/convex/client";

export const prerender = false;

/**
 * Sessie-beveiligde proxyroute voor dossierbestanden (plattegronden, foto's, scans, oude
 * offertes).
 *
 * Waarom deze route bestaat: Convex `storage.getUrl` levert een permanente, publieke,
 * login-loze URL op. Zo'n link mag niet naar de browser — wie 'm ooit ziet (browserhistorie,
 * gedeelde link, referrer) houdt eeuwig toegang, ook zonder in te loggen. In plaats daarvan
 * verwijst de portal naar /portal/dossierbestand/<attachmentId>. Deze route:
 *   1. leunt op de portal-middleware (redirect naar /login als er geen geldige sessie is);
 *   2. resolvet server-side de storage-URL via een rol-gecheckte, tenant-scoped Convex-query;
 *   3. haalt de bytes server-side op en streamt ze terug.
 * De publieke storage-URL verlaat de server dus nooit. (AVG-audit 2026-07-03, punt 1.)
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
      attachmentId
    });
  } catch (error) {
    console.error("Kon dossierbestand niet ophalen.", error);
    return new Response("Kon het bestand niet ophalen.", { status: 502 });
  }

  if (!file) {
    return new Response("Bestand niet gevonden.", { status: 404 });
  }

  const upstream = await fetch(file.url);
  if (!upstream.ok || !upstream.body) {
    return new Response("Bestand is niet beschikbaar.", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    file.bestandstype || upstream.headers.get("content-type") || "application/octet-stream"
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }
  // Persoonsgegevens: niet bewaren in gedeelde caches en de browser laten hercontroleren.
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  const filename = sanitizeFilename(file.bestandsnaam);
  headers.set("content-disposition", filename ? `inline; filename="${filename}"` : "inline");

  return new Response(upstream.body, { status: 200, headers });
};

/**
 * Houdt alleen een veilige bestandsnaam over voor de Content-Disposition-header: quotes en
 * backslashes eruit (breken de `filename="..."`-waarde) en alle control-chars incl. CR/LF
 * en DEL (voorkomen header-injectie). Regex-vrij zodat er geen control-char in de broncode
 * hoeft te staan. Geeft null terug als er niets bruikbaars overblijft.
 */
function sanitizeFilename(name?: string): string | null {
  if (!name) {
    return null;
  }

  const cleaned = Array.from(name)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code <= 0x1f || code === 0x7f) {
        return false;
      }
      return char !== '"' && char !== "\\";
    })
    .join("")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}
