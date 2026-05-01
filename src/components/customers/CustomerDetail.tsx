import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatCustomerStatus, formatProjectStatus } from "../../lib/i18n/statusLabels";
import type {
  PortalCustomer,
  PortalCustomerContact,
  PortalProject
} from "../../lib/portalTypes";
import { NoteVisibilityBadge } from "../common/NoteVisibilityBadge";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";

type CustomerDetailProps = {
  session: AppSession;
  customerId: string;
};

type CustomerDetailResult = {
  customer: PortalCustomer;
  projects: PortalProject[];
  contacts: PortalCustomerContact[];
} | null;

function dateText(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function contactTypeLabel(type: PortalCustomerContact["type"]) {
  const labels: Record<PortalCustomerContact["type"], string> = {
    note: "Notitie",
    call: "Telefoon",
    email: "E-mail",
    visit: "Bezoek",
    loaned_item: "Uitgeleend",
    agreement: "Afspraak"
  };

  return labels[type];
}

function loanStatus(contact: PortalCustomerContact) {
  if (contact.returnedAt) {
    return { label: "Teruggebracht", variant: "success" as const };
  }

  if (contact.expectedReturnDate && contact.expectedReturnDate < Date.now()) {
    return { label: "Retour verwacht", variant: "warning" as const };
  }

  return { label: "Uitgeleend", variant: "info" as const };
}

export default function CustomerDetail({ session, customerId }: CustomerDetailProps) {
  const [detail, setDetail] = useState<CustomerDetailResult>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactTitle, setContactTitle] = useState("");
  const [contactType, setContactType] =
    useState<PortalCustomerContact["type"]>("note");
  const [loanedItemName, setLoanedItemName] = useState("");

  const loadDetail = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.customerDetail, {
        tenantSlug: session.tenantId,
        customerId
      });

      setDetail(result as CustomerDetailResult);
    } catch (loadError) {
      console.error(loadError);
      setError("Klantdossier kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId, session.tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function addContact(event: { preventDefault(): void }) {
    event.preventDefault();

    if (!contactTitle.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    await client.mutation(api.portal.createCustomerContact, {
      tenantSlug: session.tenantId,
      customerId,
      type: contactType,
      title: contactTitle.trim(),
      loanedItemName:
        contactType === "loaned_item" ? loanedItemName.trim() || undefined : undefined,
      visibleToCustomer: false,
      createdByExternalUserId: session.userId
    });
    setContactTitle("");
    setLoanedItemName("");
    await loadDetail();
  }

  const projectColumns = useMemo<Array<DataTableColumn<PortalProject>>>(
    () => [
      {
        key: "project",
        header: "Project",
        priority: "primary",
        render: (project) => (
          <div className="stack-sm">
            <a href={`/portal/projecten/${project.id}`}>
              <strong>{project.title}</strong>
            </a>
            <small className="muted">{project.description ?? "Geen omschrijving"}</small>
          </div>
        )
      },
      {
        key: "status",
        header: "Status",
        width: "150px",
        render: (project) => (
          <StatusBadge status={project.status} label={formatProjectStatus(project.status)} />
        )
      },
      {
        key: "rooms",
        header: "Ruimtes",
        width: "90px",
        align: "right",
        render: (project) => project.rooms.length
      }
    ],
    []
  );

  const contactColumns = useMemo<Array<DataTableColumn<PortalCustomerContact>>>(
    () => [
      {
        key: "contact",
        header: "Moment",
        priority: "primary",
        render: (contact) => (
          <div className="stack-sm">
            <strong>{contact.title}</strong>
            {contact.description ? <small className="muted">{contact.description}</small> : null}
          </div>
        )
      },
      {
        key: "type",
        header: "Type",
        width: "130px",
        render: (contact) => (
          <Badge variant={contact.type === "loaned_item" ? "warning" : "neutral"}>
            {contactTypeLabel(contact.type)}
          </Badge>
        )
      },
      {
        key: "visibility",
        header: "Zichtbaarheid",
        width: "150px",
        hideOnMobile: true,
        render: (contact) => <NoteVisibilityBadge visibleToCustomer={contact.visibleToCustomer} />
      },
      {
        key: "date",
        header: "Datum",
        width: "110px",
        hideOnMobile: true,
        render: (contact) => dateText(contact.createdAt)
      }
    ],
    []
  );

  if (isLoading) {
    return <LoadingState title="Klantdossier laden" description="Klantgegevens ophalen." />;
  }

  if (error) {
    return <ErrorState title="Klantdossier niet geladen" description={error} />;
  }

  if (!detail) {
    return <EmptyState title="Klant niet gevonden" description="Controleer de link of ga terug naar klanten." />;
  }

  const { customer, projects, contacts } = detail;
  const loanedItems = contacts.filter((contact) => contact.type === "loaned_item");
  const openLoanedItems = loanedItems.filter((contact) => !contact.returnedAt);

  return (
    <div className="grid">
      <section className="grid three-column">
        <StatCard label="Projecten" value={projects.length} tone="info" />
        <StatCard label="Contactmomenten" value={contacts.length} />
        <StatCard
          label="Uitgeleend open"
          value={openLoanedItems.length}
          tone={openLoanedItems.length > 0 ? "warning" : "success"}
        />
      </section>

      <div className="grid two-column">
        <section className="panel">
          <SectionHeader
            compact
            title={customer.displayName}
            description={customer.type === "business" ? "Zakelijke klant" : "Particuliere klant"}
            actions={
              <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
            }
          />
          <SummaryList
            items={[
              { id: "email", label: "E-mail", value: customer.email ?? "-" },
              { id: "phone", label: "Telefoon", value: customer.phone ?? "-" },
              {
                id: "address",
                label: "Adres",
                value:
                  [customer.street, customer.houseNumber, customer.postalCode, customer.city]
                    .filter(Boolean)
                    .join(" ") || "-"
              },
              { id: "updated", label: "Bijgewerkt", value: dateText(customer.updatedAt) }
            ]}
          />
          {customer.notes ? (
            <Card className="dossier-note" variant="muted">
              <strong>Interne notities / afspraken</strong>
              <p className="muted">{customer.notes}</p>
            </Card>
          ) : null}
        </section>

        <section className="panel">
          <SectionHeader
            compact
            title="Projecten"
            description="Open projectdossiers vanuit deze klantcontext."
          />
          <DataTable
            ariaLabel="Projecten van klant"
            columns={projectColumns}
            density="compact"
            emptyDescription="Maak vanuit projecten een nieuw traject aan voor deze klant."
            emptyTitle="Nog geen projecten"
            getRowKey={(project) => project.id}
            rows={projects}
          />
        </section>
      </div>

      <section className="panel">
        <SectionHeader
          compact
          title="Contactmoment toevoegen"
          description="Registreer afspraken, notities en uitgeleende stalen of boeken."
        />
        <form className="responsive-form-row" onSubmit={addContact}>
          <Field htmlFor="contact-type" label="Type">
            <Select
              id="contact-type"
              value={contactType}
              onChange={(event) =>
                setContactType(event.target.value as PortalCustomerContact["type"])
              }
            >
              <option value="note">Notitie</option>
              <option value="call">Telefoon</option>
              <option value="email">E-mail</option>
              <option value="visit">Bezoek</option>
              <option value="agreement">Afspraak</option>
              <option value="loaned_item">Uitgeleend</option>
            </Select>
          </Field>
          <Field htmlFor="contact-title" label="Titel" required>
            <Input
              id="contact-title"
              value={contactTitle}
              onChange={(event) => setContactTitle(event.target.value)}
              required
            />
          </Field>
          <Field htmlFor="loaned-item" label="Uitgeleend item">
            <Input
              disabled={contactType !== "loaned_item"}
              id="loaned-item"
              value={loanedItemName}
              onChange={(event) => setLoanedItemName(event.target.value)}
            />
          </Field>
          <Button
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Opslaan
          </Button>
        </form>
      </section>

      <div className="grid two-column">
        <section className="panel">
          <SectionHeader
            compact
            title="Contactmomenten"
            description="Interne dossierregels en klantcontacten."
          />
          <DataTable
            ariaLabel="Contactmomenten"
            columns={contactColumns}
            density="compact"
            emptyDescription="Voeg hierboven een eerste contactmoment toe."
            emptyTitle="Nog geen contactmomenten"
            getRowKey={(contact) => contact.id}
            rows={contacts}
          />
        </section>

        <section className="panel">
          <SectionHeader
            compact
            title="Uitgeleende items"
            description="Stalen, boeken of materialen die terug verwacht worden."
          />
          <div className="grid">
            {loanedItems.map((contact) => {
              const status = loanStatus(contact);

              return (
                <Card key={contact.id} padding="sm" variant={status.variant === "warning" ? "warning" : "default"}>
                  <div className="toolbar" style={{ justifyContent: "space-between" }}>
                    <strong>{contact.loanedItemName ?? contact.title}</strong>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <SummaryList
                    items={[
                      { id: "title", label: "Dossierregel", value: contact.title },
                      { id: "expected", label: "Retour verwacht", value: dateText(contact.expectedReturnDate) },
                      { id: "returned", label: "Teruggebracht", value: dateText(contact.returnedAt) }
                    ]}
                  />
                </Card>
              );
            })}
            {loanedItems.length === 0 ? (
              <EmptyState
                title="Geen uitgeleende items"
                description="Uitgeleende stalen of boeken verschijnen hier apart."
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
