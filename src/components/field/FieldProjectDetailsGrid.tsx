import { formatDate } from "../../lib/dates";
import { SectionHeader } from "../ui/SectionHeader";

type CustomerInfo = {
  displayName?: string;
  phone?: string;
  email?: string;
  notes?: string;
} | null;

type VisitInfo = {
  status: string;
  visitAt?: number;
};

type FieldProjectDetailsGridProps = {
  customer: CustomerInfo;
  address?: string;
  visit: VisitInfo;
  projectNotes?: string;
};

export function FieldProjectDetailsGrid({
  customer,
  address,
  visit,
  projectNotes
}: FieldProjectDetailsGridProps) {
  return (
    <section className="grid field-project-grid">
      <article className="panel field-customer-card">
        <SectionHeader
          compact
          title="Klantgegevens"
          description="Alles wat nodig is voor het bezoek."
        />
        <dl className="field-detail-list">
          <div>
            <dt>Klant</dt>
            <dd>{customer?.displayName ?? "Onbekende klant"}</dd>
          </div>
          <div>
            <dt>Telefoon</dt>
            <dd>{customer?.phone ?? "-"}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{customer?.email ?? "-"}</dd>
          </div>
          <div>
            <dt>Adres</dt>
            <dd>{address ?? "-"}</dd>
          </div>
        </dl>
      </article>

      <article className="panel field-customer-card">
        <SectionHeader
          compact
          title="Bezoekstatus"
          description="Afspraakmoment en relevante notities."
        />
        <dl className="field-detail-list">
          <div>
            <dt>Status</dt>
            <dd>{visit.status}</dd>
          </div>
          <div>
            <dt>Afspraakdatum</dt>
            <dd>{visit.visitAt ? formatDate(visit.visitAt) : "-"}</dd>
          </div>
          <div>
            <dt>Projectnotitie</dt>
            <dd>{projectNotes ?? "-"}</dd>
          </div>
          <div>
            <dt>Klantnotitie</dt>
            <dd>{customer?.notes ?? "-"}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
