import { Archive, Pencil, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

type ServiceRulesSettingsProps = {
  session: AppSession;
};

type ServiceRuleStatus = "active" | "inactive";
type ServiceRuleCalculationType =
  | "fixed"
  | "per_m2"
  | "per_meter"
  | "per_roll"
  | "per_side"
  | "per_staircase"
  | "manual";

type ServiceRuleRow = {
  id: string;
  name: string;
  description?: string;
  calculationType: ServiceRuleCalculationType;
  priceExVat: number;
  vatRate: number;
  status: ServiceRuleStatus;
};

const calculationTypes: ServiceRuleCalculationType[] = [
  "fixed",
  "per_m2",
  "per_meter",
  "per_roll",
  "per_side",
  "per_staircase",
  "manual"
];

function optionalNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ServiceRulesSettings({ session }: ServiceRulesSettingsProps) {
  const [rules, setRules] = useState<ServiceRuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingRule, setEditingRule] = useState<ServiceRuleRow | null>(null);
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    description: "",
    calculationType: "fixed" as ServiceRuleCalculationType,
    priceExVat: "",
    vatRate: "21",
    status: "active" as ServiceRuleStatus
  });
  const [pendingRuleStatus, setPendingRuleStatus] = useState<{
    rule: ServiceRuleRow;
    nextStatus: ServiceRuleStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManageRules = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    const convexClient = client;

    async function loadRules() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await convexClient.query(api.portal.listServiceRules, {
          tenantSlug: session.tenantId
        });

        if (isActive) {
          setRules(result as ServiceRuleRow[]);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Werkzaamheden konden niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadRules();

    return () => {
      isActive = false;
    };
  }, [reloadKey, session.tenantId]);

  function resetDraft() {
    setEditingRule(null);
    setRuleDraft({
      name: "",
      description: "",
      calculationType: "fixed",
      priceExVat: "",
      vatRate: "21",
      status: "active"
    });
  }

  function startEditRule(rule: ServiceRuleRow) {
    setEditingRule(rule);
    setRuleDraft({
      name: rule.name,
      description: rule.description ?? "",
      calculationType: rule.calculationType,
      priceExVat: String(rule.priceExVat),
      vatRate: String(rule.vatRate),
      status: rule.status
    });
  }

  async function saveRule(event: SubmitEventLike) {
    event.preventDefault();

    if (!canManageRules || !ruleDraft.name.trim()) {
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
      await client.mutation(api.portal.upsertServiceRule, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ruleId: editingRule?.id,
        name: ruleDraft.name.trim(),
        description: ruleDraft.description.trim() || undefined,
        calculationType: ruleDraft.calculationType,
        priceExVat: optionalNumber(ruleDraft.priceExVat),
        vatRate: optionalNumber(ruleDraft.vatRate),
        status: ruleDraft.status
      });
      setNotice(editingRule ? "Werkzaamheid bijgewerkt." : "Werkzaamheid toegevoegd.");
      resetDraft();
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error(saveError);
      setError("Werkzaamheid kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmRuleStatus() {
    if (!pendingRuleStatus || !canManageRules) {
      return;
    }

    const { rule, nextStatus } = pendingRuleStatus;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.upsertServiceRule, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ruleId: rule.id,
        name: rule.name,
        description: rule.description,
        calculationType: rule.calculationType,
        priceExVat: rule.priceExVat,
        vatRate: rule.vatRate,
        status: nextStatus
      });
      setPendingRuleStatus(null);
      setNotice(nextStatus === "inactive" ? "Werkzaamheid gearchiveerd." : "Werkzaamheid hersteld.");
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error(saveError);
      setError("Werkzaamheidstatus kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ServiceRuleRow>> = [
    {
      key: "name",
      header: "Werkzaamheid",
      priority: "primary",
      render: (rule) => (
        <div className="stack-sm">
          <strong>{rule.name}</strong>
          {rule.description ? <small className="muted">{rule.description}</small> : null}
        </div>
      )
    },
    {
      key: "calculation",
      header: "Berekening",
      width: "150px",
      render: (rule) => formatStatusLabel(rule.calculationType)
    },
    {
      key: "price",
      header: "Prijs excl. btw",
      align: "right",
      width: "130px",
      render: (rule) => formatEuro(rule.priceExVat)
    },
    {
      key: "vat",
      header: "Btw",
      align: "right",
      width: "90px",
      render: (rule) => `${rule.vatRate}%`
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (rule) => <StatusBadge status={rule.status} label={formatStatusLabel(rule.status)} />
    },
    {
      key: "actions",
      header: "Acties",
      width: "190px",
      render: (rule) =>
        canManageRules ? (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => startEditRule(rule)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {rule.status === "inactive" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => setPendingRuleStatus({ rule, nextStatus: "active" })}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => setPendingRuleStatus({ rule, nextStatus: "inactive" })}
                size="sm"
                variant="danger"
              >
                Archiveren
              </Button>
            )}
          </div>
        ) : null
    }
  ];

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingRuleStatus)}
        title={
          pendingRuleStatus?.nextStatus === "inactive"
            ? "Werkzaamheid archiveren?"
            : "Werkzaamheid herstellen?"
        }
        description={
          pendingRuleStatus
            ? pendingRuleStatus.nextStatus === "inactive"
              ? `Je archiveert ${pendingRuleStatus.rule.name}. Historische offertes blijven intact.`
              : `Je herstelt ${pendingRuleStatus.rule.name} naar actief.`
            : ""
        }
        confirmLabel={pendingRuleStatus?.nextStatus === "inactive" ? "Archiveren" : "Herstellen"}
        tone={pendingRuleStatus?.nextStatus === "inactive" ? "danger" : "warning"}
        isBusy={isSaving}
        onCancel={() => setPendingRuleStatus(null)}
        onConfirm={() => void confirmRuleStatus()}
      />
      {notice ? <Alert variant="success" description={notice} /> : null}
      {error ? <Alert variant="danger" description={error} /> : null}

      {canManageRules ? (
        <section className="panel">
          <form className="form-grid" onSubmit={saveRule}>
            <SectionHeader
              compact
              title={editingRule ? "Werkzaamheid bewerken" : "Werkzaamheid toevoegen"}
              description="Beheer werkzaamheden die als offertepost of standaardregel gebruikt worden."
              actions={<StatusBadge status={ruleDraft.status} label={formatStatusLabel(ruleDraft.status)} />}
            />
            <div className="grid two-column-even">
              <Field htmlFor="service-rule-name" label="Naam" required>
                <Input
                  id="service-rule-name"
                  required
                  value={ruleDraft.name}
                  onChange={(event) =>
                    setRuleDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="service-rule-calculation" label="Berekening">
                <Select
                  id="service-rule-calculation"
                  value={ruleDraft.calculationType}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      calculationType: event.target.value as ServiceRuleCalculationType
                    }))
                  }
                >
                  {calculationTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field htmlFor="service-rule-description" label="Omschrijving">
              <Textarea
                id="service-rule-description"
                rows={3}
                value={ruleDraft.description}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <div className="grid three-column">
              <Field htmlFor="service-rule-price" label="Prijs excl. btw">
                <Input
                  id="service-rule-price"
                  inputMode="decimal"
                  value={ruleDraft.priceExVat}
                  onChange={(event) =>
                    setRuleDraft((current) => ({ ...current, priceExVat: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="service-rule-vat" label="Btw %">
                <Input
                  id="service-rule-vat"
                  inputMode="decimal"
                  value={ruleDraft.vatRate}
                  onChange={(event) =>
                    setRuleDraft((current) => ({ ...current, vatRate: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="service-rule-status" label="Status">
                <Select
                  id="service-rule-status"
                  value={ruleDraft.status}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      status: event.target.value as ServiceRuleStatus
                    }))
                  }
                >
                  <option value="active">{formatStatusLabel("active")}</option>
                  <option value="inactive">{formatStatusLabel("inactive")}</option>
                </Select>
              </Field>
            </div>
            <div className="toolbar">
              <Button
                isLoading={isSaving}
                leftIcon={<Save size={17} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Werkzaamheid opslaan
              </Button>
              {editingRule ? (
                <Button variant="secondary" onClick={resetDraft}>
                  Annuleren
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <DataTable
        ariaLabel="Werkzaamheden"
        columns={columns}
        density="compact"
        emptyDescription="Voeg de eerste werkzaamheid toe om offerteposten te standaardiseren."
        emptyTitle="Geen werkzaamheden"
        error={error}
        getRowKey={(rule) => rule.id}
        loading={isLoading}
        rows={rules}
      />
    </div>
  );
}
