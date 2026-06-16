import { Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatLineType,
  formatMeasurementCalculationType,
  formatMeasurementProductGroup,
  formatUnit
} from "../../lib/i18n/statusLabels";
import { calculateIncVat, formatEuro, roundMoney } from "../../lib/money";
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  QuoteLineType
} from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { Card } from "../ui/data-display/Card";
import { Checkbox } from "../ui/forms/Checkbox";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { EmptyState } from "../ui/feedback/EmptyState";
import { LoadingState } from "../ui/feedback/LoadingState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { StatusBadge } from "../ui/data-display/StatusBadge";

type MeasurementLinePickerProps = {
  tenantSlug: string;
  quoteId: string;
  projectId: string;
  session: AppSession;
  startSortOrder: number;
  onImported?: () => Promise<void> | void;
  mode?: "full" | "field";
};

type ReadyMeasurement = {
  _id: string;
};

type ReadyRoom = {
  _id: string;
  projectRuimteId?: string;
  naam: string;
  oppervlakteM2?: number;
  omtrekM?: number;
};

type ReadyLine = {
  _id: string;
  ruimteId?: string;
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  invoer: Record<string, unknown>;
  resultaat: Record<string, unknown>;
  snijverliesPct?: number;
  aantal: number;
  eenheid: string;
  notities?: string;
  offerteRegelType: QuoteLineType;
  productId?: string;
  productNaam?: string;
  indicatieveEenheidsprijsExBtw?: number;
  indicatiefBtwTarief?: number;
};

type ReadyMeasurementLine = {
  measurement: ReadyMeasurement;
  room?: ReadyRoom | null;
  line: ReadyLine;
};

type ReadyMeasurementResult = {
  measurement: ReadyMeasurement | null;
  readyLines: ReadyMeasurementLine[];
};

function formatNumber(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }

  return new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function buildLineTitle(item: ReadyMeasurementLine) {
  const parts = [
    formatMeasurementProductGroup(item.line.productGroep),
    formatMeasurementCalculationType(item.line.berekeningType),
    item.room?.naam
  ].filter(Boolean);

  return parts.join(" - ");
}

/** Richtprijs incl. btw uit het meetregel-snapshot, of null. */
function indicativeLineTotal(line: ReadyLine) {
  if (line.indicatieveEenheidsprijsExBtw === undefined || line.indicatiefBtwTarief === undefined) {
    return null;
  }

  return formatEuro(
    roundMoney(
      line.aantal * calculateIncVat(line.indicatieveEenheidsprijsExBtw, line.indicatiefBtwTarief)
    )
  );
}

