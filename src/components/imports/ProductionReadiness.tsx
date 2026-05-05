import { RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checklist } from "../ui/Checklist";
import { StatCard } from "../ui/StatCard";
import { SummaryList } from "../ui/SummaryList";

type ProductionReadinessProps = {
  session: AppSession;
};

type ProductionReadinessResult = {
  vatMappings: {
    total: number;
    unresolved: number;
    resolved: number;
    allowUnknown: number;
  };
  duplicateEanIssues: {
    open: number;
  };
  latestImportRun: {
    sourceFiles: number;
    previewRows: number;
    productRows: number;
    priceRules: number;
    warningRows: number;
    errorRows: number;
    unknownVatModeRows: number;
    startedAt?: number;
    finishedAt?: number;
  };
  productionImportStatus: "BLOCKED" | "READY";
};

function numberText(value: number) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function dateText(value?: number) {
  if (!value || value === Number.MAX_SAFE_INTEGER) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function ProductionReadiness({ session }: ProductionReadinessProps) {
  const [readiness, setReadiness] = useState<ProductionReadinessResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReadiness = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.catalogReview.productionReadiness, {
        tenantSlug: session.tenantId
      })) as ProductionReadinessResult;

      setReadiness(result);
    } catch (loadError) {
      console.error(loadError);
      setError("De verwerkingscontrole kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  const isReady = readiness?.productionImportStatus === "READY";
  const unresolvedVatMappings = readiness?.vatMappings.unresolved ?? 0;
  const duplicateEanIssues = readiness?.duplicateEanIssues.open ?? 0;

  return (
    <section className={isReady ? "panel release-panel-ready" : "panel release-panel"}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Prijslijsten gereed?</p>
          <h2 style={{ margin: "4px 0 0" }}>
            {isReady ? "Prijslijsten mogen verwerkt worden" : "Eerst btw-keuzes afronden"}
          </h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {isReady
              ? "Alle harde blokkades zijn opgelost."
              : "Verwerken blijft geblokkeerd totdat alle btw-keuzes zijn afgerond."}
          </p>
        </div>
        <div className="toolbar">
          <Badge
            variant={isReady ? "success" : "danger"}
            icon={
              isReady ? (
                <ShieldCheck size={14} aria-hidden="true" />
              ) : (
                <ShieldAlert size={14} aria-hidden="true" />
              )
            }
          >
            {readiness ? (isReady ? "Gereed" : "Geblokkeerd") : isLoading ? "Laden" : "Onbekend"}
          </Badge>
          <Button
            leftIcon={<RefreshCw size={17} aria-hidden="true" />}
            variant="secondary"
            onClick={() => void loadReadiness()}
          >
            Verversen
          </Button>
        </div>
      </div>

      {error ? (
        <Alert
          variant="danger"
          title="Verwerkingscontrole niet geladen"
          description={error}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <div className="grid three-column" style={{ marginTop: 16 }}>
        <StatCard
          label="Btw-keuzes te controleren"
          value={numberText(unresolvedVatMappings)}
          description={unresolvedVatMappings > 0 ? "Eerst afronden" : "In orde"}
          tone={unresolvedVatMappings > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Dubbele EAN-waarschuwingen"
          value={numberText(duplicateEanIssues)}
          description={duplicateEanIssues > 0 ? "Waarschuwing, verwerken kan door" : "Geen open waarschuwingen"}
          tone={duplicateEanIssues > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Laatste controle: regels"
          value={numberText(readiness?.latestImportRun.previewRows ?? 0)}
          tone="info"
        />
      </div>

      <div className="grid three-column" style={{ marginTop: 16 }}>
        <StatCard
          label="Productregels"
          value={numberText(readiness?.latestImportRun.productRows ?? 0)}
        />
        <StatCard
          label="Prijsregels"
          value={numberText(readiness?.latestImportRun.priceRules ?? 0)}
        />
        <StatCard
          label="Prijslijstbestanden"
          value={numberText(readiness?.latestImportRun.sourceFiles ?? 0)}
          description={dateText(readiness?.latestImportRun.finishedAt)}
        />
      </div>

      <div className="grid two-column" style={{ marginTop: 16 }}>
        <div className="release-block">
          <Checklist
            title="Wat moet nog gebeuren?"
            items={[
              {
                label:
                  unresolvedVatMappings > 0
                    ? `${numberText(unresolvedVatMappings)} btw-keuzes ontbreken`
                    : "Alle btw-keuzes zijn gecontroleerd",
                description:
                  unresolvedVatMappings > 0
                    ? "Zet iedere prijskolom expliciet op inclusief of exclusief btw."
                    : "De prijslijstcontrole voldoet aan de verplichte btw-controle.",
                tone: unresolvedVatMappings > 0 ? "danger" : "success"
              },
              {
                label:
                  duplicateEanIssues > 0
                    ? `${numberText(duplicateEanIssues)} dubbele EAN-waarschuwingen open`
                    : "Geen open dubbele EAN-waarschuwingen",
                description:
                  "Dubbele EAN hoort bij de productcontrole en houdt verwerken niet automatisch tegen.",
                tone: duplicateEanIssues > 0 ? "warning" : "success"
              },
              {
                label: isReady ? "Prijslijsten klaar" : "Prijslijsten geblokkeerd",
                description: "Verwerken mag alleen als er geen ontbrekende btw-keuzes meer zijn.",
                tone: isReady ? "success" : "danger"
              }
            ]}
          />
        </div>
        <div className="release-block">
          <p className="checklist-title">Laatste controle</p>
          <SummaryList
            items={[
              {
                label: "Gecontroleerde regels",
                value: numberText(readiness?.latestImportRun.previewRows ?? 0)
              },
              {
                label: "Productregels",
                value: numberText(readiness?.latestImportRun.productRows ?? 0)
              },
              {
                label: "Prijsregels",
                value: numberText(readiness?.latestImportRun.priceRules ?? 0)
              },
              {
                label: "Prijslijstbestanden",
                value: numberText(readiness?.latestImportRun.sourceFiles ?? 0),
                description: dateText(readiness?.latestImportRun.finishedAt)
              }
            ]}
          />
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 16 }}>
        <a className="button primary" href="/portal/import-profielen">
          Btw-keuzes controleren
        </a>
        <a className="button secondary" href="/portal/catalogus/data-issues">
          Productcontrole openen
        </a>
        <a className="button secondary" href="/portal/imports">
          Prijslijsten bekijken
        </a>
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        Prijslijsten mogen pas definitief verwerkt worden als alle btw-keuzes inclusief of exclusief btw zijn.
        Dubbele EAN blijft zichtbaar als waarschuwing en wordt nooit automatisch samengevoegd.
      </p>
    </section>
  );
}
