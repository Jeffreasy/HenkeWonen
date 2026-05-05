import { Archive, Pencil, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatImportStatus,
  formatProductListStatus,
  formatStatusLabel
} from "../../lib/i18n/statusLabels";
import type { PortalSupplier, ProductListStatus } from "../../lib/portalTypes";
import type { SubmitEventLike } from "../../lib/events";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Input } from "../ui/Input";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

type SupplierWorkspaceProps = {
  session: AppSession;
};

type SupplierStatus = NonNullable<PortalSupplier["status"]>;

const PRODUCT_LIST_STATUSES: ProductListStatus[] = [
  "unknown",
  "requested",
  "received",
  "download_available",
  "not_available",
  "manual_only"
];
const SUPPLIER_STATUSES: SupplierStatus[] = ["active", "inactive", "archived"];

function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00`).getTime();
}

function toDateInputValue(value?: number): string {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

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

function productListTone(status: ProductListStatus) {
  if (status === "received") {
    return "success" as const;
  }

  if (status === "download_available") {
    return "info" as const;
  }

  if (status === "not_available") {
    return "danger" as const;
  }

  if (status === "requested" || status === "manual_only") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function isFollowUpStatus(status: ProductListStatus) {
  return status === "unknown" || status === "requested";
}

function supplierSearchText(supplier: PortalSupplier) {
  return [
    supplier.name,
    supplier.contactName,
    supplier.email,
    supplier.phone,
    supplier.notes,
    ...(supplier.sourceFileNames ?? []),
    formatProductListStatus(supplier.productListStatus)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function SupplierWorkspace({ session }: SupplierWorkspaceProps) {
  const [suppliers, setSuppliers] = useState<PortalSupplier[]>([]);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [productListStatus, setProductListStatus] = useState<ProductListStatus>("unknown");
  const [lastContactDate, setLastContactDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductListStatus | "all">("all");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<SupplierStatus | "all">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<PortalSupplier | null>(null);
  const [supplierDraft, setSupplierDraft] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    productListStatus: "unknown" as ProductListStatus,
    status: "active" as SupplierStatus,
    lastContactDate: "",
    expectedDate: "",
    notes: ""
  });
  const [pendingSupplierStatus, setPendingSupplierStatus] = useState<{
    supplier: PortalSupplier;
    nextStatus: SupplierStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.listSuppliers, {
        tenantSlug: session.tenantId
      });

      setSuppliers(result as PortalSupplier[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Leveranciers konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const summary = useMemo(() => {
    const available = suppliers.filter((supplier) =>
      ["received", "download_available"].includes(supplier.productListStatus)
    ).length;
    const followUp = suppliers.filter((supplier) => isFollowUpStatus(supplier.productListStatus))
      .length;
    const manual = suppliers.filter((supplier) =>
      ["not_available", "manual_only"].includes(supplier.productListStatus)
    ).length;
    const linkedProducts = suppliers.reduce(
      (total, supplier) => total + (supplier.activeProductCount ?? 0),
      0
    );
    const sourceFiles = suppliers.reduce(
      (total, supplier) => total + (supplier.sourceFileCount ?? 0),
      0
    );

    return { available, followUp, linkedProducts, manual, sourceFiles, total: suppliers.length };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" || supplier.productListStatus === statusFilter;
      const matchesSupplierStatus =
        supplierStatusFilter === "all" || (supplier.status ?? "active") === supplierStatusFilter;
      const matchesSearch =
        !normalizedSearch || supplierSearchText(supplier).includes(normalizedSearch);

      return matchesStatus && matchesSupplierStatus && matchesSearch;
    });
  }, [search, statusFilter, supplierStatusFilter, suppliers]);

  async function createSupplier(event: SubmitEventLike) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Vul minimaal een leveranciersnaam in.");
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.createSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        productListStatus,
        lastContactAt: fromDateInputValue(lastContactDate),
        expectedAt: fromDateInputValue(expectedDate)
      });
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setProductListStatus("unknown");
      setLastContactDate("");
      setExpectedDate("");
      setNotes("");
      setNotice("Leverancier opgeslagen.");
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      setError("Leverancier kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateSupplierStatus(supplier: PortalSupplier, nextStatus: ProductListStatus) {
    if (supplier.productListStatus === nextStatus) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(supplier.id);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.updateSupplierProductListStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: supplier.id,
        productListStatus: nextStatus
      });
      setNotice(`Prijslijststatus bijgewerkt voor ${supplier.name}.`);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      setError("Prijslijststatus kon niet worden bijgewerkt.");
    } finally {
      setSavingSupplierId(null);
    }
  }

  function startEditSupplier(supplier: PortalSupplier) {
    setEditingSupplier(supplier);
    setSupplierDraft({
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      productListStatus: supplier.productListStatus,
      status: supplier.status ?? "active",
      lastContactDate: toDateInputValue(supplier.lastContactAt),
      expectedDate: toDateInputValue(supplier.expectedAt),
      notes: supplier.notes ?? ""
    });
  }

  async function saveSupplier(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingSupplier || !supplierDraft.name.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(editingSupplier.id);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.updateSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: editingSupplier.id,
        name: supplierDraft.name.trim(),
        contactName: supplierDraft.contactName.trim() || undefined,
        email: supplierDraft.email.trim() || undefined,
        phone: supplierDraft.phone.trim() || undefined,
        notes: supplierDraft.notes.trim() || undefined,
        productListStatus: supplierDraft.productListStatus,
        lastContactAt: fromDateInputValue(supplierDraft.lastContactDate),
        expectedAt: fromDateInputValue(supplierDraft.expectedDate),
        status: supplierDraft.status
      });
      setNotice(`Leverancier ${supplierDraft.name.trim()} bijgewerkt.`);
      setEditingSupplier(null);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      setError("Leverancier kon niet worden bijgewerkt.");
    } finally {
      setSavingSupplierId(null);
    }
  }

  async function confirmSupplierStatus() {
    if (!pendingSupplierStatus) {
      return;
    }

    const { supplier, nextStatus } = pendingSupplierStatus;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(supplier.id);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.updateSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        notes: supplier.notes,
        productListStatus: supplier.productListStatus,
        lastContactAt: supplier.lastContactAt,
        expectedAt: supplier.expectedAt,
        status: nextStatus
      });
      setNotice(
        nextStatus === "archived"
          ? `Leverancier ${supplier.name} gearchiveerd.`
          : `Leverancier ${supplier.name} hersteld.`
      );
      setPendingSupplierStatus(null);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      setError("Leverancierstatus kon niet worden bijgewerkt.");
    } finally {
      setSavingSupplierId(null);
    }
  }

  const columns = useMemo<Array<DataTableColumn<PortalSupplier>>>(
    () => [
      {
        key: "name",
        header: "Leverancier",
        priority: "primary",
        render: (supplier) => (
          <div className="stack-sm">
            <strong>{supplier.name}</strong>
            <StatusBadge
              status={supplier.status ?? "active"}
              label={formatStatusLabel(supplier.status ?? "active")}
            />
            {supplier.notes ? <small className="muted">{supplier.notes}</small> : null}
          </div>
        )
      },
      {
        key: "status",
        header: "Status prijslijst",
        render: (supplier) => (
          <StatusBadge
            status={supplier.productListStatus}
            label={formatProductListStatus(supplier.productListStatus)}
            variant={productListTone(supplier.productListStatus)}
          />
        )
      },
      {
        key: "contact",
        header: "Contact",
        render: (supplier) => (
          <div className="stack-sm">
            <span>{supplier.contactName ?? "-"}</span>
            <small className="muted">{supplier.email ?? supplier.phone ?? "Geen contactgegevens"}</small>
          </div>
        )
      },
      {
        key: "dates",
        header: "Opvolging",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>Laatst: {dateText(supplier.lastContactAt)}</span>
            <small className="muted">Verwacht: {dateText(supplier.expectedAt)}</small>
          </div>
        )
      },
      {
        key: "links",
        header: "Gekoppelde gegevens",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>{supplier.activeProductCount ?? 0} producten</span>
            <small className="muted">
              {supplier.importProfileCount ?? 0} btw-controles ·{" "}
              {supplier.sourceFileCount ?? 0} prijslijstbestanden
            </small>
          </div>
        )
      },
      {
        key: "files",
        header: "Prijslijstbestanden",
        hideOnMobile: true,
        render: (supplier) => {
          const files = supplier.sourceFileNames ?? [];

          return files.length > 0 ? (
            <div className="supplier-file-list">
              {files.slice(0, 3).map((fileName) => (
                <small className="muted" key={fileName}>
                  {fileName}
                </small>
              ))}
              {files.length > 3 ? (
                <small className="muted">+{files.length - 3} extra bestanden</small>
              ) : null}
            </div>
          ) : (
            <span className="muted">Nog geen prijslijstbestand</span>
          );
        }
      },
      {
        key: "latest",
        header: "Laatste verwerking",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>
              {supplier.latestImportStatus
                ? formatImportStatus(supplier.latestImportStatus)
                : "Geen verwerking"}
            </span>
            <small className="muted">{dateText(supplier.latestImportAt)}</small>
          </div>
        )
      },
      {
        key: "action",
        header: "Prijslijst",
        render: (supplier) => (
          <Select
            aria-label={`Prijslijststatus bijwerken voor ${supplier.name}`}
            disabled={savingSupplierId === supplier.id}
            value={supplier.productListStatus}
            onChange={(event) =>
              void updateSupplierStatus(supplier, event.target.value as ProductListStatus)
            }
          >
            {PRODUCT_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatProductListStatus(status)}
              </option>
            ))}
          </Select>
        )
      },
      {
        key: "actions",
        header: "Acties",
        width: "190px",
        render: (supplier) => (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => startEditSupplier(supplier)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {(supplier.status ?? "active") === "archived" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => setPendingSupplierStatus({ supplier, nextStatus: "active" })}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => setPendingSupplierStatus({ supplier, nextStatus: "archived" })}
                size="sm"
                variant="danger"
              >
                Archiveren
              </Button>
            )}
          </div>
        )
      }
    ],
    [savingSupplierId]
  );

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingSupplierStatus)}
        title={
          pendingSupplierStatus?.nextStatus === "archived"
            ? "Leverancier archiveren?"
            : "Leverancier herstellen?"
        }
        description={
          pendingSupplierStatus
            ? pendingSupplierStatus.nextStatus === "archived"
              ? `Je archiveert ${pendingSupplierStatus.supplier.name}. Producten, imports en historie blijven bewaard.`
              : `Je herstelt ${pendingSupplierStatus.supplier.name} naar actief.`
            : ""
        }
        confirmLabel={pendingSupplierStatus?.nextStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingSupplierStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={Boolean(savingSupplierId)}
        onCancel={() => setPendingSupplierStatus(null)}
        onConfirm={() => void confirmSupplierStatus()}
      />
      <section className="grid dashboard-grid">
        <StatCard label="Totaal leveranciers" value={summary.total} tone="neutral" />
        <StatCard
          label="Productlijst beschikbaar"
          value={summary.available}
          description="Ontvangen of download beschikbaar"
          tone="success"
        />
        <StatCard
          label="Opvolging nodig"
          value={summary.followUp}
          description="Onbekend of opgevraagd"
          tone={summary.followUp > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Catalogusproducten"
          value={summary.linkedProducts}
          description={`${summary.sourceFiles} prijslijstbestanden gekoppeld`}
          tone="info"
        />
      </section>

      {notice ? <Alert variant="success" description={notice} /> : null}
      {error ? <Alert variant="danger" description={error} /> : null}

      {editingSupplier ? (
        <Card>
          <form className="form-grid" onSubmit={saveSupplier}>
            <SectionHeader
              compact
              title="Leverancier bewerken"
              description="Beheer contactgegevens, opvolging en zichtbaarheid van deze leverancier."
              actions={
                <StatusBadge
                  status={supplierDraft.status}
                  label={formatStatusLabel(supplierDraft.status)}
                />
              }
            />
            <div className="grid two-column-even">
              <Field htmlFor="supplier-edit-name" label="Naam" required>
                <Input
                  id="supplier-edit-name"
                  required
                  value={supplierDraft.name}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="supplier-edit-status" label="Leverancierstatus">
                <Select
                  id="supplier-edit-status"
                  value={supplierDraft.status}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({
                      ...current,
                      status: event.target.value as SupplierStatus
                    }))
                  }
                >
                  {SUPPLIER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-edit-contact" label="Contactpersoon">
                <Input
                  id="supplier-edit-contact"
                  value={supplierDraft.contactName}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({
                      ...current,
                      contactName: event.target.value
                    }))
                  }
                />
              </Field>
              <Field htmlFor="supplier-edit-product-list-status" label="Status prijslijst">
                <Select
                  id="supplier-edit-product-list-status"
                  value={supplierDraft.productListStatus}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({
                      ...current,
                      productListStatus: event.target.value as ProductListStatus
                    }))
                  }
                >
                  {PRODUCT_LIST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatProductListStatus(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-edit-email" label="E-mailadres">
                <Input
                  id="supplier-edit-email"
                  type="email"
                  value={supplierDraft.email}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="supplier-edit-phone" label="Telefoonnummer">
                <Input
                  id="supplier-edit-phone"
                  type="tel"
                  value={supplierDraft.phone}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-edit-last-contact" label="Laatste contact">
                <Input
                  id="supplier-edit-last-contact"
                  type="date"
                  value={supplierDraft.lastContactDate}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({
                      ...current,
                      lastContactDate: event.target.value
                    }))
                  }
                />
              </Field>
              <Field htmlFor="supplier-edit-expected" label="Verwacht op">
                <Input
                  id="supplier-edit-expected"
                  type="date"
                  value={supplierDraft.expectedDate}
                  onChange={(event) =>
                    setSupplierDraft((current) => ({
                      ...current,
                      expectedDate: event.target.value
                    }))
                  }
                />
              </Field>
            </div>
            <Field htmlFor="supplier-edit-notes" label="Notities">
              <Textarea
                id="supplier-edit-notes"
                rows={3}
                value={supplierDraft.notes}
                onChange={(event) =>
                  setSupplierDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </Field>
            <div className="toolbar">
              <Button
                isLoading={savingSupplierId === editingSupplier.id}
                leftIcon={<Save size={17} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Leverancier opslaan
              </Button>
              <Button variant="secondary" onClick={() => setEditingSupplier(null)}>
                Annuleren
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <section className="grid two-column">
        <Card>
          <form className="form-grid" onSubmit={createSupplier}>
            <SectionHeader
              compact
              title="Leverancier toevoegen"
              description="Leg contactgegevens en prijslijststatus vast voor opvolging."
            />
            <Field htmlFor="supplier-name" label="Naam" required>
              <Input
                id="supplier-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-contact" label="Contactpersoon">
                <Input
                  id="supplier-contact"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </Field>
              <Field htmlFor="supplier-status" label="Status prijslijst">
                <Select
                  id="supplier-status"
                  value={productListStatus}
                  onChange={(event) => setProductListStatus(event.target.value as ProductListStatus)}
                >
                  {PRODUCT_LIST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatProductListStatus(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-email" label="E-mailadres">
                <Input
                  id="supplier-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field htmlFor="supplier-phone" label="Telefoonnummer">
                <Input
                  id="supplier-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="supplier-last-contact" label="Laatste contact">
                <Input
                  id="supplier-last-contact"
                  type="date"
                  value={lastContactDate}
                  onChange={(event) => setLastContactDate(event.target.value)}
                />
              </Field>
              <Field htmlFor="supplier-expected" label="Verwacht op">
                <Input
                  id="supplier-expected"
                  type="date"
                  value={expectedDate}
                  onChange={(event) => setExpectedDate(event.target.value)}
                />
              </Field>
            </div>
            <Field htmlFor="supplier-notes" label="Notities">
              <Textarea
                id="supplier-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <div className="toolbar">
              <Button
                isLoading={isSaving}
                leftIcon={<Save size={17} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Leverancier opslaan
              </Button>
            </div>
          </form>
        </Card>

        <Card variant="info">
          <SectionHeader
            compact
            title="Opvolging"
            description="Gebruik de status om te zien welke leveranciers nog actie nodig hebben."
          />
          <div className="checklist" style={{ marginTop: 12 }}>
            <div className="checklist-item checklist-item-success">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Ontvangen of download beschikbaar</strong>
                <small>De prijslijst kan worden verwerkt of is al gekoppeld aan de catalogus.</small>
              </div>
            </div>
            <div className="checklist-item checklist-item-warning">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Opgevraagd of onbekend</strong>
                <small>Plan opvolging met de leverancier en vul eventueel de verwachte datum.</small>
              </div>
            </div>
            <div className="checklist-item checklist-item-danger">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Niet beschikbaar</strong>
                <small>Deze leverancier vraagt om handmatige verwerking of een later alternatief.</small>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <SectionHeader
          compact
          title="Leveranciersoverzicht"
          description="Zoek, filter en volg prijslijsten per leverancier."
        />
        <FilterBar
          search={
            <SearchInput
              aria-label="Zoeken in leveranciers"
              placeholder="Zoek op leverancier, contactpersoon of notitie"
              value={search}
              onChange={setSearch}
            />
          }
          filters={
            <>
              <Field htmlFor="supplier-visibility-filter" label="Leverancierstatus">
                <Select
                  id="supplier-visibility-filter"
                  value={supplierStatusFilter}
                  onChange={(event) =>
                    setSupplierStatusFilter(event.target.value as SupplierStatus | "all")
                  }
                >
                  <option value="all">Alle leverancierstatussen</option>
                  {SUPPLIER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="supplier-status-filter" label="Filter op prijslijststatus">
                <Select
                  id="supplier-status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ProductListStatus | "all")
                  }
                >
                  <option value="all">Alle prijslijststatussen</option>
                  {PRODUCT_LIST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatProductListStatus(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          }
        />
        <div style={{ marginTop: 16 }}>
          <DataTable
            ariaLabel="Leveranciers"
            columns={columns}
            density="compact"
            emptyDescription={
              search || statusFilter !== "all"
                ? "Pas de zoekterm of statusfilter aan om meer leveranciers te tonen."
                : "Voeg een leverancier toe om productlijsten en opvolging te beheren."
            }
            emptyTitle={search || statusFilter !== "all" ? "Geen leveranciers gevonden" : "Nog geen leveranciers toegevoegd"}
            error={error}
            getRowKey={(supplier) => supplier.id}
            loading={isLoading}
            mobileMode="cards"
            renderMobileCard={(supplier) => (
              <div>
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    <strong>{supplier.name}</strong>
                    <span className="muted">
                      {supplier.contactName ?? supplier.email ?? "Geen contactgegevens"}
                    </span>
                  </div>
                  <StatusBadge
                    status={supplier.productListStatus}
                    label={formatProductListStatus(supplier.productListStatus)}
                    variant={productListTone(supplier.productListStatus)}
                  />
                </div>
                <div className="mobile-card-meta">
                  <span>{supplier.activeProductCount ?? 0} producten</span>
                  <span>{supplier.importProfileCount ?? 0} btw-controles</span>
                  <span>{supplier.sourceFileCount ?? 0} prijslijstbestanden</span>
                  <span>Verwacht: {dateText(supplier.expectedAt)}</span>
                </div>
                {(supplier.sourceFileNames ?? []).length > 0 ? (
                  <div className="mobile-card-section">
                    <p className="mobile-card-section-label">Prijslijstbestanden</p>
                    <div className="supplier-file-list">
                      {(supplier.sourceFileNames ?? []).slice(0, 3).map((fileName) => (
                        <small className="muted" key={fileName}>
                          {fileName}
                        </small>
                      ))}
                      {(supplier.sourceFileNames ?? []).length > 3 ? (
                        <small className="muted">
                          +{(supplier.sourceFileNames ?? []).length - 3} extra bestanden
                        </small>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {supplier.notes ? <p className="muted">{supplier.notes}</p> : null}
                <div className="mobile-card-actions">
                  <Select
                    aria-label={`Prijslijststatus bijwerken voor ${supplier.name}`}
                    disabled={savingSupplierId === supplier.id}
                    value={supplier.productListStatus}
                    onChange={(event) =>
                      void updateSupplierStatus(supplier, event.target.value as ProductListStatus)
                    }
                  >
                    {PRODUCT_LIST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatProductListStatus(status)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
            rows={filteredSuppliers}
          />
        </div>
      </Card>
    </div>
  );
}
