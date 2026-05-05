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
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  QuoteLineType
} from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Checkbox } from "../ui/Checkbox";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";
import type { QuoteLineFormValues } from "./QuoteLineEditor";

type MeasurementLinePickerProps = {
  tenantSlug: string;
  quoteId: string;
  projectId: string;
  session: AppSession;
  startSortOrder: number;
  onAddLine: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  onImported?: () => Promise<void> | void;
  mode?: "full" | "field";
};

type ReadyMeasurement = {
  _id: string;
};

type ReadyRoom = {
  _id: string;
  projectRoomId?: string;
  name: string;
  areaM2?: number;
  perimeterM?: number;
};

type ReadyLine = {
  _id: string;
  roomId?: string;
  productGroup: MeasurementProductGroup;
  calculationType: MeasurementCalculationType;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  wastePercent?: number;
  quantity: number;
  unit: string;
  notes?: string;
  quoteLineType: QuoteLineType;
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
    formatMeasurementProductGroup(item.line.productGroup),
    formatMeasurementCalculationType(item.line.calculationType),
    item.room?.name
  ].filter(Boolean);

  return parts.join(" - ");
}

function buildLineDescription(item: ReadyMeasurementLine) {
  const descriptionLines = [
    "Overgenomen uit inmeting.",
    "Richtprijs. Kies product, verkoopprijs en btw bewust voordat je de offerte verstuurt.",
    item.line.wastePercent !== undefined ? `Snijverlies: ${item.line.wastePercent}%.` : undefined,
    item.line.notes ? `Meetnotitie: ${item.line.notes}` : undefined
  ].filter(Boolean);

  return descriptionLines.join("\n");
}

function buildQuoteLine(
  item: ReadyMeasurementLine,
  sortOrder: number
): QuoteLineFormValues {
  return {
    projectRoomId: item.room?.projectRoomId,
    lineType: item.line.quoteLineType,
    title: buildLineTitle(item),
    description: buildLineDescription(item),
    quantity: item.line.quantity,
    unit: item.line.unit,
    unitPriceExVat: 0,
    vatRate: 0,
    sortOrder,
    metadata: {
      source: "measurement",
      measurementId: item.measurement._id,
      measurementLineId: item.line._id,
      measurementRoomId: item.room?._id,
      productGroup: item.line.productGroup,
      calculationType: item.line.calculationType,
      wastePercent: item.line.wastePercent,
      isIndicative: true,
      requiresManualProductReview: true,
      requiresManualPriceReview: true,
      requiresManualVatReview: true
    }
  };
}

export default function MeasurementLinePicker({
  tenantSlug,
  quoteId,
  projectId,
  session,
  startSortOrder,
  onAddLine,
  onImported,
  mode = "full"
}: MeasurementLinePickerProps) {
  const isFieldMode = mode === "field";
  const [tenantConvexId, setTenantConvexId] = useState<string | null>(null);
  const [readyLines, setReadyLines] = useState<ReadyMeasurementLine[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReadyLines = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await client.query(api.tenants.getBySlug, { slug: tenantSlug });
      const resolvedTenantId = String(tenant?._id ?? tenantSlug);
      setTenantConvexId(resolvedTenantId);

      const result = (await client.query(api.measurements.listReadyForQuoteByProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">
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
        render: (item) => <strong>{item.room?.name ?? "Geen ruimte"}</strong>
      },
      {
        key: "group",
        header: "Productgroep",
        render: (item) => formatMeasurementProductGroup(item.line.productGroup)
      },
      {
        key: "calculation",
        header: "Manier van berekenen",
        render: (item) => formatMeasurementCalculationType(item.line.calculationType)
      },
      {
        key: "quantity",
        header: "Hoeveelheid",
        align: "right",
        render: (item) => formatNumber(item.line.quantity)
      },
      {
        key: "unit",
        header: "Eenheid",
        render: (item) => formatUnit(item.line.unit)
      },
      {
        key: "waste",
        header: "Snijverlies",
        align: "right",
        hideOnMobile: true,
        render: (item) =>
          item.line.wastePercent !== undefined ? `${item.line.wastePercent}%` : "-"
      },
      {
        key: "type",
        header: "Soort offertepost",
        hideOnMobile: true,
        render: (item) => formatLineType(item.line.quoteLineType)
      },
      {
        key: "note",
        header: "Notitie",
        hideOnMobile: true,
        render: (item) => item.line.notes ?? "-"
      }
    ],
    [selectedIds]
  );

  async function importSelectedLines() {
    if (!tenantConvexId || selectedLines.length === 0) {
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
      for (const [index, item] of selectedLines.entries()) {
        const quoteLine = buildQuoteLine(item, startSortOrder + index);
        const quoteLineId = await onAddLine(quoteLine);

        if (!quoteLineId) {
          throw new Error("De offertepost is toegevoegd, maar de bevestiging kwam niet terug.");
        }

        await client.mutation(api.measurements.markMeasurementLineConverted, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session),
          lineId: item.line._id as Id<"measurementLines">,
          quoteId: quoteId as Id<"quotes">,
          quoteLineId: String(quoteLineId) as Id<"quoteLines">
        });
      }

      setSelectedIds([]);
      setConfirmOpen(false);
      setNotice("Inmeetregels toegevoegd aan de offerte.");
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

      {notice ? <Alert variant="success" description={notice} /> : null}
      {error ? <Alert variant="danger" description={error} /> : null}

      {isOpen ? (
        <div className="grid" style={{ marginTop: 12 }}>
          <Alert
            variant="warning"
            title="Controleer de offerteposten"
            description={
              isFieldMode
                ? "Meetregels nemen hoeveelheden over. Vul daarna product en verkoopprijs bewust aan voordat je een klantversie gebruikt."
                : "Deze regels nemen alleen hoeveelheden en omschrijvingen over. Controleer prijs, product en btw voordat je de offerte verstuurt."
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
                      {formatNumber(item.line.quantity)} {formatUnit(item.line.unit)}
                      {item.line.wastePercent !== undefined
                        ? ` · Snijverlies ${item.line.wastePercent}%`
                        : ""}
                    </p>
                    <p className="muted">{item.line.notes ?? "Geen notitie"}</p>
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
        } toe als gewone offerteregel. Product, verkoopprijs en btw worden niet gekozen; vul die bewust aan voordat je de offerte verstuurt.`}
        confirmLabel="Toevoegen aan offerte"
        isBusy={isSaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void importSelectedLines()}
      />
    </Card>
  );
}
