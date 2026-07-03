import { formatDate } from "../../lib/dates";
import { SectionHeader } from "../ui/layout/SectionHeader";

// Veldnamen volgen PortalCustomer (weergaveNaam/telefoon/notities): de workspace geeft
// de klant 1-op-1 door — de eerdere Engelse propnamen matchten nergens op, waardoor
// naam, telefoon en klantnotitie altijd "-" toonden.
type CustomerInfo = {
  weergaveNaam?: string;
  telefoon?: string;
  email?: string;
  notities?: string;
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
            <dd>{customer?.weergaveNaam ?? "Onbekende klant"}</dd>
          </div>
          <div>
            <dt>Telefoon</dt>
            <dd>{customer?.telefoon ?? "-"}</dd>
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
            <dd>{customer?.notities ?? "-"}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
