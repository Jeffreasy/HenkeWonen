import { CalendarDays } from "lucide-react";
import { Badge } from "../ui/data-display/Badge";
import { Alert } from "../ui/feedback/Alert";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";

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

export function DashboardAgendaWidget({ isLoading, agenda }: DashboardAgendaWidgetProps) {
  return (
    <section className="panel" id="agenda-week">
      <div className="dashboard-section-header">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>Inmeetweek</h2>
          <p className="muted">Vrije inmeetplekken op dinsdag, woensdag en donderdag (16:30–17:30).</p>
        </div>
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/agenda">
          Open agenda
        </a>
      </div>

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
              <span className="agenda-widget-dag-kop">
                {WEEKDAG_KORT[dag.weekdag]} {dagFormatter.format(new Date(dag.datumMs))}
              </span>
              <CapaciteitBadge dag={dag} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