export default function MeasurementLinePicker({
  tenantSlug,
  quoteId,
  projectId,
  session,
  startSortOrder,
  onImported,
  mode = "full"
}: MeasurementLinePickerProps) {
  const isFieldMode = mode === "field";
  const [readyLines, setReadyLines] = useState<ReadyMeasurementLine[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReadyLines = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await client.query(api.beheer.tenants.getBySlug, { slug: tenantSlug });
      const resolvedTenantId = String(tenant?._id ?? tenantSlug);

      const result = (await client.query(api.projecten.measurements.listReadyForQuoteByProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">,
        actor: {
          externalUserId: session.userId,
          authzToken: session.authzToken ?? ""
        }
      })) as ReadyMeasurementResult;

      setReadyLines(result.readyLines);
      setSelectedIds((current) =>
        current.filter((lineId) => result.readyLines.some((item) => item.line._id === lineId))
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Inmeetregels konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantSlug]);

  useEffect(() => {
    void loadReadyLines();
  }, [loadReadyLines]);

  const selectedLines = useMemo(
    () => readyLines.filter((item) => selectedIds.includes(item.line._id)),
    [readyLines, selectedIds]
  );

  const columns = useMemo<Array<DataTableColumn<ReadyMeasurementLine>>>(
    () => [
      {
        key: "select",
        header: "Selectie",
        width: "90px",
        render: (item) => (
          <Checkbox
            aria-label={`${buildLineTitle(item)} selecteren`}
            checked={selectedIds.includes(item.line._id)}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelectedIds((current) =>
                checked
                  ? [...current, item.line._id]
                  : current.filter((lineId) => lineId !== item.line._id)
              );
            }}
          />
        )
      },
      {
        key: "room",
        header: "Ruimte",
        priority: "primary",
        render: (item) => <strong>{item.room?.naam ?? "Geen ruimte"}</strong>
      },
      {
        key: "group",
        header: "Productgroep",
        render: (item) => formatMeasurementProductGroup(item.line.productGroep)
      },
      {
        key: "calculation",
        header: "Berekening",
        hideOnMobile: true,
        render: (item) => formatMeasurementCalculationType(item.line.berekeningType)
      },
      {
        key: "quantity",
        header: "Hoeveelheid",
        align: "right",
        render: (item) => (
          <span style={{ whiteSpace: "nowrap" }}>
            {formatNumber(item.line.aantal)} {formatUnit(item.line.eenheid)}
          </span>
        )
      },
      {
        key: "waste",
        header: "Snijverlies",
        align: "right",
        hideOnMobile: true,
        render: (item) =>
          item.line.snijverliesPct !== undefined ? `${item.line.snijverliesPct}%` : "-"
      },
      {
        key: "indicative",
        header: "Product / richtprijs",
        align: "right",
        render: (item) => {
          if (!item.line.productNaam) {
            return "-";
          }

          return (
            <div style={{ textAlign: "right" }}>
              <strong>{indicativeLineTotal(item.line) ?? "Nog geen prijs"}</strong>
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                {item.line.productNaam}
              </div>
            </div>
          );
        }
      },
      {
        key: "type",
        header: "Soort offertepost",
        hideOnMobile: true,
        render: (item) => formatLineType(item.line.offerteRegelType)
      },
      {
        key: "note",
        header: "Notitie",
        hideOnMobile: true,
        render: (item) => item.line.notities ?? "-"
      }
    ],
    [selectedIds]
  );

  async function importSelectedLines() {
    if (selectedLines.length === 0) {
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
      await client.mutation(api.portal.importMeasurementLinesToQuote, {
        tenantSlug,
        actor: mutationActorFromSession(session),
        quoteId,
        lineIds: selectedLines.map((item) => item.line._id as Id<"measurementLines">),
        startSortOrder
      });

      setSelectedIds([]);
      setConfirmOpen(false);
      showToast({ title: "Inmeetregels toegevoegd aan de offerte", tone: "success" });
      await loadReadyLines();
      await onImported?.();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeetregels konden niet volledig aan de offerte worden toegevoegd.");
    } finally {
      setIsSaving(false);
    }
  }

  const summaryLabel =
    readyLines.length === 0
      ? "Geen inmeetregels klaar voor offerte"
      : `${readyLines.length} inmeetregel${readyLines.length === 1 ? "" : "s"} klaar voor offerte`;

  return (
    <Card variant="info">
      <SectionHeader
        compact
        title={isFieldMode ? "Meetregels naar conceptofferte" : "Inmeting overnemen"}
        description={summaryLabel}
        actions={
          <Button
            leftIcon={<Ruler size={16} aria-hidden="true" />}
            onClick={() => setIsOpen((current) => !current)}
            variant="secondary"
          >
            {isOpen
              ? isFieldMode
                ? "Meetregels sluiten"
                : "Inmeting sluiten"
              : isFieldMode
                ? "Meetregels kiezen"
                : "Inmeting overnemen"}
          </Button>
        }
      />

      {error ? <Alert variant="danger" description={error} /> : null}

      {isOpen ? (
        <div className="grid" style={{ marginTop: 12 }}>
          <Alert
            variant="warning"
            title="Controleer de offerteposten"
            description={
              isFieldMode
                ? "Meetregels nemen hoeveelheden over; bij een gekozen product komt de richtprijs als voorinvulling mee. Controleer product en verkoopprijs bewust voordat je een klantversie gebruikt."
                : "Deze regels nemen hoeveelheden over; bij een gekozen product komt de richtprijs als voorinvulling mee. Controleer prijs, product en btw voordat je de offerte verstuurt."
            }
          />

          {isLoading ? (
            <LoadingState title="Inmeetregels laden" description="Klaargezette inmeetregels ophalen." />
          ) : readyLines.length === 0 ? (
            <EmptyState
              title="Geen inmeetregels klaar voor offerte"
              description={
                isFieldMode
                  ? "Zet bij Stap 3 van Inmeten eerst een meetregel klaar voor de conceptofferte."
                  : "Zet bij Inmeten eerst een regel klaar voor de offerte."
              }
            />
          ) : (
            <>
              <DataTable
                ariaLabel="Inmeetregels klaar voor offerte"
                columns={columns}
                density="compact"
                emptyTitle="Geen inmeetregels klaar voor offerte"
                getRowKey={(item) => item.line._id}
                mobileMode="cards"
                renderMobileCard={(item) => (
                  <div>
                    <div className="toolbar" style={{ justifyContent: "space-between" }}>
                      <Checkbox
                        aria-label={`${buildLineTitle(item)} selecteren`}
                        checked={selectedIds.includes(item.line._id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedIds((current) =>
                            checked
                              ? [...current, item.line._id]
                              : current.filter((lineId) => lineId !== item.line._id)
                          );
                        }}
                      />
                      <StatusBadge status="warning" label="Richtprijs" />
                    </div>
                    <strong>{buildLineTitle(item)}</strong>
                    <p className="muted">
                      {formatNumber(item.line.aantal)} {formatUnit(item.line.eenheid)}
                      {item.line.snijverliesPct !== undefined
                        ? ` · Snijverlies ${item.line.snijverliesPct}%`
                        : ""}
                    </p>
                    {item.line.productNaam ? (
                      <p>
                        {item.line.productNaam}
                        {" · "}
                        <strong>{indicativeLineTotal(item.line) ?? "Nog geen richtprijs"}</strong>
                        {indicativeLineTotal(item.line) ? (
                          <span className="muted"> (incl. btw, indicatief)</span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="muted">{item.line.notities ?? "Geen notitie"}</p>
                  </div>
                )}
                rows={readyLines}
              />

              <div className="toolbar">
                <span className="muted">
                  {selectedIds.length} geselecteerd
                </span>
                <Button
                  disabled={selectedIds.length === 0}
                  onClick={() => setSelectedIds(readyLines.map((item) => item.line._id))}
                  variant="secondary"
                >
                  Alles selecteren
                </Button>
                <Button
                  disabled={selectedIds.length === 0}
                  onClick={() => setSelectedIds([])}
                  variant="ghost"
                >
                  Selectie wissen
                </Button>
                <Button
                  disabled={selectedIds.length === 0}
                  onClick={() => setConfirmOpen(true)}
                  variant="primary"
                >
                  Toevoegen aan offerte
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Inmeetregels toevoegen aan offerte?"
        description={`Je voegt ${selectedLines.length} meetregel${
          selectedLines.length === 1 ? "" : "s"
        } toe als offerteregel. ${
          selectedLines.some((item) => item.line.productId)
            ? "Meetregels met een gekozen product nemen de richtprijs als voorinvulling mee; regels zonder product blijven leeg."
            : "Product, verkoopprijs en btw worden niet gekozen."
        } Controleer prijs, product en btw bewust voordat je de offerte verstuurt.`}
        confirmLabel="Toevoegen aan offerte"
        isBusy={isSaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void importSelectedLines()}
      />
    </Card>
  );
}
