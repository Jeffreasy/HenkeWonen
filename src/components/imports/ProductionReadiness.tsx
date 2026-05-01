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
      setError("De gegevensverbinding is niet geconfigureerd.");
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
      setError("Productiegereedheid kon niet worden geladen.");
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
          <p className="eyebrow">Productiegereedheid</p>
          <h2 style={{ margin: "4px 0 0" }}>
            {isReady ? "Productie-import gereed" : "Productie-import geblokkeerd"}
          </h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {isReady
              ? "Alle harde releaseblokkades zijn opgelost."
              : "Productie-import is geblokkeerd totdat alle btw-mappings zijn opgelost."}
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
          title="Productiegereedheid niet geladen"
          description={error}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <div className="grid three-column" style={{ marginTop: 16 }}>
        <StatCard
          label="Btw-mappings te beoordelen"
          value={numberText(unresolvedVatMappings)}
          description={unresolvedVatMappings > 0 ? "Harde blokkade" : "Geen blokkade"}
          tone={unresolvedVatMappings > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Dubbele EAN-waarschuwingen"
          value={numberText(duplicateEanIssues)}
          description={duplicateEanIssues > 0 ? "Waarschuwing, geen blokkade" : "Geen open waarschuwingen"}
          tone={duplicateEanIssues > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Laatste voorvertoningsregels"
          value={numberText(readiness?.latestImportRun.previewRows ?? 0)}
          tone="info"
        />
      </div>

      <div className="grid three-column" style={{ marginTop: 16 }}>
        <StatCard
          label="Laatste productregels"
          value={numberText(readiness?.latestImportRun.productRows ?? 0)}
        />
        <StatCard
          label="Laatste prijsregels"
          value={numberText(readiness?.latestImportRun.priceRules ?? 0)}
        />
        <StatCard
          label="Bronbestanden"
          value={numberText(readiness?.latestImportRun.sourceFiles ?? 0)}
          description={dateText(readiness?.latestImportRun.finishedAt)}
        />
      </div>

      <div className="grid two-column" style={{ marginTop: 16 }}>
        <div className="release-block">
          <Checklist
            title="Wat blokkeert productie?"
            items={[
              {
                label:
                  unresolvedVatMappings > 0
                    ? `${numberText(unresolvedVatMappings)} btw-mappings ontbreken`
                    : "Alle btw-mappings zijn beoordeeld",
                description:
                  unresolvedVatMappings > 0
                    ? "Zet iedere prijskolom expliciet op inclusief of exclusief btw."
                    : "Productie-import voldoet aan de verplichte btw-controle.",
                tone: unresolvedVatMappings > 0 ? "danger" : "success"
              },
              {
                label:
                  duplicateEanIssues > 0
                    ? `${numberText(duplicateEanIssues)} dubbele EAN-waarschuwingen open`
                    : "Geen open dubbele EAN-waarschuwingen",
                description:
                  "Dubbele EAN is datakwaliteitscontrole en blokkeert de import niet automatisch.",
                tone: duplicateEanIssues > 0 ? "warning" : "success"
              },
              {
                label: isReady ? "Productie-import gereed" : "Productie-import geblokkeerd",
                description: "Gereed mag alleen als er geen ontbrekende btw-mappings meer zijn.",
                tone: isReady ? "success" : "danger"
              }
            ]}
          />
        </div>
        <div className="release-block">
          <p className="checklist-title">Laatste voorvertoning</p>
          <SummaryList
            items={[
              {
                label: "Voorvertoningsregels",
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
                label: "Bronbestanden",
                value: numberText(readiness?.latestImportRun.sourceFiles ?? 0),
                description: dateText(readiness?.latestImportRun.finishedAt)
              }
            ]}
          />
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 16 }}>
        <a className="button primary" href="/portal/import-profielen">
          Btw-mapping beoordelen
        </a>
        <a className="button secondary" href="/portal/catalogus/data-issues">
          Datakwaliteit bekijken
        </a>
        <a className="button secondary" href="/portal/imports">
          Importbatches bekijken
        </a>
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        Productie-import is pas gereed als alle btw-mappings inclusief of exclusief btw zijn.
        Dubbele EAN blijft zichtbaar als waarschuwing en wordt nooit automatisch samengevoegd.
      </p>
    </section>
  );
}
