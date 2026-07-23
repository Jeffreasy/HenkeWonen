import { CalendarClock, FileText, Pencil, Plus, Ruler, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { isUnitCompatible } from "../../../convex/catalog/pricingRules";
import type { SubmitEventLike } from "../../lib/events";
import { calculateIncVat, formatEuro, roundMoney } from "../../lib/money";
import { errorDescription, showToast } from "../../lib/toast";
import {
  MEASUREMENT_AUTOSTART_PARAM,
  measurementWorktypeFromSearch,
  shouldAutostartMeasurement
} from "../../lib/measurementIntent";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import {
  formatMeasurementProductGroup,
  formatMeasurementStatus,
  formatQuotePreparationStatus,
  formatUnit
} from "../../lib/i18n/statusLabels";
import type {
  MeasurementStatus,
  PortalProduct,
  QuotePreparationStatus
} from "../../lib/portalTypes";
import CatalogProductPicker from "../catalog/CatalogProductPicker";
import MeasurementAssignPanel from "./measurement/MeasurementAssignPanel";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { Card } from "../ui/data-display/Card";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { MeasurementSkeleton } from "./MeasurementSkeleton";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { Textarea } from "../ui/forms/Textarea";
import type {
  FieldMeasureTool,
  IndicativePriceResult,
  MeasurementData,
  MeasurementLineDoc,
  MeasurementRoomDoc,
  MeasurementPanelProps
} from "./measurement/measurementTypes";
import {
  decimalText,
  formatNumber,
  fromDateInputValue,
  parseDecimal,
  toDateInputValue
} from "./measurement/measurementUtils";

const FIELD_ROOM_PRESETS: Array<{ label: string; name: string }> = [
  { label: "Hal", name: "Hal" },
  { label: "Overloop", name: "Overloop" },
  { label: "Woonkamer", name: "Woonkamer" },
  { label: "Keuken", name: "Keuken" },
  { label: "Bijkeuken", name: "Bijkeuken" },
  { label: "Berging", name: "Berging" },
  { label: "Garage", name: "Garage" },
  { label: "Wc", name: "Wc" },
  { label: "Sk BG", name: "Sk BG" },
  { label: "Sk1", name: "Sk1" },
  { label: "Sk2", name: "Sk2" },
  { label: "Sk3", name: "Sk3" },
  { label: "Sk4", name: "Sk4" }
];

function measurementBundleRoleLabel(role?: MeasurementLineDoc["bundleRole"]) {
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

export default function MeasurementPanel({
  tenantId,
  projectId,
  customerId,
  session,
  mode = "full"
}: MeasurementPanelProps) {
  const [tenantConvexId, setTenantConvexId] = useState<string | null>(null);
  const [data, setData] = useState<MeasurementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditMeasurement = canEditDossiers(session.role);
  const isFieldMode = mode === "field";
  // Ruimtes die in het toewijs-paneel geselecteerd staan (controlled, zodat een
  // ruimtekaart met "+ toevoegen" er één kan voorselecteren).
  const [assignRoomIds, setAssignRoomIds] = useState<string[]>([]);
  // Samenvattingskaart: dicht in kantoormodus (het dossier-cockpit toont status/datums
  // al), open in de buitendienst waar er geen cockpit boven staat.
  const [summaryOpen, setSummaryOpen] = useState(mode === "field");

  const [measurementStatus, setMeasurementStatus] = useState<MeasurementStatus>("draft");
  const [measurementDate, setMeasurementDate] = useState("");
  const [measuredBy, setMeasuredBy] = useState("");
  const [measurementNotes, setMeasurementNotes] = useState("");

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineCorrectionDraft, setLineCorrectionDraft] = useState({
    roomId: "",
    quantity: "",
    unit: "",
    wastePercent: "",
    notes: "",
    quotePreparationStatus: "draft" as QuotePreparationStatus,
    productId: "",
    productName: "",
    indicativeUnitPriceExVat: undefined as number | undefined,
    indicativeVatRate: undefined as number | undefined,
    indicativePriceUnit: undefined as string | undefined,
    indicativePriceType: undefined as string | undefined,
    productTouched: false
  });
  const [pendingLineDelete, setPendingLineDelete] = useState<MeasurementLineDoc | null>(null);
  const priceRequestSeq = useRef<Partial<Record<FieldMeasureTool | "edit", number>>>({});

  const [showPricesIncVat, setShowPricesIncVat] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem("henke-richtprijs-btw-weergave") !== "exclusief";
  });
  const lineEditFormRef = useRef<HTMLFormElement>(null);
  const hasAutoStartedRef = useRef(false);

  const measurement = data?.measurement ?? null;
  const rooms = data?.rooms ?? [];
  const lines = data?.lines ?? [];
  const readyLineCount = lines.filter(
    (line) => line.quotePreparationStatus === "ready_for_quote"
  ).length;

  const loadMeasurement = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await client.query(api.beheer.tenants.getBySlug, { slug: tenantId });
      const resolvedTenantId = String(tenant?._id ?? tenantId);
      setTenantConvexId(resolvedTenantId);

      const result = await client.query(api.projecten.measurements.getForProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">,
        actor: mutationActorFromSession(session)
      });

      setData(result as MeasurementData);
    } catch (loadError) {
      console.error(loadError);
      setError("Inmeting kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantId, session]);

  useEffect(() => {
    void loadMeasurement();
  }, [loadMeasurement]);

  // Snelroute "maten bekend": als de klant/dossier-aanmaak hierheen heeft doorgestuurd met de
  // intent-vlag, start de inmeting automatisch (status → measurement_planned via
  // startOrPlanMeasurement). Wacht tot de data geladen is zodat we weten of er al een inmeting is,
  // draait exact één keer, en wist daarna de vlag uit de URL zodat een refresh niets herstart.
  useEffect(() => {
    if (data === null) {
      return;
    }
    if (
      !shouldAutostartMeasurement({
        search: typeof window === "undefined" ? "" : window.location.search,
        hasMeasurement: Boolean(measurement),
        canEdit: canEditMeasurement,
        alreadyAutostarted: hasAutoStartedRef.current
      })
    ) {
      return;
    }

    hasAutoStartedRef.current = true;

    void (async () => {
      const client = createConvexHttpClient(session);

      if (client) {
        try {
          // Geen monteur toewijzen bij het starten: de inmeting krijgt pas een monteur
          // (naam + stabiele userId) wanneer de inmeetafspraak via de plan-modal wordt ingepland.
          await client.mutation(api.portal.startOrPlanMeasurement, {
            tenantSlug: tenantId,
            actor: mutationActorFromSession(session),
            projectId
          });
          await loadMeasurement();
        } catch (autostartError) {
          console.error(autostartError);
          setError(
            "Inmeting kon niet automatisch worden gestart. Start handmatig met 'Inmeting starten'."
          );
        }
      }

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete(MEASUREMENT_AUTOSTART_PARAM);
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    })();
  }, [data, measurement, canEditMeasurement, loadMeasurement, projectId, session, tenantId]);

  useAutoFocusPanel(Boolean(editingLineId), lineEditFormRef);

  useEffect(() => {
    if (!measurement) {
      return;
    }

    setMeasurementStatus(measurement.status);
    setMeasurementDate(toDateInputValue(measurement.inmeetdatum));
    setMeasuredBy(measurement.gemetenDoor ?? "");
    setMeasurementNotes(measurement.notities ?? "");
  }, [measurement]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "henke-richtprijs-btw-weergave",
        showPricesIncVat ? "inclusief" : "exclusief"
      );
    } catch {
      // localStorage kan ontbreken (privémodus) — weergavevoorkeur is niet kritiek.
    }
  }, [showPricesIncVat]);

  const fetchIndicativePrice = useCallback(
    async (productId: string, measurementUnit: string) => {
      const client = createConvexHttpClient(session);

      if (!client) {
        return null;
      }

      return (await client.query(api.catalog.pricing.getIndicativePrice, {
        tenantSlug: tenantId,
        productId: productId as Id<"products">,
        measurementUnit
      })) as IndicativePriceResult;
    },
    [session, tenantId]
  );

  /** Prijsresultaat van een tab, maar alleen als het bij het gekozen product hoort. */
  // Toon een richtprijs-snapshot alleen als de prijseenheid bij de regel-eenheid past.
  // Productprijzen zijn dat per constructie (incompatibele worden bij wijziging gewist); een
  // handmatig naar een andere eenheid gezette dienst-regel zou anders een misleidend bedrag
  // tonen. Matrix-prijzen en snapshots zonder eenheid worden vertrouwd.
  function indicativePriceTrusted(line: MeasurementLineDoc): boolean {
    return (
      line.indicatievePrijsSoort === "matrix" ||
      line.indicatievePrijsSoort === "service_rule" ||
      line.indicatievePrijsEenheid === undefined ||
      isUnitCompatible(line.eenheid, line.indicatievePrijsEenheid)
    );
  }

  function lineIndicativeTotal(line: MeasurementLineDoc) {
    if (
      line.indicatieveEenheidsprijsExBtw === undefined ||
      line.indicatiefBtwTarief === undefined ||
      !indicativePriceTrusted(line)
    ) {
      return null;
    }

    const unitAmount = showPricesIncVat
      ? calculateIncVat(line.indicatieveEenheidsprijsExBtw, line.indicatiefBtwTarief)
      : line.indicatieveEenheidsprijsExBtw;

    return formatEuro(roundMoney(line.aantal * unitAmount));
  }

  /** Numerieke richtprijs van een regel (voor per-ruimte subtotalen). */
  function lineIndicativeAmount(line: MeasurementLineDoc): number | null {
    if (
      line.indicatieveEenheidsprijsExBtw === undefined ||
      line.indicatiefBtwTarief === undefined ||
      !indicativePriceTrusted(line)
    ) {
      return null;
    }
    const unitAmount = showPricesIncVat
      ? calculateIncVat(line.indicatieveEenheidsprijsExBtw, line.indicatiefBtwTarief)
      : line.indicatieveEenheidsprijsExBtw;
    return roundMoney(line.aantal * unitAmount);
  }

  /** Zachte hint: een ruimte met een vloer maar zonder legkost/plint. */
  function missingHint(roomLines: MeasurementLineDoc[]): string | null {
    const hasFloor = roomLines.some(
      (line) => line.productGroep === "flooring" && line.offerteRegelType === "product"
    );
    if (!hasFloor) return null;
    const tips: string[] = [];
    const hasService = roomLines.some(
      (line) => line.offerteRegelType === "service" || line.offerteRegelType === "labor"
    );
    if (!hasService) tips.push("legkosten/egaliseren");
    if (!roomLines.some((line) => line.productGroep === "plinths")) tips.push("plint");
    return tips.length > 0 ? `Tip: ${tips.join(" + ")} ontbreekt nog.` : null;
  }

  /** Selecteer één ruimte in het toewijs-paneel en scroll ernaartoe. */
  function focusAssignForRoom(roomId: string) {
    setAssignRoomIds([roomId]);
    if (typeof document !== "undefined") {
      document
        .getElementById("assign-panel-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderRoomBlock(room: MeasurementRoomDoc | null, roomLines: MeasurementLineDoc[]) {
    const amounts = roomLines
      .map((line) => lineIndicativeAmount(line))
      .filter((value): value is number => value !== null);
    const subtotal = amounts.reduce((sum, value) => sum + value, 0);
    const hint = room ? missingHint(roomLines) : null;
    const dims = room
      ? [
          room.oppervlakteM2 ? `${formatNumber(room.oppervlakteM2)} m²` : null,
          room.omtrekM ? `omtrek ${formatNumber(room.omtrekM)} m` : null
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    return (
      <div
        key={room?._id ?? "no-room"}
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface-raised)",
          padding: "12px 16px"
        }}
      >
        <div
          className="toolbar"
          style={{ justifyContent: "space-between", alignItems: "baseline" }}
        >
          <strong>{room ? room.naam : "Zonder ruimte"}</strong>
          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
            {dims}
          </span>
        </div>
        {roomLines.length === 0 ? (
          <p className="muted" style={{ margin: "8px 0" }}>
            Nog geen producten of diensten.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 8,
              marginTop: 8
            }}
          >
            {roomLines.map((line) => {
              const total = lineIndicativeTotal(line);
              const bundleRole = measurementBundleRoleLabel(line.bundleRole);
              const bundleName =
                line.bundleType === "stair_renovation" || line.sectionKey === "traprenovatie"
                  ? "Traprenovatie"
                  : "Bundel";
              const bundleContext = line.bundleId
                ? `${bundleName}${bundleRole ? ` - ${bundleRole}` : ""}`
                : null;
              return (
                <div
                  key={line._id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-muted)",
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ fontWeight: 650, overflowWrap: "anywhere" }}>
                    {line.productNaam ?? formatMeasurementProductGroup(line.productGroep)}
                  </div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {formatNumber(line.aantal)} {formatUnit(line.eenheid)}
                    {total ? ` · ${total}` : ""}
                  </div>
                  {bundleContext ? (
                    <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                      {bundleContext}
                    </div>
                  ) : null}
                  <div
                    className="toolbar"
                    style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}
                  >
                    <StatusBadge
                      status={line.quotePreparationStatus}
                      label={formatQuotePreparationStatus(line.quotePreparationStatus)}
                    />
                    {line.handmatigAangepast ? (
                      <span
                        style={{
                          color: "var(--warning)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 700
                        }}
                      >
                        handmatig
                      </span>
                    ) : null}
                  </div>
                  {canEditMeasurement && line.quotePreparationStatus !== "converted" ? (
                    <div
                      className="toolbar"
                      style={{ gap: 4, flexWrap: "wrap", marginTop: "auto", paddingTop: 2 }}
                    >
                      {line.quotePreparationStatus === "draft" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isSaving}
                          onClick={() => void markLineReady(line._id)}
                        >
                          Naar offerte
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startEditLine(line)}
                        aria-label="Regel bewerken"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPendingLineDelete(line)}
                        aria-label="Regel verwijderen"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {hint ? (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "var(--text-xs)" }}>
            {hint}
          </p>
        ) : null}
        <div
          className="toolbar"
          style={{ justifyContent: "space-between", marginTop: 8, alignItems: "baseline" }}
        >
          {room && canEditMeasurement ? (
            <Button size="sm" variant="secondary" onClick={() => focusAssignForRoom(room._id)}>
              <Plus size={15} aria-hidden="true" /> Toevoegen aan deze ruimte
            </Button>
          ) : (
            <span />
          )}
          {amounts.length > 0 ? (
            <span style={{ fontSize: "var(--text-sm)" }}>
              Subtotaal <strong>{formatEuro(subtotal)}</strong>{" "}
              <span className="muted">
                ({showPricesIncVat ? "incl." : "excl."} btw, indicatief)
              </span>
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  /** Per-ruimte-overzicht: regels gegroepeerd per ruimte, met subtotaal en "wat mist". */
  function renderRoomGroupedLines() {
    const byRoom = new Map<string, MeasurementLineDoc[]>();
    const noRoom: MeasurementLineDoc[] = [];
    for (const line of lines) {
      if (line.ruimteId) {
        const arr = byRoom.get(line.ruimteId) ?? [];
        arr.push(line);
        byRoom.set(line.ruimteId, arr);
      } else {
        noRoom.push(line);
      }
    }

    if (rooms.length === 0 && noRoom.length === 0) {
      return (
        <EmptyState
          title="Nog geen ruimtes"
          description="Voeg eerst een ruimte met maten toe; koppel daarna producten en diensten."
        />
      );
    }

    return (
      <div className="grid" style={{ gap: 12 }}>
        {rooms.map((room) => renderRoomBlock(room, byRoom.get(room._id) ?? []))}
        {noRoom.length > 0 ? renderRoomBlock(null, noRoom) : null}
      </div>
    );
  }

  /** SummaryList-regels voor de live matrix-richtprijs (raambekleding). */
  function requireClientAndMeasurement() {
    const client = createConvexHttpClient(session);

    if (!client || !tenantConvexId || !measurement) {
      setError("Inmeting is nog niet beschikbaar.");
      return null;
    }

    return {
      client,
      tenantId: tenantConvexId as Id<"tenants">,
      measurementId: measurement._id as Id<"measurements">
    };
  }

  async function startMeasurement() {
    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client || !tenantConvexId) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Geen monteur toewijzen bij het starten (zie de plan-modal voor de monteur-toewijzing);
      // createdByExternalUserId legt wél vast wie de inmeting startte.
      await client.mutation(api.projecten.measurements.createForProject, {
        tenantId: tenantConvexId as Id<"tenants">,
        actor: mutationActorFromSession(session),
        projectId: projectId as Id<"projects">,
        klantId: customerId as Id<"customers">,
        createdByExternalUserId: session.userId
      });
      showToast({ title: "Inmeting gestart", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeting kon niet worden gestart.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMeasurementMeta(event: SubmitEventLike) {
    event.preventDefault();

    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context || !measurement) {
      return;
    }

    // Alleen de velden meesturen die t.o.v. de geladen inmeting ZIJN GEWIJZIGD.
    // Winkel en buitendienst werken elk op een eigen (one-shot geladen) kopie; alles
    // altijd meesturen betekende last-write-wins waarbij een verouderd leeg veld de
    // notities of monteursnaam van de ander stilletjes wiste.
    const wijzigingen: {
      status?: MeasurementStatus;
      inmeetdatum?: number | null;
      gemetenDoor?: string;
      notities?: string;
    } = {};
    if (measurementStatus !== measurement.status) {
      wijzigingen.status = measurementStatus;
    }
    if (measurementDate !== toDateInputValue(measurement.inmeetdatum)) {
      // Leeg veld = afspraak expliciet afzeggen (null; undefined valt uit de request).
      wijzigingen.inmeetdatum = fromDateInputValue(measurementDate) ?? null;
    }
    if (measuredBy.trim() !== (measurement.gemetenDoor ?? "")) {
      wijzigingen.gemetenDoor = measuredBy.trim();
    }
    if (measurementNotes.trim() !== (measurement.notities ?? "")) {
      wijzigingen.notities = measurementNotes.trim();
    }

    if (Object.keys(wijzigingen).length === 0) {
      showToast({ title: "Geen wijzigingen om op te slaan", tone: "info" });
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurement, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        ...wijzigingen
      });
      showToast({ title: "Inmeting bijgewerkt", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError(errorDescription(saveError) ?? "Inmeting kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markLineReady(lineId: string) {
    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const selectedLine = lines.find((line) => line._id === lineId);
      if (selectedLine?.bundleId) {
        const bundleLineCount = lines.filter(
          (line) => line.bundleId === selectedLine.bundleId
        ).length;
        await context.client.mutation(api.projecten.measurements.updateMeasurementLineStatus, {
          tenantId: context.tenantId,
          actor: mutationActorFromSession(session),
          lineId: selectedLine._id as Id<"measurementLines">,
          quotePreparationStatus: "ready_for_quote"
        });
        showToast({
          title: `Trapbundel met ${bundleLineCount} meetregels klaargezet voor de offerte`,
          tone: "success"
        });
        await loadMeasurement();
        return;
      }

      await context.client.mutation(api.projecten.measurements.updateMeasurementLineStatus, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: lineId as Id<"measurementLines">,
        quotePreparationStatus: "ready_for_quote"
      });
      showToast({ title: "Inmeetregel klaargezet voor de offerte", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeetregel kon niet worden klaargezet.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditLine(line: MeasurementLineDoc) {
    setEditingLineId(line._id);
    setLineCorrectionDraft({
      roomId: line.ruimteId ?? "",
      quantity: decimalText(line.aantal),
      unit: line.eenheid,
      wastePercent: decimalText(line.snijverliesPct),
      notes: line.notities ?? "",
      quotePreparationStatus: line.quotePreparationStatus,
      productId: line.productId ?? "",
      productName: line.productNaam ?? "",
      indicativeUnitPriceExVat: line.indicatieveEenheidsprijsExBtw,
      indicativeVatRate: line.indicatiefBtwTarief,
      indicativePriceUnit: line.indicatievePrijsEenheid,
      indicativePriceType: line.indicatievePrijsSoort,
      productTouched: false
    });
  }

  /**
   * Productwissel in het editformulier: keuze direct vastleggen, richtprijs
   * async erbij (alleen voor weergave — bij opslaan wordt sowieso een verse
   * prijs opgehaald met de definitieve eenheid).
   */
  async function selectEditLineProduct(product: PortalProduct | null) {
    const requestSeq = (priceRequestSeq.current.edit ?? 0) + 1;
    priceRequestSeq.current.edit = requestSeq;

    setLineCorrectionDraft((current) => ({
      ...current,
      productId: product?.id ?? "",
      productName: product ? (product.weergaveNaam ?? product.naam) : "",
      indicativeUnitPriceExVat: undefined,
      indicativeVatRate: undefined,
      indicativePriceUnit: undefined,
      indicativePriceType: undefined,
      productTouched: true
    }));

    if (!product) {
      return;
    }

    let priceResult: IndicativePriceResult | null = null;

    try {
      priceResult = await fetchIndicativePrice(
        product.id,
        lineCorrectionDraft.unit.trim() || "custom"
      );
    } catch (priceError) {
      console.error(priceError);
    }

    if (priceRequestSeq.current.edit !== requestSeq) {
      return;
    }

    const indicative = priceResult?.indicative ?? null;

    setLineCorrectionDraft((current) => {
      if (current.productId !== product.id) {
        return current;
      }

      return {
        ...current,
        productName: priceResult?.productName ?? current.productName,
        indicativeUnitPriceExVat: indicative?.unitPriceExVat,
        indicativeVatRate: indicative?.vatRate,
        indicativePriceUnit: indicative?.priceUnit,
        indicativePriceType: indicative?.priceType
      };
    });
  }

  async function saveLineCorrection(event: SubmitEventLike) {
    event.preventDefault();

    const line = lines.find((item) => item._id === editingLineId);
    const context = requireClientAndMeasurement();

    if (!line || !context) {
      return;
    }

    const quantity = parseDecimal(lineCorrectionDraft.quantity);

    if (!quantity || quantity <= 0) {
      setError("Vul een geldige hoeveelheid in.");
      return;
    }
    if (line.bundleId && !Number.isInteger(quantity)) {
      setError("Gebruik voor PVC-trapmaterialen een heel aantal.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const finalUnit = lineCorrectionDraft.unit.trim() || line.eenheid;

    // Bij een gekozen product altijd een verse richtprijs ophalen met de
    // definitieve eenheid: dit voorkomt verouderde snapshots (eenheid gewijzigd
    // na productkeuze) én races met nog lopende weergave-lookups.
    let productArgs: Record<string, unknown> = {};

    if (line.offerteRegelType === "service" || line.offerteRegelType === "labor") {
      // De vaste dienstkoppeling en service_rule-snapshot blijven read-only behouden.
      productArgs = {};
    } else if (lineCorrectionDraft.productTouched && !lineCorrectionDraft.productId) {
      productArgs = { clearProduct: true };
    } else if (lineCorrectionDraft.productId) {
      let freshPrice: IndicativePriceResult | null = null;

      try {
        freshPrice = await fetchIndicativePrice(lineCorrectionDraft.productId, finalUnit);
      } catch (priceError) {
        console.error(priceError);
      }

      const indicative = freshPrice?.indicative ?? null;

      if (!freshPrice && !lineCorrectionDraft.productTouched) {
        // Lookup mislukt en de keuze is niet gewijzigd: niets meesturen, dan
        // behoudt de server het bestaande snapshot (incl. eenheid-guard).
        productArgs = {};
      } else {
        // Let op: de mutatie-args zijn Nederlands (indicativeSnapshotArgs in
        // convex/projecten/measurements.ts) — Engelse keys worden door de
        // Convex-validator geweigerd en laten de hele correctie falen.
        productArgs = {
          productId: lineCorrectionDraft.productId as Id<"products">,
          productNaam: freshPrice?.productName ?? (lineCorrectionDraft.productName || undefined),
          ...(indicative
            ? {
                indicatieveEenheidsprijsExBtw: indicative.unitPriceExVat,
                indicatiefBtwTarief: indicative.vatRate,
                indicatievePrijsEenheid: indicative.priceUnit,
                indicatievePrijsSoort: indicative.priceType,
                indicatiefVastgelegdOp: Date.now()
              }
            : {})
        };
      }
    }

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurementLine, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: line._id as Id<"measurementLines">,
        ruimteId: lineCorrectionDraft.roomId
          ? (lineCorrectionDraft.roomId as Id<"measurementRooms">)
          : undefined,
        productGroep: line.productGroep,
        berekeningType: line.berekeningType,
        invoer: line.invoer,
        resultaat: {
          ...line.resultaat,
          correctedQuantity: quantity,
          correctedAt: Date.now()
        },
        snijverliesPct: parseDecimal(lineCorrectionDraft.wastePercent),
        aantal: quantity,
        eenheid: finalUnit,
        notities: lineCorrectionDraft.notes.trim() || undefined,
        offerteRegelType: line.offerteRegelType,
        quotePreparationStatus: lineCorrectionDraft.quotePreparationStatus,
        // Handmatige correctie: deze regel niet meer automatisch herrekenen bij maatwijziging.
        handmatigAangepast: true,
        ...productArgs
      });
      showToast({ title: "Meetregel bijgewerkt", tone: "success" });
      setEditingLineId(null);
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetregel kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLineCorrection() {
    if (!pendingLineDelete) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.deleteMeasurementLine, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: pendingLineDelete._id as Id<"measurementLines">
      });
      showToast({
        title: pendingLineDelete.bundleId
          ? "Volledige PVC-trapbundel verwijderd"
          : "Meetregel verwijderd",
        tone: "warning"
      });
      setPendingLineDelete(null);
      await loadMeasurement();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Verwerkte meetregels kunnen niet direct worden verwijderd.");
      setPendingLineDelete(null);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <MeasurementSkeleton />;
  }

  if (error && !data) {
    return <ErrorState title="Inmeting niet geladen" description={error} />;
  }

  return (
    <section
      className={
        isFieldMode ? "measurement-panel measurement-panel-field" : "panel measurement-panel"
      }
    >
      <ConfirmDialog
        open={Boolean(pendingLineDelete)}
        title={
          pendingLineDelete?.bundleId
            ? "Volledige PVC-trapbundel verwijderen?"
            : "Meetregel verwijderen?"
        }
        description={
          pendingLineDelete?.bundleId
            ? "Deze regel hoort bij een berekende trapbundel. Materiaal, arbeid en eventuele toeslag worden samen uit de inmeting verwijderd. Verwerkte bundels blijven beschermd."
            : "De meetregel verdwijnt uit de inmeting. Verwerkte regels blijven beschermd."
        }
        confirmLabel={
          pendingLineDelete?.bundleId ? "Trapbundel verwijderen" : "Meetregel verwijderen"
        }
        tone="danger"
        isBusy={isSaving}
        onCancel={() => setPendingLineDelete(null)}
        onConfirm={() => void deleteLineCorrection()}
      />
      <SectionHeader
        compact
        title={isFieldMode ? "Meten bij de klant" : "Inmeting"}
        actions={
          measurement ? (
            <div
              className="measurement-stat-strip"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 14px",
                alignItems: "baseline",
                fontSize: "var(--text-sm)"
              }}
            >
              <StatusBadge
                status={measurement.status}
                label={formatMeasurementStatus(measurement.status)}
              />
              <span>
                <strong>{rooms.length}</strong> <span className="muted">ruimtes</span>
              </span>
              <span>
                <strong>{readyLineCount}</strong> <span className="muted">klaar voor offerte</span>
              </span>
            </div>
          ) : undefined
        }
      />

      {/* Inmeten → offerte: één klik vanaf de inmeting naar een nieuwe offerte (project
          voorgeselecteerd), zodra er regels klaarstaan. Voorkomt het terug-navigeren en
          opnieuw moeten bedenken dat er nog een offerte gemaakt moet worden. In de
          buitendienst staat de conceptofferte al op dezelfde pagina, dus daar niet. */}
      {!isFieldMode && measurement && readyLineCount > 0 ? (
        <a
          className="ui-button ui-button-primary ui-button-md measurement-make-quote"
          href={`/portal/offertes?open=nieuw&project=${projectId}`}
        >
          <FileText size={17} aria-hidden="true" />
          Maak offerte van deze inmeting ({readyLineCount} klaar)
        </a>
      ) : null}

      {error ? <Alert variant="danger" description={error} style={{ marginTop: 12 }} /> : null}

      {!measurement ? (
        <EmptyState
          title="Nog geen inmeting"
          description="Start een inmeting om ruimtes en indicatieve hoeveelheden vast te leggen."
          action={
            canEditMeasurement ? (
              <Button
                isLoading={isSaving}
                leftIcon={<Ruler size={17} aria-hidden="true" />}
                onClick={() => void startMeasurement()}
                variant="primary"
              >
                Inmeting starten
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid">
          <Card style={{ order: 9 }}>
            <details
              className="measurement-summary"
              open={summaryOpen}
              onToggle={(event) => setSummaryOpen(event.currentTarget.open)}
            >
              <summary className="measurement-summary-head">
                <span className="measurement-summary-title">Inmeting samenvatting</span>
                <StatusBadge
                  status={measurement.status}
                  label={formatMeasurementStatus(measurement.status)}
                />
              </summary>
              <form onSubmit={saveMeasurementMeta}>
                <p className="muted measurement-summary-desc">
                  Deze gegevens horen bij het projectdossier en wijzigen geen offerte.
                </p>
                <div className="responsive-form-row" style={{ marginTop: 12 }}>
                  <Field htmlFor="measurement-status" label="Status">
                    {/* 'Verwerkt naar offerte' wordt automatisch beheerd door de
                        offerte-import (en teruggedraaid als regels weer vrijkomen);
                        handmatig kiezen gaf tegenstrijdige signalen richting de
                        buitendienst-kaart. */}
                    {measurement.status === "converted_to_quote" ? (
                      <Select id="measurement-status" value="converted_to_quote" disabled>
                        <option value="converted_to_quote">
                          {formatMeasurementStatus("converted_to_quote")}
                        </option>
                      </Select>
                    ) : (
                      <Select
                        id="measurement-status"
                        value={measurementStatus}
                        onChange={(event) =>
                          setMeasurementStatus(event.target.value as MeasurementStatus)
                        }
                      >
                        {/* "Gecontroleerd" is de winkel-controlestap: de monteur mag
                            zijn eigen inmeting niet goedkeuren, alleen afronden. */}
                        {(mode === "field"
                          ? (["draft", "measured"] as const)
                          : (["draft", "measured", "reviewed"] as const)
                        ).map((status) => (
                          <option key={status} value={status}>
                            {formatMeasurementStatus(status)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field htmlFor="measurement-date" label="Inmeetdatum">
                    <Input
                      id="measurement-date"
                      type="date"
                      value={measurementDate}
                      onChange={(event) => setMeasurementDate(event.target.value)}
                    />
                  </Field>
                  <Field htmlFor="measured-by" label="Ingemeten door">
                    <Input
                      id="measured-by"
                      value={measuredBy}
                      onChange={(event) => setMeasuredBy(event.target.value)}
                    />
                  </Field>
                </div>
                <Field htmlFor="measurement-notes" label="Notities">
                  <Textarea
                    id="measurement-notes"
                    rows={3}
                    value={measurementNotes}
                    onChange={(event) => setMeasurementNotes(event.target.value)}
                  />
                </Field>
                <div className="toolbar" style={{ marginTop: 12 }}>
                  {canEditMeasurement ? (
                    <Button
                      isLoading={isSaving}
                      leftIcon={<CalendarClock size={16} aria-hidden="true" />}
                      type="submit"
                      variant="secondary"
                    >
                      Inmeting opslaan
                    </Button>
                  ) : null}
                </div>
              </form>
            </details>
          </Card>

          {canEditMeasurement && measurement && tenantConvexId ? (
            <section className="panel" id="assign-panel-section">
              <SectionHeader
                compact
                title="Stap 1 - Producten & diensten"
                description="Kies een product of dienst en pas het toe op de ruimtes — de hoeveelheid volgt uit de maten."
              />
              <MeasurementAssignPanel
                session={session}
                tenantSlug={tenantId}
                tenantConvexId={tenantConvexId}
                measurementId={measurement._id}
                rooms={rooms}
                canEdit={canEditMeasurement}
                selectedRoomIds={assignRoomIds}
                onSelectedRoomIdsChange={setAssignRoomIds}
                onAdded={loadMeasurement}
                roomPresets={FIELD_ROOM_PRESETS}
                initialAddType={
                  measurementWorktypeFromSearch(
                    typeof window === "undefined" ? "" : window.location.search
                  ) ?? undefined
                }
              />
            </section>
          ) : null}

          {renderMeasurementLinesCard()}
        </div>
      )}
    </section>
  );

  function renderMeasurementLinesCard() {
    const editingLine = lines.find((item) => item._id === editingLineId) ?? null;
    const editingLineUsesOrderableProduct =
      editingLine?.offerteRegelType === "product" || editingLine?.offerteRegelType === "material";
    const editingLineUsesServiceProduct =
      editingLine?.offerteRegelType === "service" || editingLine?.offerteRegelType === "labor";
    const editingLineIsStairBundle =
      editingLine?.bundleType === "stair_renovation" && Boolean(editingLine.bundleId);

    return (
      <Card>
        <SectionHeader
          compact
          title="Stap 2 - Inmeetregels"
          description={`Hoeveelheden voor de conceptofferte. Richtprijzen indicatief (${showPricesIncVat ? "incl." : "excl."} btw).`}
          actions={
            <Button
              size="sm"
              variant="secondary"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => setShowPricesIncVat((current) => !current)}
            >
              {showPricesIncVat ? "Excl. btw" : "Incl. btw"}
            </Button>
          }
        />
        {renderRoomGroupedLines()}
        {editingLineId ? (
          <form
            className="form-grid edit-work-panel"
            onSubmit={saveLineCorrection}
            ref={lineEditFormRef}
            style={{ marginTop: 16 }}
          >
            <SectionHeader
              compact
              title="Meetregel bewerken"
              description="Je past nu deze meetregel aan. Verwerkte regels blijven beschermd."
            />
            {editingLineIsStairBundle ? (
              <Alert
                variant="info"
                description="Deze regel hoort bij een berekende PVC-trapbundel. Product, hoeveelheid, ruimte en eenheid blijven gekoppeld aan het recept. Verwijder en bouw de bundel opnieuw via Inmeting > Trap om de samenstelling te wijzigen; een statuswijziging geldt voor de volledige bundel."
              />
            ) : null}
            <div className="grid three-column">
              <Field htmlFor="measurement-line-edit-room" label="Ruimte">
                <Select
                  id="measurement-line-edit-room"
                  disabled={editingLineIsStairBundle}
                  value={lineCorrectionDraft.roomId}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({
                      ...current,
                      roomId: event.target.value
                    }))
                  }
                >
                  <option value="">Algemene meting</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.naam}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="measurement-line-edit-quantity" label="Hoeveelheid" required>
                <Input
                  id="measurement-line-edit-quantity"
                  inputMode={editingLineIsStairBundle ? "numeric" : "decimal"}
                  disabled={editingLineIsStairBundle}
                  min={editingLineIsStairBundle ? 1 : undefined}
                  step={editingLineIsStairBundle ? 1 : "any"}
                  value={lineCorrectionDraft.quantity}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({
                      ...current,
                      quantity: event.target.value
                    }))
                  }
                  required
                />
              </Field>
              <Field htmlFor="measurement-line-edit-unit" label="Eenheid">
                <Input
                  id="measurement-line-edit-unit"
                  disabled={editingLineIsStairBundle}
                  value={lineCorrectionDraft.unit}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({ ...current, unit: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="measurement-line-edit-waste" label="Snijverlies %">
                <Input
                  id="measurement-line-edit-waste"
                  inputMode="decimal"
                  disabled={editingLineIsStairBundle}
                  value={lineCorrectionDraft.wastePercent}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({
                      ...current,
                      wastePercent: event.target.value
                    }))
                  }
                />
              </Field>
              <Field htmlFor="measurement-line-edit-status" label="Status">
                <Select
                  id="measurement-line-edit-status"
                  value={lineCorrectionDraft.quotePreparationStatus}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({
                      ...current,
                      quotePreparationStatus: event.target.value as QuotePreparationStatus
                    }))
                  }
                >
                  <option value="draft">Concept</option>
                  <option value="ready_for_quote">Klaar voor offerte</option>
                </Select>
              </Field>
            </div>
            {editingLineUsesOrderableProduct && !editingLineIsStairBundle ? (
              <>
                <SectionHeader
                  compact
                  title="Product en richtprijs"
                  description={
                    lineCorrectionDraft.productId
                      ? `Gekozen: ${lineCorrectionDraft.productName || "product"}${
                          lineCorrectionDraft.indicativeUnitPriceExVat !== undefined &&
                          lineCorrectionDraft.indicativeVatRate !== undefined
                            ? ` — richtprijs ${formatEuro(
                                showPricesIncVat
                                  ? calculateIncVat(
                                      lineCorrectionDraft.indicativeUnitPriceExVat,
                                      lineCorrectionDraft.indicativeVatRate
                                    )
                                  : lineCorrectionDraft.indicativeUnitPriceExVat
                              )} per ${formatUnit(lineCorrectionDraft.indicativePriceUnit ?? "custom")} (${
                                showPricesIncVat ? "incl." : "excl."
                              } btw, indicatief)`
                            : " — nog geen richtprijs beschikbaar"
                        }`
                      : "Geen product gekozen. Kies hieronder een product om een richtprijs vast te leggen."
                  }
                  actions={
                    lineCorrectionDraft.productId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void selectEditLineProduct(null)}
                      >
                        Productkeuze wissen
                      </Button>
                    ) : undefined
                  }
                />
                {(() => {
                  const editingLine = lines.find((item) => item._id === editingLineId);

                  return (
                    <CatalogProductPicker
                      session={session}
                      idPrefix="measure-edit"
                      scope="orderable"
                      productGroupHint={
                        editingLine && editingLine.productGroep !== "other"
                          ? editingLine.productGroep
                          : null
                      }
                      selectedProductId={lineCorrectionDraft.productId}
                      selectedProductLabel={lineCorrectionDraft.productName || undefined}
                      onSelect={(product) => void selectEditLineProduct(product)}
                      label="Product (optioneel)"
                      emptyOptionLabel="Geen product gekozen"
                    />
                  );
                })()}
              </>
            ) : editingLineUsesServiceProduct ? (
              <SectionHeader
                compact
                title="Dienstproduct"
                description={
                  lineCorrectionDraft.productId
                    ? `Gekoppelde dienst: ${lineCorrectionDraft.productName || "dienst"}. De dienstkoppeling blijft behouden; hier pas je alleen de meetregel aan.`
                    : "Handmatige dienstregel zonder vaste dienstkoppeling."
                }
              />
            ) : null}
            <Field htmlFor="measurement-line-edit-notes" label="Notitie">
              <Textarea
                id="measurement-line-edit-notes"
                rows={3}
                value={lineCorrectionDraft.notes}
                onChange={(event) =>
                  setLineCorrectionDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </Field>
            <div className="toolbar">
              <Button
                isLoading={isSaving}
                leftIcon={<Save size={16} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Meetregel opslaan
              </Button>
              <Button
                disabled={isSaving}
                variant="secondary"
                onClick={() => setEditingLineId(null)}
              >
                Annuleren
              </Button>
            </div>
          </form>
        ) : null}
      </Card>
    );
  }
}
