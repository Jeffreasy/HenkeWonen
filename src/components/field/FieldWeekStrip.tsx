import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { AppSession } from "../../lib/auth/session";
import { DAG_MS, WEEKDAG_KORT, startVanWeek, weekdagVan, type Bezoek } from "../../lib/agenda";

type FieldWeekStripProps = {
  session: AppSession;
};

const dagFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

export function FieldWeekStrip({ session }: FieldWeekStripProps) {
  const [bezoeken, setBezoeken] = useState<Bezoek[] | null>(null);
  const weekStart = startVanWeek(Date.now());

  const load = useCallback(async () => {
    const client = createConvexHttpClient(session);
    if (!client) return;
    try {
      const res = await client.query(api.portal.agendaWeek, {
        tenantSlug: session.tenantId,
        weekStart,
        // Buitendienst: alleen de eigen week (server resolvet de monteur veilig via het token).
        alleenEigen: true
      });
      const eigen = ((res?.monteurs ?? []) as { bezoeken: Bezoek[] }[])[0];
      const week = eigen?.bezoeken ?? [];
      setBezoeken(
        week
          .filter(
            (b) =>
              b.inmeetdatum != null &&
              b.inmeetdatum >= weekStart &&
              b.inmeetdatum < weekStart + 7 * DAG_MS
          )
          .sort((a, b) => (a.inmeetdatum ?? 0) - (b.inmeetdatum ?? 0))
      );
    } catch (loadError) {
      console.error(loadError);
      setBezoeken([]);
    }
  }, [session, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  // Niets tonen zolang we laden — houdt de Vandaag-pagina compact.
  if (bezoeken === null) {
    return null;
  }

  return (
    <section className="panel field-week-strip">
      <div className="field-week-strip-kop">
        <CalendarClock size={16} aria-hidden="true" />
        <span>Mijn inmeetweek</span>
        <a className="field-week-strip-link" href="/portal/agenda">
          Open agenda
        </a>
      </div>
      {bezoeken.length === 0 ? (
        <p className="muted">Geen inmeetafspraken deze week.</p>
      ) : (
        <ul className="field-week-strip-lijst">
          {bezoeken.map((b) => (
            <li key={b.inmetingId}>
              <a href={`/portal/buitendienst/projecten/${b.projectId}`}>
                <span className="field-week-dag">
                  {WEEKDAG_KORT[weekdagVan(b.inmeetdatum as number)]}{" "}
                  {dagFormatter.format(new Date(b.inmeetdatum as number))}
                </span>
                <span className="field-week-klant">{b.klantNaam}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
