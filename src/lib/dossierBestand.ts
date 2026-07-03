/**
 * Header-helpers voor de sessie-beveiligde dossierbestand-proxy
 * (src/pages/portal/dossierbestand/[id].ts). Los van de route zodat ze unit-testbaar
 * zijn zonder Astro/Convex-context.
 *
 * Achtergrond: de proxy serveert user-geüploade bestanden op de portal-origin zelf
 * (mét sessiecookies). Het opgeslagen `bestandstype` is een vrij door de client
 * aangeleverde string — die mag dus nooit ongefilterd bepalen dat iets inline rendert:
 * een geüpload text/html- of SVG-bestand zou dan als stored XSS in de sessie van de
 * kijker draaien. Alleen een vaste allowlist van render-veilige types opent inline;
 * al het andere wordt een download (attachment).
 */

/** Types die veilig inline in de browser kunnen openen (geen scriptuitvoering mogelijk). */
const INLINE_SAFE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/plain"
]);

// Een geldig type/subtype-token (RFC 7231); alles wat hier niet aan voldoet is geen
// bruikbaar content-type en valt terug op octet-stream (voorkomt ook header-injectie).
const CONTENT_TYPE_PATTERN = /^[\w!#$%&'*+.^`|~-]+\/[\w!#$%&'*+.^`|~-]+$/u;

/**
 * Bepaalt het content-type voor de response: het opgeslagen type, anders het
 * upstream-type, en bij een onbruikbare waarde application/octet-stream.
 * Parameters (bv. "; charset=") worden weggelaten.
 */
export function resolveDossierContentType(stored?: string, upstream?: string | null): string {
  const candidate = (stored || upstream || "").split(";")[0].trim().toLowerCase();

  return CONTENT_TYPE_PATTERN.test(candidate) ? candidate : "application/octet-stream";
}

export function isInlineSafeType(contentType: string): boolean {
  return INLINE_SAFE_TYPES.has(contentType);
}

/**
 * ASCII-fallback voor `filename=`: alleen afdrukbare ASCII zonder `"` en `\`
 * (header-waardes zijn ByteStrings; een codepoint > 0xFF laat Headers.set een
 * TypeError gooien, en quotes/backslashes breken de quoted-string).
 */
function asciiFilenameFallback(name: string): string | null {
  const cleaned = Array.from(name)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;

      return code >= 0x20 && code <= 0x7e && char !== '"' && char !== "\\";
    })
    .join("")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

/** RFC 5987-encodering voor `filename*` — encodeURIComponent plus de attr-char-uitzonderingen. */
function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/gu,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Bouwt de Content-Disposition: inline alleen voor render-veilige types (anders download),
 * met een ASCII-`filename=`-fallback én een volledige UTF-8-naam via `filename*`
 * (zodat "Offerte – juli.pdf" met en-dash gewoon werkt in plaats van een 500 te geven).
 */
export function dossierContentDisposition(contentType: string, filename?: string): string {
  const disposition = isInlineSafeType(contentType) ? "inline" : "attachment";

  if (!filename) {
    return disposition;
  }

  const parts = [disposition];
  const ascii = asciiFilenameFallback(filename);

  if (ascii) {
    parts.push(`filename="${ascii}"`);
  }
  parts.push(`filename*=UTF-8''${encodeRFC5987(filename)}`);

  return parts.join("; ");
}
