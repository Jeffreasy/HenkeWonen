import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
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
import { ConfirmDialog } from "../ui/ConfirmDialog";
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
import { Textarea } from "../ui/Textarea";

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
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    displayName: "",
    email: "",
    phone: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    notes: ""
  });
  const [pendingCustomerStatus, setPendingCustomerStatus] =
    useState<PortalCustomer["status"] | null>(null);
  const canAddContact = canEditDossiers(session.role);

  const loadDetail = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
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

  useEffect(() => {
    if (!detail?.customer) {
      return;
    }

    setCustomerDraft({
      displayName: detail.customer.displayName,
      email: detail.customer.email ?? "",
      phone: detail.customer.phone ?? "",
      street: detail.customer.street ?? "",
      houseNumber: detail.customer.houseNumber ?? "",
      postalCode: detail.customer.postalCode ?? "",
      city: detail.customer.city ?? "",
      notes: detail.customer.notes ?? ""
    });
  }, [detail?.customer]);

  async function saveCustomer(event: { preventDefault(): void }) {
    event.preventDefault();

    if (!detail?.customer || !customerDraft.displayName.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateCustomer, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      customerId,
      type: detail.customer.type,
      status: detail.customer.status,
      displayName: customerDraft.displayName.trim(),
      email: customerDraft.email.trim() || undefined,
      phone: customerDraft.phone.trim() || undefined,
      street: customerDraft.street.trim() || undefined,
      houseNumber: customerDraft.houseNumber.trim() || undefined,
      postalCode: customerDraft.postalCode.trim() || undefined,
      city: customerDraft.city.trim() || undefined,
      notes: customerDraft.notes.trim() || undefined
    });
    setEditingCustomer(false);
    await loadDetail();
  }

  async function confirmCustomerStatus() {
    if (!detail?.customer || !pendingCustomerStatus) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateCustomer, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      customerId,
      type: detail.customer.type,
      displayName: detail.customer.displayName,
      email: detail.customer.email,
      phone: detail.customer.phone,
      street: detail.customer.street,
      houseNumber: detail.customer.houseNumber,
      postalCode: detail.customer.postalCode,
      city: detail.customer.city,
      notes: detail.customer.notes,
      status: pendingCustomerStatus
    });
    setPendingCustomerStatus(null);
    await loadDetail();
  }

  async function addContact(event: { preventDefault(): void }) {
    event.preventDefault();

    if (!contactTitle.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.createCustomerContact, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
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
      <ConfirmDialog
        open={Boolean(pendingCustomerStatus)}
        title={
          pendingCustomerStatus === "archived"
            ? "Klant archiveren?"
            : "Klant herstellen?"
        }
        description={
          pendingCustomerStatus === "archived"
            ? "De klant blijft bewaard, maar verdwijnt uit de dagelijkse werkvoorraad."
            : "De klant wordt weer actief zichtbaar in de werkvoorraad."
        }
        confirmLabel={pendingCustomerStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingCustomerStatus === "archived" ? "danger" : "warning"}
        onCancel={() => setPendingCustomerStatus(null)}
        onConfirm={() => void confirmCustomerStatus()}
      />
      <section className="grid three-column">
        <StatCard label="Projecten" value={projects.length} tone="info" />
        <StatCard label="Contactmomenten" value={contacts.length} />
        <StatCard
          label="Nog uitgeleend"
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
              <div className="toolbar">
                <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
                {canAddContact ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setEditingCustomer((current) => !current)}>
                      Bewerken
                    </Button>
                    <Button
                      size="sm"
                      variant={customer.status === "archived" ? "secondary" : "danger"}
                      onClick={() => setPendingCustomerStatus(customer.status === "archived" ? "active" : "archived")}
                    >
                      {customer.status === "archived" ? "Herstellen" : "Archiveren"}
                    </Button>
                  </>
                ) : null}
              </div>
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
              <strong>Notities en afspraken</strong>
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

      {canAddContact && editingCustomer ? (
        <section className="panel">
          <SectionHeader compact title="Klantgegevens aanpassen" description="Wijzig contactgegevens en notities voor dit klantdossier." />
          <form className="form-grid" onSubmit={saveCustomer}>
            <div className="grid two-column-even">
              <Field htmlFor="edit-customer-name" label="Naam" required>
                <Input
                  id="edit-customer-name"
                  value={customerDraft.displayName}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, displayName: event.target.value }))}
                  required
                />
              </Field>
              <Field htmlFor="edit-customer-phone" label="Telefoon">
                <Input
                  id="edit-customer-phone"
                  value={customerDraft.phone}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="edit-customer-email" label="E-mail">
                <Input
                  id="edit-customer-email"
                  value={customerDraft.email}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, email: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-customer-city" label="Plaats">
                <Input
                  id="edit-customer-city"
                  value={customerDraft.city}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, city: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid three-column">
              <Field htmlFor="edit-customer-street" label="Straat">
                <Input
                  id="edit-customer-street"
                  value={customerDraft.street}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, street: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-customer-house-number" label="Huisnummer">
                <Input
                  id="edit-customer-house-number"
                  value={customerDraft.houseNumber}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, houseNumber: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-customer-postal-code" label="Postcode">
                <Input
                  id="edit-customer-postal-code"
                  value={customerDraft.postalCode}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, postalCode: event.target.value }))}
                />
              </Field>
            </div>
            <Field htmlFor="edit-customer-notes" label="Notities">
              <Textarea
                id="edit-customer-notes"
                rows={4}
                value={customerDraft.notes}
                onChange={(event) => setCustomerDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </Field>
            <div className="toolbar">
              <Button leftIcon={<Save size={17} aria-hidden="true" />} type="submit" variant="primary">
                Klantgegevens opslaan
              </Button>
              <Button variant="secondary" onClick={() => setEditingCustomer(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {canAddContact ? (
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
            <Field htmlFor="contact-title" label="Korte omschrijving" required>
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
              Contactmoment opslaan
            </Button>
          </form>
        </section>
      ) : null}

      <div className="grid two-column">
        <section className="panel">
          <SectionHeader
            compact
            title="Contactmomenten"
            description="Interne notities, afspraken en klantcontacten."
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
                      { id: "title", label: "Contactmoment", value: contact.title },
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
