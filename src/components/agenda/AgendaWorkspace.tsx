import { CalendarClock, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  AFWEZIGHEID_LABEL,
  WEEKDAG_KORT,
  type Afwezigheid,
  type Bezoek,
  type Werktijd,
  dagStatusVoorMonteur,
  formatMinuut,
  startVanWeek,
  weekDagen,
  DAG_MS
} from "../../lib/agenda";
import { Alert } from "../ui/feedback/Alert";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { LoadingState } from "../ui/feedback/LoadingState";
import BeschikbaarheidPanel from "./BeschikbaarheidPanel";

type MonteurAgenda = {
  monteur: { id: string; naam: string; role: string };
  werktijden: Werktijd[];
  afwezigheden: Afwezigheid[];
  bezoeken: Bezoek[];
};

type AgendaWorkspaceProps = {
  session: AppSession;
};

const dagFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const weekFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

export default function AgendaWorkspace({ session }: AgendaWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(() => startVanWeek(Date.now()));
  const [monteurs, setMonteurs] = useState<MonteurAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beheerMonteur, setBeheerMonteur] = useState<MonteurAgenda | null>(null);
  const mag = canManage(session.role);

  const load = useCallback(async () => {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de agenda nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.query(api.portal.agendaWeek, {
        tenantSlug: session.tenantId,
        weekStart
      });
      setMonteurs((result?.monteurs ?? []) as MonteurAgenda[]);
    } catch (loadError) {
      console.error(loadError);
      setError("De agenda kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const dagen = useMemo(() => weekDagen(weekStart), [weekStart]);
  const vandaag = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const weekLabel = `${weekFormatter.format(new Date(weekStart))} – ${weekFormatter.format(
    new Date(weekStart + 6 * DAG_MS)
  )}`;

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Agenda niet geladen" description={error} /> : null}

      <div className="agenda-toolbar">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ChevronLeft size={16} aria-hidden="true" />}
          onClick={() => setWeekStart((w) => w - 7 * DAG_MS)}
        >
          Vorige
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startVanWeek(Date.now()))}>
          Deze week
        </Button>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={<ChevronRight size={16} aria-hidden="true" />}
          onClick={() => setWeekStart((w) => w + 7 * DAG_MS)}
        >
          Volgende
        </Button>
        <span className="agenda-week-label">{weekLabel}</span>
        <span className="agenda-spacer" />
      </div>

      {isLoading ? (
        <LoadingState title="Agenda laden" />
      ) : monteurs.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={20} aria-hidden="true" />}
          title="Geen monteurs gevonden"
          description="Voeg teamleden toe in Beheer om hun beschikbaarheid en bezoeken te tonen."
        />
      ) : (
        monteurs.map((m) => (
          <section className="agenda-monteur" key={m.monteur.id}>
            <div className="agenda-monteur-head">
              <h3>{m.monteur.naam}</h3>
              {mag ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<SlidersHorizontal size={15} aria-hidden="true" />}
                  onClick={() => setBeheerMonteur(m)}
                >
                  Beschikbaarheid
                </Button>
              ) : null}
            </div>
            <div className="agenda-week">
              {dagen.map((dagMs, i) => {
                const status = dagStatusVoorMonteur(dagMs, m.werktijden, m.afwezigheden, m.bezoeken);
                const ingeroosterd = Boolean(status.werktijd);
                return (
                  <div
                    className={`agenda-dag${ingeroosterd ? "" : " niet-ingeroosterd"}${
                      dagMs === vandaag ? " is-vandaag" : ""
                    }`}
                    key={dagMs}
                  >
                    <div className="agenda-dag-kop">
                      <span className="dag-naam">{WEEKDAG_KORT[i]}</span>
                      <span className="dag-datum">{dagFormatter.format(new Date(dagMs))}</span>
                    </div>

                    {status.werktijd ? (
                      <span className="agenda-werktijd">
                        {formatMinuut(status.werktijd.startMinuut)}–
                        {formatMinuut(status.werktijd.eindMinuut)}
                      </span>
                    ) : (
                      <span className="agenda-leeg">Niet ingeroosterd</span>
                    )}

                    {status.afwezig.map((a) => (
                      <Badge key={a.id} variant="warning">
                        {AFWEZIGHEID_LABEL[a.type] ?? a.type}
                      </Badge>
                    ))}

                    {status.bezoeken.map((b) => (
                      <a className="agenda-bezoek" href={`/portal/projecten/${b.projectId}`} key={b.inmetingId}>
                        <b>{b.klantNaam}</b>
                        {b.projectTitel}
                      </a>
                    ))}

                    {ingeroosterd && status.afwezig.length === 0 && status.bezoeken.length === 0 ? (
                      <Badge variant="success">Vrij</Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {mag && beheerMonteur ? (
        <BeschikbaarheidPanel
          session={session}
          monteur={beheerMonteur.monteur}
          werktijden={beheerMonteur.werktijden}
          afwezigheden={beheerMonteur.afwezigheden}
          onClose={() => setBeheerMonteur(null)}
          onSaved={() => {
            setBeheerMonteur(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
