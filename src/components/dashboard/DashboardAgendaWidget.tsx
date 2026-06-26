import { CalendarDays, Plus } from "lucide-react";
import { Badge } from "../ui/data-display/Badge";
import { Alert } from "../ui/feedback/Alert";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";
import { CollapsiblePanel } from "../ui/layout/CollapsiblePanel";

export type DashboardAgendaDag = {
  datumMs: number;
  weekdag: number;
  geboekt: number;
  vrijeCapaciteit: number;
  maxCapaciteit: number;
};

export type DashboardAgenda = {
  weekStart: number;
  dagen: DashboardAgendaDag[];
  nietToegewezenCount: number;
};

type DashboardAgendaWidgetProps = {
  isLoading: boolean;
  agenda: DashboardAgenda;
  /** Opent de inplan-wizard; krijgt optioneel de aangeklikte inmeetdag voorgevuld. */
  onPlan?: (datumMs?: number) => void;
  /** Of de gebruiker mag inplannen (rol-guard); zonder dit blijft de widget read-only. */
  canPlan?: boolean;
};

const WEEKDAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const dagFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

function CapaciteitBadge({ dag }: { dag: DashboardAgendaDag }) {
  if (dag.vrijeCapaciteit === 0) {
    return <Badge variant="neutral">Vol</Badge>;
  }
  const tekst = `${dag.vrijeCapaciteit} van ${dag.maxCapaciteit} vrij`;
  return <Badge variant={dag.geboekt === 0 ? "success" : "info"}>{tekst}</Badge>;
}

export function DashboardAgendaWidget({
  isLoading,
  agenda,
  onPlan,
  canPlan = false
}: DashboardAgendaWidgetProps) {
  const magInplannen = canPlan && Boolean(onPlan);
  return (
    <>
      {!isLoading && agenda.nietToegewezenCount > 0 ? (
        <Alert
          variant="warning"
          title={`${agenda.nietToegewezenCount} inmeting${
            agenda.nietToegewezenCount === 1 ? "" : "en"
          } zonder monteur`}
          description="Deze inmetingen hebben een datum maar nog geen toegewezen monteur en staan in geen enkele agenda."
        >
          <div className="agenda-alert-actie">
            <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/agenda">
              Wijs een monteur toe
            </a>
          </div>
        </Alert>
      ) : null}

      <CollapsiblePanel
        id="agenda-week"
        eyebrow="Agenda"
        title="Inmeetweek"
        description="Vrije inmeetplekken op dinsdag, woensdag en donderdag (16:30–17:30)."
        action={
          <div className="dashboard-agenda-acties">
            {magInplannen ? (
              <button
                type="button"
                className="ui-button ui-button-primary ui-button-sm"
                onClick={() => onPlan?.()}
              >
                <Plus size={15} aria-hidden="true" /> Inmeting inplannen
              </button>
            ) : null}
            <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/agenda">
              Open agenda
            </a>
          </div>
        }
      >
        {isLoading ? (
          <div className="agenda-widget-strip" aria-busy="true" aria-label="Inmeetweek laden">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="agenda-widget-dag" key={index}>
                <Skeleton width="60%" height={15} />
                <Skeleton width="80%" height={20} />
              </div>
            ))}
          </div>
        ) : agenda.dagen.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} aria-hidden="true" />}
            title="Geen inmeetdagen deze week"
            description="Inmeten kan op dinsdag, woensdag en donderdag."
          />
        ) : (
          <div className="agenda-widget-strip">
            {agenda.dagen.map((dag) => (
              <div className="agenda-widget-dag" key={dag.datumMs}>
                <div className="agenda-widget-dag-rij">
                  <span className="agenda-widget-dag-kop">
                    {WEEKDAG_KORT[dag.weekdag]} {dagFormatter.format(new Date(dag.datumMs))}
                  </span>
                  {magInplannen ? (
                    <button
                      type="button"
                      className="agenda-widget-plus"
                      disabled={dag.vrijeCapaciteit === 0}
                      aria-label={`Inmeting inplannen op ${WEEKDAG_KORT[dag.weekdag]} ${dagFormatter.format(
                        new Date(dag.datumMs)
                      )}`}
                      onClick={() => onPlan?.(dag.datumMs)}
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <CapaciteitBadge dag={dag} />
              </div>
            ))}
          </div>
        )}
      </CollapsiblePanel>
    </>
  );
}
