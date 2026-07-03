/**
 * Storingspagina voor als de LaventeCare-auth-dienst niet bereikbaar is.
 *
 * De middleware kan in dat geval geen sessie vaststellen: doorlaten is onveilig,
 * naar /login sturen is zinloos (inloggen faalt dan ook). Deze pagina zegt eerlijk
 * dat het systeem er zo weer is en probeert het zelf elke 20 seconden opnieuw.
 * Bewust een zelfstandige HTML-response zonder layout/session-afhankelijkheden.
 */

const RETRY_SECONDS = 20;

const OUTAGE_HTML = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="${RETRY_SECONDS}" />
    <title>Even geduld | Henke Wonen</title>
    <style>
      body {
        margin: 0;
        min-height: 100svh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0d0b09;
        color: #f7f2ea;
        font-family: "Inter", system-ui, -apple-system, sans-serif;
        text-align: center;
        padding: 24px;
      }
      .card {
        max-width: 420px;
        display: grid;
        gap: 14px;
        justify-items: center;
      }
      .eyebrow {
        margin: 0;
        color: #b8893a;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      p {
        margin: 0;
        color: rgba(247, 242, 234, 0.65);
        font-size: 0.92rem;
        line-height: 1.65;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fbbf24;
        animation: pulse 2s ease infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dot { animation: none; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <span class="dot" aria-hidden="true"></span>
      <p class="eyebrow">Henke Wonen werkplek</p>
      <h1>Even geduld, we zijn zo terug</h1>
      <p>
        Het inlogsysteem is op dit moment niet bereikbaar. Je gegevens zijn veilig en
        er gaat niets verloren. Deze pagina probeert het over ${RETRY_SECONDS} seconden
        automatisch opnieuw.
      </p>
    </main>
  </body>
</html>`;

export function authOutageResponse() {
  return new Response(OUTAGE_HTML, {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(RETRY_SECONDS)
    }
  });
}
