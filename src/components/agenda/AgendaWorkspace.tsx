import { CalendarClock, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { canManageAgenda, isFieldWorkspace, type AppSession } from "../../lib/auth/session";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { createConvexHttpClient } from "../../lib/convex/client";
import { showToast } from "../../lib/toast";
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
import { Card } from "../ui/data-display/Card";
import { EmptyState } from "../ui/feedback/EmptyState";
import { LoadingState } from "../ui/feedback/LoadingState";
import BeschikbaarheidPanel from "./BeschikbaarheidPanel";

type MonteurAgenda = {
  monteur: { id: string; naam: string; role: string };
  werktijden: Werktijd[];
  afwezigheden: Afwezigheid[];
  bezoeken: Bezoek[];
};

type NietToegewezenBezoek = {
  inmetingId: string;
  projectId: string;
  projectTitel: string;
  klantNaam: string;
  inmeetdatum: number | null;
};

type AgendaLid = {
  id: string;
  naam: string;
  email: string;
  role: string;
  toonInAgenda: boolean | null;
};

type AgendaWorkspaceProps = {
  session: AppSession;
};

const dagFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const weekFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

export default function AgendaWorkspace({ session }: AgendaWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(() => startVanWeek(Date.now()));
  const [monteurs, setMonteurs] = useState<MonteurAgenda[]>([]);
  const [nietToegewezen, setNietToegewezen] = useState<NietToegewezenBezoek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beheerMonteur, setBeheerMonteur] = useState<MonteurAgenda | null>(null);
  const [teamLeden, setTeamLeden] = useState<AgendaLid[]>([]);
  const [teamError, setTeamError] = useState<string | null>(null);
  const mag = canManageAgenda(session.role);
  const veld = isFieldWorkspace(session);
  const lastRequestId = useRef(0);

  const projectHref = useCallback(
    (projectId: string) =>
      veld ? `/portal/buitendienst/projecten/${projectId}` : `/portal/projecten/${projectId}`,
    [veld]
  );

  const load = useCallback(async () => {
    const requestId = lastRequestId.current + 1;
    lastRequestId.current = requestId;
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
        weekStart,
        // Buitendienst: alleen de eigen week (server resolvet de monteur veilig).
        alleenEigen: veld
      });
      // Negeer verouderde antwoorden bij snel weeknavigeren (race-guard).
      if (requestId !== lastRequestId.current) {
        return;
      }
      setMonteurs((result?.monteurs ?? []) as MonteurAgenda[]);
      setNietToegewezen((result?.nietToegewezen ?? []) as NietToegewezenBezoek[]);
    } catch (loadError) {
      console.error(loadError);
      if (requestId !== lastRequestId.current) {
        return;
      }
      setError("De agenda kon niet worden geladen.");
    } finally {
      if (requestId === lastRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [session, weekStart, veld]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTeam = useCallback(async () => {
    if (!mag) return;
    const client = createConvexHttpClient(session);
    if (!client) return;
    try {
      const res = await client.query(api.portal.listTeamMembers, { tenantSlug: session.tenantId });
      setTeamLeden(((res ?? []) as AgendaLid[]).filter((u) => u.role !== "viewer"));
      setTeamError(null);
    } catch (loadTeamError) {
      console.error(loadTeamError);
      setTeamError("De teamlijst kon niet worden geladen.");
    }
  }, [mag, session]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function toggleZichtbaar(userId: string, toon: boolean) {
    const client = createConvexHttpClient(session);
    if (!client) return;
    setTeamLeden((prev) => prev.map((u) => (u.id === userId ? { ...u, toonInAgenda: toon } : u)));
    try {
      await client.mutation(api.portal.setAgendaZichtbaarheid, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        userId: userId as Id<"users">,
        toonInAgenda: toon
      });
      await load(); // agenda herladen — de whitelist kan nu wijzigen
    } catch (toggleError) {
      console.error(toggleError);
      showToast({
        title: "Zichtbaarheid niet opgeslagen",
        description: "Probeer het opnieuw.",
        tone: "error"
      });
      await loadTeam(); // herstel de echte stand bij een fout
    }
  }

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
      {error ? (
        <Alert variant="danger" title="Agenda niet geladen" description={error}>
          <div className="agenda-alert-actie">
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Opnieuw proberen
            </Button>
          </div>
        </Alert>
      ) : null}

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
        <span className="agenda-week-label" aria-live="polite">
          {weekLabel}
        </span>
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
          <Card key={m.monteur.id} className="agenda-monteur">
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
                const isVandaag = dagMs === vandaag;
                return (
                  <div
                    className={`agenda-dag${ingeroosterd ? "" : " niet-ingeroosterd"}${
                      isVandaag ? " is-vandaag" : ""
                    }`}
                    key={dagMs}
                    aria-current={isVandaag ? "date" : undefined}
                  >
                    <div className="agenda-dag-kop">
                      <span className="dag-naam">
                        {WEEKDAG_KORT[i]}
                        {isVandaag ? <span className="dag-vandaag"> · vandaag</span> : null}
                      </span>
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
                      <a
                        className="agenda-bezoek"
                        href={projectHref(b.projectId)}
                        key={b.inmetingId}
                        aria-label={`Bezoek ${b.klantNaam} — ${b.projectTitel}`}
                      >
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
          </Card>
        ))
      )}

      {nietToegewezen.length > 0 ? (
        <Alert
          variant="warning"
          title={`${nietToegewezen.length} ingeplande inmeting${
            nietToegewezen.length === 1 ? "" : "en"
          } zonder monteur`}
          description="Deze inmetingen hebben wél een datum maar nog geen toegewezen monteur. Ze staan in geen enkele agenda en tellen niet mee in de capaciteit — wijs een monteur toe via 'Inmeting inplannen' in het dossier."
        >
          <ul className="agenda-niet-toegewezen">
            {nietToegewezen.map((b) => (
              <li key={b.inmetingId}>
                <a href={projectHref(b.projectId)}>
                  <b>{b.klantNaam}</b> — {b.projectTitel}
                </a>
                {b.inmeetdatum ? (
                  <span className="agenda-nt-datum"> · {dagFormatter.format(new Date(b.inmeetdatum))}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {mag && (teamLeden.length > 0 || teamError) ? (
        <Card className="agenda-leden">
          <h3>Wie staat in de agenda</h3>
          {teamError ? (
            <Alert variant="danger" title="Teamlijst niet geladen" description={teamError}>
              <div className="agenda-alert-actie">
                <Button variant="secondary" size="sm" onClick={() => void loadTeam()}>
                  Opnieuw proberen
                </Button>
              </div>
            </Alert>
          ) : (
            <>
              <p className="agenda-leden-hint">
                Vink aan wie als monteur in de agenda verschijnt. Zodra je iemand aanvinkt, toont de
                agenda alléén de aangevinkte personen — handig om bijvoorbeeld admin-/dev-accounts te
                verbergen.
              </p>
              <ul className="agenda-leden-lijst">
                {teamLeden.map((lid) => (
                  <li key={lid.id} className="agenda-lid">
                    <label className="agenda-lid-label">
                      <input
                        type="checkbox"
                        checked={lid.toonInAgenda === true}
                        onChange={(event) => void toggleZichtbaar(lid.id, event.target.checked)}
                      />
                      <span className="agenda-lid-naam">{lid.naam}</span>
                      <span className="agenda-lid-email">{lid.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : null}

      {mag && beheerMonteur ? (
        <BeschikbaarheidPanel
          session={session}
          monteur={beheerMonteur.monteur}
          werktijden={beheerMonteur.werktijden}
          afwezigheden={beheerMonteur.afwezigheden}
          onClose={() => setBeheerMonteur(null)}
          onChanged={() => void load()}
          onSaved={() => {
            setBeheerMonteur(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
