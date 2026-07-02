import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { showErrorToast, showToast } from "../../lib/toast";
import { Alert } from "../ui/feedback/Alert";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { ServiceRuleForm } from "./ServiceRuleForm";
import { ServiceRulesTable } from "./ServiceRulesTable";
import { type ServiceRuleStatus, type ServiceRuleCalculationType, type ServiceRuleRow } from "./settings/settingsTypes";

type ServiceRulesSettingsProps = {
  session: AppSession;
};

export default function ServiceRulesSettings({ session }: ServiceRulesSettingsProps) {
  const [rules, setRules] = useState<ServiceRuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingRule, setEditingRule] = useState<ServiceRuleRow | null>(null);
  const [pendingRuleStatus, setPendingRuleStatus] = useState<{
    rule: ServiceRuleRow;
    nextStatus: ServiceRuleStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageRules = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient(session);

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

  async function handleSaveRule(data: {
    name: string;
    description: string;
    calculationType: ServiceRuleCalculationType;
    priceExVat: number;
    vatRate: number;
    status: ServiceRuleStatus;
  }) {
    if (!canManageRules) {
      return;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.portal.upsertServiceRule, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ruleId: editingRule?.id,
        naam: data.name,
        omschrijving: data.description || undefined,
        berekeningType: data.calculationType,
        prijsExBtw: data.priceExVat,
        btwTarief: data.vatRate,
        status: data.status
      });
      showToast({ title: editingRule ? "Werkzaamheid bijgewerkt" : "Werkzaamheid toegevoegd", description: data.name, tone: "success" });
      setEditingRule(null);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      showErrorToast(saveError, "Werkzaamheid kon niet worden opgeslagen");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmRuleStatus() {
    if (!pendingRuleStatus || !canManageRules) {
      return;
    }

    const { rule, nextStatus } = pendingRuleStatus;
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.portal.upsertServiceRule, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ruleId: rule.id,
        naam: rule.name,
        omschrijving: rule.description,
        berekeningType: rule.calculationType,
        prijsExBtw: rule.priceExVat,
        btwTarief: rule.vatRate,
        status: nextStatus
      });
      setPendingRuleStatus(null);
      showToast({ title: nextStatus === "inactive" ? "Werkzaamheid gearchiveerd" : "Werkzaamheid hersteld", description: rule.name, tone: nextStatus === "inactive" ? "warning" : "success" });
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      showErrorToast(saveError, "Werkzaamheidstatus kon niet worden bijgewerkt");
    } finally {
      setIsSaving(false);
    }
  }

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
      {error ? <Alert variant="danger" description={error} /> : null}

      {canManageRules ? (
        <ServiceRuleForm
          rule={editingRule}
          isSaving={isSaving}
          onCancel={() => setEditingRule(null)}
          onSave={handleSaveRule}
        />
      ) : null}

      <ServiceRulesTable
        rules={rules}
        isLoading={isLoading}
        error={error}
        canManage={canManageRules}
        onEdit={setEditingRule}
        onArchive={(rule) => setPendingRuleStatus({ rule, nextStatus: "inactive" })}
        onRestore={(rule) => setPendingRuleStatus({ rule, nextStatus: "active" })}
      />
    </div>
  );
}
