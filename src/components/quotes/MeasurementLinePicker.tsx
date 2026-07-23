import { RefreshCw, Ruler } from "lucide-react";
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
  bundleId?: string;
  bundleType?: "stair_renovation";
  bundleRole?: "material" | "labor" | "surcharge";
  sectionKey?: string;
};

type ReadyMeasurementLine = {
  measurement: ReadyMeasurement;
  room?: ReadyRoom | null;
  line: ReadyLine;
};

type ReadyMeasurementResult = {
  measurement: ReadyMeasurement | null;
  readyLines: ReadyMeasurementLine[];
  /** Meetregels die nog in concept staan (niet klaargezet) — onzichtbaar in de picker. */
  draftLineCount?: number;
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

function bundleRoleLabel(role?: ReadyLine["bundleRole"]) {
  switch (role) {
    case "material":
      return "Materiaal";
    case "labor":
      return "Arbeid";
    case "surcharge":
      return "Toeslag";
    default:
      return null;
  }
}

function bundleContextLabel(line: ReadyLine) {
  if (!line.bundleId) {
    return null;
  }

  const bundle =
    line.bundleType === "stair_renovation" || line.sectionKey === "traprenovatie"
      ? "Traprenovatie"
      : "Bundel";
  const role = bundleRoleLabel(line.bundleRole);

  return role ? `${bundle} - ${role}` : bundle;
}

export function measurementLineSelectionIds(
  readyLines: ReadyMeasurementLine[],
  target: ReadyMeasurementLine
): string[] {
  if (!target.line.bundleId) {
    return [target.line._id];
  }

  return readyLines
    .filter((item) => item.line.bundleId === target.line.bundleId)
    .map((item) => item.line._id);
}

export function toggleMeasurementLineSelection(
  currentIds: string[],
  readyLines: ReadyMeasurementLine[],
  target: ReadyMeasurementLine,
  checked: boolean
): string[] {
  const next = new Set(currentIds);
  for (const lineId of measurementLineSelectionIds(readyLines, target)) {
    if (checked) next.add(lineId);
    else next.delete(lineId);
  }

  return readyLines.filter((item) => next.has(item.line._id)).map((item) => item.line._id);
}

function buildLineTitle(item: ReadyMeasurementLine) {
  const parts = [
    item.line.productNaam ?? formatMeasurementProductGroup(item.line.productGroep),
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
  const [draftLineCount, setDraftLineCount] = useState(0);
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
      setDraftLineCount(result.draftLineCount ?? 0);
      setSelectedIds((current) =>
        current.filter((lineId) => result.readyLines.some((item) => item.line._id === lineId))
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Inmeetregels konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
    // De sessiereferentie is stabiel binnen deze workspace; project en tenant bepalen herladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                toggleMeasurementLineSelection(current, readyLines, item, checked)
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
        render: (item) => (
          <div>
            <span>{formatMeasurementProductGroup(item.line.productGroep)}</span>
            {bundleContextLabel(item.line) ? (
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                {bundleContextLabel(item.line)}
              </div>
            ) : null}
          </div>
        )
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
    [readyLines, selectedIds]
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
          <div className="toolbar">
            {isOpen ? (
              <Button
                leftIcon={<RefreshCw size={15} aria-hidden="true" />}
                onClick={() => void loadReadyLines()}
                isLoading={isLoading}
                variant="ghost"
              >
                Verversen
              </Button>
            ) : null}
            <Button
              leftIcon={<Ruler size={16} aria-hidden="true" />}
              onClick={() =>
                setIsOpen((current) => {
                  const next = !current;
                  // Herlaad bij openen: in de buitendienst staan Inmeten en de
                  // conceptofferte op dezelfde pagina, dus net klaargezette regels
                  // moeten verschijnen zonder paginareload.
                  if (next) {
                    void loadReadyLines();
                  }
                  return next;
                })
              }
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
          </div>
        }
      />

      {error ? <Alert variant="danger" description={error} /> : null}

      {isOpen ? (
        <div className="grid" style={{ marginTop: 12 }}>
          {/* De picker toont alleen klaargezette regels; zonder deze telling ging een
              onvolledige offerte de deur uit terwijl er nog concept-meetregels bestonden. */}
          {draftLineCount > 0 ? (
            <Alert
              variant="warning"
              title={`${draftLineCount} meetregel${draftLineCount === 1 ? "" : "s"} nog niet klaargezet`}
              description={
                isFieldMode
                  ? "Deze regels staan nog in concept en komen niet in de offerte. Zet ze bij Inmeten eerst op 'klaar voor offerte', of laat ze bewust achterwege."
                  : "De inmeting bevat nog concept-regels die niet in deze lijst staan. Controleer bij Inmeten of ze klaargezet moeten worden voordat je de offerte verstuurt."
              }
            />
          ) : null}
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
            <DataTable
              ariaLabel="Inmeetregels klaar voor offerte"
              columns={columns}
              density="compact"
              getRowKey={(item) => item.line._id}
              loading
              rows={readyLines}
            />
          ) : readyLines.length === 0 ? (
            <EmptyState
              title="Geen inmeetregels klaar voor offerte"
              description={
                isFieldMode
                  ? "Zet bij Stap 2 - Inmeetregels eerst een meetregel klaar voor de conceptofferte."
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
                            toggleMeasurementLineSelection(current, readyLines, item, checked)
                          );
                        }}
                      />
                      <StatusBadge status="warning" label="Richtprijs" />
                    </div>
                    <strong>{buildLineTitle(item)}</strong>
                    {bundleContextLabel(item.line) ? (
                      <p className="muted" style={{ margin: "4px 0" }}>
                        {bundleContextLabel(item.line)}
                      </p>
                    ) : null}
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
                <span className="muted">{selectedIds.length} geselecteerd</span>
                <Button
                  // Uitgeschakeld als alles al geselecteerd is — NIET bij een lege
                  // selectie (dan is deze knop juist de bedoelde eerste klik).
                  disabled={readyLines.length === 0 || selectedIds.length === readyLines.length}
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
