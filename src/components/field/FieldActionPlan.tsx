import { MapPin } from "lucide-react";
import { formatDate } from "../../lib/dates";
import { formatMeasurementStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";

type TaskPriority = {
  label: string;
  level: string;
};

type ActionPlanTask = {
  id: string;
  titel: string;
  vervaltOp: number;
  priority: TaskPriority;
};

type FieldActionPlanProps = {
  customerDisplayName: string;
  address?: string;
  measurementStatus?: string;
  selectedQuoteStatus?: string;
  openTasks: ActionPlanTask[];
};

export function FieldActionPlan({
  customerDisplayName,
  address,
  measurementStatus,
  selectedQuoteStatus,
  openTasks
}: FieldActionPlanProps) {
  return (
    <>
      <section className="field-action-plan" aria-label="Werkvolgorde klantbezoek">
        <article className="field-action-card">
          <span>1</span>
          <div>
            <strong>Klant en adres</strong>
            <p>{customerDisplayName}</p>
            {address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                rel="noreferrer"
                target="_blank"
              >
                <MapPin size={16} aria-hidden="true" />
                Route openen
              </a>
            ) : null}
          </div>
        </article>
        <a className="field-action-card" href="#inmeten">
          <span>2</span>
          <div>
            <strong>Inmeten</strong>
            <p>
              {measurementStatus
                ? formatMeasurementStatus(measurementStatus)
                : "Nog te starten"}
            </p>
          </div>
        </a>
        <a className="field-action-card" href="#conceptofferte">
          <span>3</span>
          <div>
            <strong>Conceptofferte</strong>
            <p>
              {selectedQuoteStatus
                ? formatQuoteStatus(selectedQuoteStatus)
                : "Nog niet gestart"}
            </p>
          </div>
        </a>
        {selectedQuoteStatus ? (
          <a className="field-action-card" href="#conceptofferte">
            <span>4</span>
            <div>
              <strong>Klantversie</strong>
              <p>
                {selectedQuoteStatus === "accepted"
                  ? "Akkoord ontvangen"
                  : selectedQuoteStatus === "sent"
                  ? "Gedeeld met klant"
                  : selectedQuoteStatus === "rejected"
                  ? "Afgewezen"
                  : "Nog te presenteren"}
              </p>
            </div>
          </a>
        ) : null}
      </section>

      {openTasks.length > 0 ? (
        <section className="field-action-plan" aria-label="Procesopvolging">
          {openTasks.slice(0, 3).map((task) => (
            <article className="field-action-card" key={task.id}>
              <span>{task.priority.label.slice(0, 1)}</span>
              <div>
                <strong>
                  {task.priority.label}: {task.titel}
                </strong>
                <p>Deadline {formatDate(task.vervaltOp)}</p>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
