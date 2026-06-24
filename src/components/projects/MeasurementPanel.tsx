import { CalendarClock, Pencil, Plus, Ruler, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  calculatorForLine,
  deriveLineForRoom,
  paramsFromInvoer,
  type RoomDimensions
} from "../../lib/quotes/roomLineDerivation";
import { isUnitCompatible } from "../../../convex/catalog/pricingRules";
import type { SubmitEventLike } from "../../lib/events";
import { calculateIncVat, formatEuro, roundMoney } from "../../lib/money";
import { showToast } from "../../lib/toast";
import {
  MEASUREMENT_AUTOSTART_PARAM,
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
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { LoadingState } from "../ui/feedback/LoadingState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { StatCard } from "../ui/data-display/StatCard";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { SummaryList } from "../ui/data-display/SummaryList";
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
  dateText,
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

export default function MeasurementPanel({
  tenantId,
  projectId,
  customerId,
  projectRooms,
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

  const [projectRoomId, setProjectRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [roomWidthM, setRoomWidthM] = useState("");
  const [roomLengthM, setRoomLengthM] = useState("");
  const [roomHeightM, setRoomHeightM] = useState("");
  const [roomAreaM2, setRoomAreaM2] = useState("");
  const [roomPerimeterM, setRoomPerimeterM] = useState("");
  // Oppervlakte/omtrek lopen automatisch mee met lengte × breedte, tenzij de
  // gebruiker ze handmatig aanpast of een bestaande projectruimte kiest.
  const [roomAreaAutoFilled, setRoomAreaAutoFilled] = useState(true);
  const [roomPerimeterAutoFilled, setRoomPerimeterAutoFilled] = useState(true);
  const [roomNotes, setRoomNotes] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomCorrectionDraft, setRoomCorrectionDraft] = useState({
    name: "",
    floor: "",
    widthM: "",
    lengthM: "",
    heightM: "",
    areaM2: "",
    perimeterM: "",
    notes: ""
  });
  const [pendingRoomDelete, setPendingRoomDelete] = useState<MeasurementRoomDoc | null>(null);
  const [roomDeleteError, setRoomDeleteError] = useState<string | null>(null);

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
  const roomEditFormRef = useRef<HTMLFormElement>(null);
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

  useAutoFocusPanel(Boolean(editingRoomId), roomEditFormRef);
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

  const selectedRoomArea = useMemo(() => {
    const width = parseDecimal(roomWidthM);
    const length = parseDecimal(roomLengthM);

    return width && length ? width * length : undefined;
  }, [roomLengthM, roomWidthM]);

  const selectedRoomPerimeter = useMemo(() => {
    const width = parseDecimal(roomWidthM);
    const length = parseDecimal(roomLengthM);

    return width && length ? 2 * (width + length) : undefined;
  }, [roomLengthM, roomWidthM]);

  // Vul oppervlakte automatisch (lengte × breedte) zolang de gebruiker het veld niet
  // zelf heeft aangepast en geen bestaande ruimte met opgeslagen oppervlakte koos.
  useEffect(() => {
    if (!roomAreaAutoFilled) return;
    setRoomAreaM2(
      selectedRoomArea !== undefined ? String(Math.round(selectedRoomArea * 100) / 100) : ""
    );
  }, [roomAreaAutoFilled, selectedRoomArea]);

  useEffect(() => {
    if (!roomPerimeterAutoFilled) return;
    setRoomPerimeterM(
      selectedRoomPerimeter !== undefined
        ? String(Math.round(selectedRoomPerimeter * 100) / 100)
        : ""
    );
  }, [roomPerimeterAutoFilled, selectedRoomPerimeter]);

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
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-lg)",
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
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {roomLines.map((line) => {
              const total = lineIndicativeTotal(line);
              return (
                <div
                  key={line._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "center",
                    borderTop: "0.5px solid var(--color-border-tertiary)",
                    paddingTop: 6
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div>
                      {line.productNaam ?? formatMeasurementProductGroup(line.productGroep)}
                    </div>
                    <div
                      className="muted toolbar"
                      style={{ fontSize: "var(--text-xs)", gap: 6, alignItems: "center" }}
                    >
                      <span>
                        {formatNumber(line.aantal)} {formatUnit(line.eenheid)}
                        {total ? ` · ${total}` : ""}
                      </span>
                      <StatusBadge
                        status={line.quotePreparationStatus}
                        label={formatQuotePreparationStatus(line.quotePreparationStatus)}
                      />
                      {line.handmatigAangepast ? (
                        <span style={{ color: "var(--color-text-warning)" }}>· handmatig</span>
                      ) : null}
                    </div>
                  </div>
                  {canEditMeasurement && line.quotePreparationStatus !== "converted" ? (
                    <div className="toolbar" style={{ gap: 4, flexShrink: 0 }}>
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

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurement, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        status: measurementStatus,
        inmeetdatum: fromDateInputValue(measurementDate),
        gemetenDoor: measuredBy.trim(),
        notities: measurementNotes.trim()
      });
      showToast({ title: "Inmeting bijgewerkt", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeting kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addRoom(event: SubmitEventLike) {
    event.preventDefault();

    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context || !roomName.trim()) {
      return;
    }

    const widthM = parseDecimal(roomWidthM);
    const lengthM = parseDecimal(roomLengthM);
    const areaM2 = parseDecimal(roomAreaM2) ?? selectedRoomArea;
    const perimeterM = parseDecimal(roomPerimeterM) ?? selectedRoomPerimeter;

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.addMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        projectRuimteId: projectRoomId ? (projectRoomId as Id<"projectRooms">) : undefined,
        naam: roomName.trim(),
        verdieping: roomFloor.trim() || undefined,
        breedteM: widthM,
        lengteM: lengthM,
        hoogteM: parseDecimal(roomHeightM),
        oppervlakteM2: areaM2,
        omtrekM: perimeterM,
        notities: roomNotes.trim() || undefined
      });
      setProjectRoomId("");
      setRoomName("");
      setRoomFloor("");
      setRoomWidthM("");
      setRoomLengthM("");
      setRoomHeightM("");
      setRoomAreaM2("");
      setRoomPerimeterM("");
      setRoomAreaAutoFilled(true);
      setRoomPerimeterAutoFilled(true);
      setRoomNotes("");
      showToast({ title: "Ruimte toegevoegd aan de inmeting", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("De ruimte kon niet aan de inmeting worden toegevoegd.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addRoomByPreset(presetName: string) {
    if (!canEditMeasurement) return;

    const context = requireClientAndMeasurement();

    if (!context) return;

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.addMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        naam: presetName
      });
      showToast({ title: `${presetName} toegevoegd`, tone: "success" });
      await loadMeasurement();
    } catch {
      setError("Ruimte kon niet worden toegevoegd.");
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

  function startEditRoom(room: MeasurementRoomDoc) {
    setEditingRoomId(room._id);
    setRoomCorrectionDraft({
      name: room.naam,
      floor: room.verdieping ?? "",
      widthM: decimalText(room.breedteM),
      lengthM: decimalText(room.lengteM),
      heightM: decimalText(room.hoogteM),
      areaM2: decimalText(room.oppervlakteM2),
      perimeterM: decimalText(room.omtrekM),
      notes: room.notities ?? ""
    });
  }

  async function saveRoomCorrection(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingRoomId || !roomCorrectionDraft.name.trim()) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        ruimteId: editingRoomId as Id<"measurementRooms">,
        naam: roomCorrectionDraft.name.trim(),
        verdieping: roomCorrectionDraft.floor.trim() || undefined,
        breedteM: parseDecimal(roomCorrectionDraft.widthM),
        lengteM: parseDecimal(roomCorrectionDraft.lengthM),
        hoogteM: parseDecimal(roomCorrectionDraft.heightM),
        oppervlakteM2: parseDecimal(roomCorrectionDraft.areaM2),
        omtrekM: parseDecimal(roomCorrectionDraft.perimeterM),
        notities: roomCorrectionDraft.notes.trim() || undefined
      });

      // Maten gewijzigd → de afgeleide (niet-handmatige) regels van deze ruimte herrekenen,
      // zodat de hoeveelheden meelopen. Handmatig aangepaste regels blijven staan (controleren).
      const newDims: RoomDimensions = {
        breedteM: parseDecimal(roomCorrectionDraft.widthM),
        lengteM: parseDecimal(roomCorrectionDraft.lengthM),
        hoogteM: parseDecimal(roomCorrectionDraft.heightM),
        oppervlakteM2: parseDecimal(roomCorrectionDraft.areaM2),
        omtrekM: parseDecimal(roomCorrectionDraft.perimeterM)
      };
      let recomputed = 0;
      let manualSkipped = 0;
      let recomputeFailed = 0;
      for (const line of lines) {
        if (line.ruimteId !== editingRoomId || line.quotePreparationStatus === "converted") {
          continue;
        }
        if (line.handmatigAangepast) {
          manualSkipped += 1;
          continue;
        }
        const calc = calculatorForLine(line);
        if (!calc) {
          continue;
        }
        const derived = deriveLineForRoom(calc, newDims, paramsFromInvoer(line.invoer));
        if (derived.validationError) {
          continue;
        }
        // Per regel afvangen: één mislukte herberekening mag de rest niet stilletjes afbreken.
        try {
          await context.client.mutation(api.projecten.measurements.updateMeasurementLine, {
            tenantId: context.tenantId,
            actor: mutationActorFromSession(session),
            lineId: line._id as Id<"measurementLines">,
            ruimteId: editingRoomId as Id<"measurementRooms">,
            productGroep: line.productGroep,
            berekeningType: line.berekeningType,
            invoer: derived.invoer,
            resultaat: derived.resultaat,
            snijverliesPct: derived.snijverliesPct,
            aantal: derived.aantal,
            eenheid: line.eenheid,
            notities: line.notities,
            offerteRegelType: line.offerteRegelType,
            handmatigAangepast: false,
            productId: line.productId ? (line.productId as Id<"products">) : undefined,
            productNaam: line.productNaam,
            indicatieveEenheidsprijsExBtw: line.indicatieveEenheidsprijsExBtw,
            indicatiefBtwTarief: line.indicatiefBtwTarief,
            indicatievePrijsEenheid: line.indicatievePrijsEenheid,
            indicatievePrijsSoort: line.indicatievePrijsSoort,
            indicatiefVastgelegdOp: line.indicatiefVastgelegdOp
          });
          recomputed += 1;
        } catch (recomputeError) {
          console.error(recomputeError);
          recomputeFailed += 1;
        }
      }

      const extra = [
        manualSkipped > 0 ? `${manualSkipped} handmatige regel(s) — controleer` : null,
        recomputeFailed > 0 ? `${recomputeFailed} regel(s) niet herberekend — controleer` : null
      ]
        .filter(Boolean)
        .join(" · ");
      showToast({
        title:
          recomputed > 0
            ? `Ruimte bijgewerkt · ${recomputed} regel(s) herberekend${extra ? ` · ${extra}` : ""}`
            : `Meetruimte bijgewerkt${extra ? ` · ${extra}` : ""}`,
        tone: recomputeFailed > 0 ? "warning" : "success"
      });
      setEditingRoomId(null);
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetruimte kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRoomCorrection() {
    if (!pendingRoomDelete) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setRoomDeleteError(null);

    try {
      await context.client.mutation(api.projecten.measurements.deleteMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        ruimteId: pendingRoomDelete._id as Id<"measurementRooms">
      });
      showToast({ title: "Meetruimte verwijderd", tone: "warning" });
      setPendingRoomDelete(null);
      setRoomDeleteError(null);
      await loadMeasurement();
    } catch (deleteError) {
      console.error(deleteError);
      // Fout tonen IN de dialoog — niet sluiten, zodat de gebruiker de melding ziet
      setRoomDeleteError(
        "Deze ruimte heeft nog meetregels gekoppeld. Verwijder eerst alle meetregels van deze ruimte."
      );
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

    setIsSaving(true);
    setError(null);

    const finalUnit = lineCorrectionDraft.unit.trim() || line.eenheid;

    // Bij een gekozen product altijd een verse richtprijs ophalen met de
    // definitieve eenheid: dit voorkomt verouderde snapshots (eenheid gewijzigd
    // na productkeuze) én races met nog lopende weergave-lookups.
    let productArgs: Record<string, unknown> = {};

    if (lineCorrectionDraft.productTouched && !lineCorrectionDraft.productId) {
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
        productArgs = {
          productId: lineCorrectionDraft.productId as Id<"products">,
          productName: freshPrice?.productName ?? (lineCorrectionDraft.productName || undefined),
          ...(indicative
            ? {
                indicativeUnitPriceExVat: indicative.unitPriceExVat,
                indicativeVatRate: indicative.vatRate,
                indicativePriceUnit: indicative.priceUnit,
                indicativePriceType: indicative.priceType,
                indicativeCapturedAt: Date.now()
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
      showToast({ title: "Meetregel verwijderd", tone: "warning" });
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

  function applyProjectRoom(projectRoomValue: string) {
    setProjectRoomId(projectRoomValue);

    const sourceRoom = projectRooms.find((room) => room.id === projectRoomValue);

    if (!sourceRoom) {
      // "Nieuwe ruimte" gekozen: laat oppervlakte/omtrek weer automatisch meelopen.
      setRoomAreaAutoFilled(true);
      setRoomPerimeterAutoFilled(true);
      return;
    }

    setRoomName(sourceRoom.naam);
    setRoomFloor(sourceRoom.verdieping ?? "");
    setRoomWidthM(decimalText(sourceRoom.breedteCm ? sourceRoom.breedteCm / 100 : undefined));
    setRoomLengthM(decimalText(sourceRoom.lengteCm ? sourceRoom.lengteCm / 100 : undefined));
    // Bestaande ruimte: gebruik de opgeslagen oppervlakte/omtrek, niet automatisch herrekenen.
    setRoomAreaAutoFilled(false);
    setRoomPerimeterAutoFilled(false);
    setRoomAreaM2(decimalText(sourceRoom.oppervlakteM2));
    setRoomPerimeterM(decimalText(sourceRoom.omtrekMeter));
    setRoomNotes(sourceRoom.notities ?? "");
  }

  const roomColumns = useMemo<Array<DataTableColumn<MeasurementRoomDoc>>>(() => {
    const actionColumn: DataTableColumn<MeasurementRoomDoc> = {
      key: "actions",
      header: "Acties",
      width: "180px",
      render: (room) =>
        canEditMeasurement ? (
          <div className="toolbar">
            <Button size="sm" variant="secondary" onClick={() => startEditRoom(room)}>
              <Pencil size={16} aria-hidden="true" />
              Bewerken
            </Button>
            <Button size="sm" variant="danger" onClick={() => setPendingRoomDelete(room)}>
              <Trash2 size={16} aria-hidden="true" />
              Verwijderen
            </Button>
          </div>
        ) : (
          "-"
        )
    };
    const baseColumns: Array<DataTableColumn<MeasurementRoomDoc>> = [
      {
        key: "name",
        header: "Ruimte",
        priority: "primary",
        render: (room) => <strong>{room.naam}</strong>
      },
      {
        key: "floor",
        header: "Verdieping",
        hideOnMobile: true,
        render: (room) => room.verdieping ?? "-"
      }
    ];

    return [
      ...baseColumns,
      {
        key: "width",
        header: "Breedte",
        align: "right",
        render: (room) => formatNumber(room.breedteM, " m")
      },
      {
        key: "length",
        header: "Lengte",
        align: "right",
        render: (room) => formatNumber(room.lengteM, " m")
      },
      {
        key: "height",
        header: "Hoogte",
        align: "right",
        hideOnMobile: true,
        render: (room) => formatNumber(room.hoogteM, " m")
      },
      {
        key: "area",
        header: "Oppervlakte",
        align: "right",
        render: (room) => formatNumber(room.oppervlakteM2, " m²")
      },
      {
        key: "perimeter",
        header: "Omtrek",
        align: "right",
        render: (room) => formatNumber(room.omtrekM, " m")
      },
      {
        key: "notes",
        header: "Notitie",
        hideOnMobile: true,
        render: (room) => room.notities ?? "-"
      },
      actionColumn
    ];
  }, [canEditMeasurement]);

  if (isLoading) {
    return <LoadingState title="Inmeting laden" description="Inmeting ophalen." />;
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
        open={Boolean(pendingRoomDelete)}
        title="Meetruimte verwijderen?"
        description={
          roomDeleteError
            ? roomDeleteError
            : "Dit kan alleen als er nog geen meetregels aan deze ruimte gekoppeld zijn."
        }
        confirmLabel={roomDeleteError ? "Sluiten" : "Meetruimte verwijderen"}
        cancelLabel={roomDeleteError ? undefined : "Annuleren"}
        tone={roomDeleteError ? "warning" : "danger"}
        isBusy={isSaving}
        onCancel={() => {
          setPendingRoomDelete(null);
          setRoomDeleteError(null);
        }}
        onConfirm={() => {
          if (roomDeleteError) {
            setPendingRoomDelete(null);
            setRoomDeleteError(null);
          } else {
            void deleteRoomCorrection();
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingLineDelete)}
        title="Meetregel verwijderen?"
        description="De meetregel verdwijnt uit de inmeting. Verwerkte regels blijven beschermd."
        confirmLabel="Meetregel verwijderen"
        tone="danger"
        isBusy={isSaving}
        onCancel={() => setPendingLineDelete(null)}
        onConfirm={() => void deleteLineCorrection()}
      />
      <SectionHeader
        compact
        title={isFieldMode ? "Meten bij de klant" : "Inmeting"}
        description={
          isFieldMode
            ? "Werk van klantgegevens naar ruimtes, meetregels en een conceptofferte."
            : "Leg ruimtes, maten en indicatieve hoeveelheden vast voor latere offertevoorbereiding."
        }
      />

      {!isFieldMode ? (
        <Alert
          variant="info"
          title="Richtprijzen zijn indicatief"
          description="Kies bij het inmeten optioneel een product om direct een richtprijs te zien. De definitieve prijs en btw bepaal je in de offerte."
        />
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
          <section className={isFieldMode ? "grid field-measurement-summary" : "grid three-column"}>
            <StatCard
              label="Status"
              value={formatMeasurementStatus(measurement.status)}
              tone={measurement.status === "reviewed" ? "success" : "warning"}
            />
            <StatCard label="Ruimtes gemeten" value={rooms.length} tone="info" />
            <StatCard
              label="Klaar voor offerte"
              value={readyLineCount}
              description={`${lines.length} inmeetregels totaal`}
              tone={readyLineCount > 0 ? "success" : "neutral"}
            />
          </section>

          <Card>
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
                <SummaryList
                  items={[
                    { id: "date", label: "Inmeetdatum", value: dateText(measurement.inmeetdatum) },
                    {
                      id: "person",
                      label: "Ingemeten door",
                      value: measurement.gemetenDoor ?? "-"
                    },
                    { id: "updated", label: "Bijgewerkt", value: dateText(measurement.gewijzigdOp) }
                  ]}
                />
                <div className="responsive-form-row" style={{ marginTop: 16 }}>
                  <Field htmlFor="measurement-status" label="Status">
                    <Select
                      id="measurement-status"
                      value={measurementStatus}
                      onChange={(event) =>
                        setMeasurementStatus(event.target.value as MeasurementStatus)
                      }
                    >
                      {(["draft", "measured", "reviewed", "converted_to_quote"] as const).map(
                        (status) => (
                          <option key={status} value={status}>
                            {formatMeasurementStatus(status)}
                          </option>
                        )
                      )}
                    </Select>
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

          <Card>
            <SectionHeader
              compact
              title={isFieldMode ? "Stap 1 - Waar meet je?" : "Ruimtes inmeten"}
              description={
                isFieldMode
                  ? "Een ruimte is de plek in de woning. Daarna kies je welke hoeveelheid je wilt vastleggen."
                  : "Een meetruimte is de vastgelegde maatvoering binnen deze inmeting."
              }
            />
            {canEditMeasurement ? (
              <div className="field-room-presets">
                <p className="field-room-presets-label">
                  {isFieldMode ? "Snel toevoegen" : "Naam invullen via preset"}
                </p>
                <div className="field-room-presets-grid">
                  {FIELD_ROOM_PRESETS.map((preset) => {
                    const alreadyAdded = rooms.some((r) => r.naam === preset.name);
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        className={
                          alreadyAdded ? "field-room-preset-btn added" : "field-room-preset-btn"
                        }
                        disabled={isSaving}
                        onClick={() =>
                          isFieldMode ? void addRoomByPreset(preset.name) : setRoomName(preset.name)
                        }
                        aria-label={
                          alreadyAdded
                            ? `${preset.label} — al toegevoegd`
                            : `${preset.label} toevoegen`
                        }
                      >
                        {preset.label}
                        {alreadyAdded ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <form onSubmit={addRoom}>
              <div className="responsive-form-row">
                <Field
                  htmlFor="project-room-source"
                  label={isFieldMode ? "Ruimte uit dossier" : "Bestaande projectruimte"}
                >
                  <Select
                    id="project-room-source"
                    value={projectRoomId}
                    onChange={(event) => applyProjectRoom(event.target.value)}
                  >
                    <option value="">Nieuwe ruimte</option>
                    {projectRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.naam}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field htmlFor="measurement-room-name" label="Ruimte" required>
                  <Input
                    id="measurement-room-name"
                    required
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measurement-room-floor" label="Verdieping">
                  <Input
                    id="measurement-room-floor"
                    value={roomFloor}
                    onChange={(event) => setRoomFloor(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measurement-room-width" label="Breedte in meter">
                  <Input
                    id="measurement-room-width"
                    inputMode="decimal"
                    value={roomWidthM}
                    onChange={(event) => setRoomWidthM(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measurement-room-length" label="Lengte in meter">
                  <Input
                    id="measurement-room-length"
                    inputMode="decimal"
                    value={roomLengthM}
                    onChange={(event) => setRoomLengthM(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measurement-room-height" label="Hoogte in meter">
                  <Input
                    id="measurement-room-height"
                    inputMode="decimal"
                    value={roomHeightM}
                    onChange={(event) => setRoomHeightM(event.target.value)}
                  />
                </Field>
                <Field
                  htmlFor="measurement-room-area"
                  label="Oppervlakte m²"
                  description={roomAreaAutoFilled ? "Automatisch: lengte × breedte" : undefined}
                >
                  <Input
                    id="measurement-room-area"
                    inputMode="decimal"
                    value={roomAreaM2}
                    onChange={(event) => {
                      setRoomAreaM2(event.target.value);
                      setRoomAreaAutoFilled(false);
                    }}
                  />
                </Field>
                <Field
                  htmlFor="measurement-room-perimeter"
                  label="Omtrek m"
                  description={
                    roomPerimeterAutoFilled ? "Automatisch: 2 × (lengte + breedte)" : undefined
                  }
                >
                  <Input
                    id="measurement-room-perimeter"
                    inputMode="decimal"
                    value={roomPerimeterM}
                    onChange={(event) => {
                      setRoomPerimeterM(event.target.value);
                      setRoomPerimeterAutoFilled(false);
                    }}
                  />
                </Field>
              </div>
              <Field htmlFor="measurement-room-notes" label="Notitie">
                <Textarea
                  id="measurement-room-notes"
                  rows={2}
                  value={roomNotes}
                  onChange={(event) => setRoomNotes(event.target.value)}
                />
              </Field>
              <div className="toolbar" style={{ marginTop: 12 }}>
                {canEditMeasurement ? (
                  <Button
                    isLoading={isSaving}
                    leftIcon={<Plus size={16} aria-hidden="true" />}
                    type="submit"
                    variant="primary"
                  >
                    {isFieldMode ? "Ruimte opslaan" : "Ruimte toevoegen"}
                  </Button>
                ) : null}
              </div>
            </form>
            <div style={{ marginTop: 16 }}>
              <DataTable
                ariaLabel="Ruimtes inmeten"
                columns={roomColumns}
                density="compact"
                emptyDescription={
                  isFieldMode
                    ? "Sla een ruimte op als je meetregels aan een plek wilt koppelen. Je kunt ook direct doorgaan zonder ruimte."
                    : "Voeg een meetruimte toe of gebruik een bestaande projectruimte als basis."
                }
                emptyTitle={
                  isFieldMode ? "Nog geen ruimte opgeslagen" : "Nog geen ruimtes ingemeten"
                }
                getRowKey={(room) => room._id}
                mobileMode="cards"
                renderMobileCard={(room) => (
                  <div className="mobile-card-section">
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        <strong>{room.naam}</strong>
                        <small className="muted">{room.verdieping ?? "Geen verdieping"}</small>
                      </div>
                      <strong>{formatNumber(room.oppervlakteM2, " m²")}</strong>
                    </div>
                    <div className="mobile-card-meta">
                      <span>{formatNumber(room.omtrekM, " m")} omtrek</span>
                      <span>{room.notities ?? "Geen notitie"}</span>
                    </div>
                    {canEditMeasurement ? (
                      <div className="mobile-card-actions">
                        <Button
                          leftIcon={<Pencil size={16} aria-hidden="true" />}
                          onClick={() => startEditRoom(room)}
                          size="sm"
                          variant="secondary"
                        >
                          Bewerken
                        </Button>
                        <Button
                          leftIcon={<Trash2 size={16} aria-hidden="true" />}
                          onClick={() => setPendingRoomDelete(room)}
                          size="sm"
                          variant="danger"
                        >
                          Verwijderen
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
                rows={rooms}
              />
            </div>
            {editingRoomId ? (
              <form
                className="form-grid edit-work-panel"
                onSubmit={saveRoomCorrection}
                ref={roomEditFormRef}
                style={{ marginTop: 16 }}
              >
                <SectionHeader
                  compact
                  title={`Meetruimte bewerken: ${roomCorrectionDraft.name}`}
                  description="Je past nu deze opgeslagen ruimte aan zonder een dubbele ruimte aan te maken."
                />
                <div className="grid three-column">
                  <Field htmlFor="measurement-room-edit-name" label="Ruimte" required>
                    <Input
                      id="measurement-room-edit-name"
                      value={roomCorrectionDraft.name}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-floor" label="Verdieping">
                    <Input
                      id="measurement-room-edit-floor"
                      value={roomCorrectionDraft.floor}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          floor: event.target.value
                        }))
                      }
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-area" label="Oppervlakte">
                    <Input
                      id="measurement-room-edit-area"
                      inputMode="decimal"
                      value={roomCorrectionDraft.areaM2}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          areaM2: event.target.value
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="grid three-column">
                  <Field htmlFor="measurement-room-edit-width" label="Breedte in meter">
                    <Input
                      id="measurement-room-edit-width"
                      inputMode="decimal"
                      value={roomCorrectionDraft.widthM}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          widthM: event.target.value
                        }))
                      }
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-length" label="Lengte in meter">
                    <Input
                      id="measurement-room-edit-length"
                      inputMode="decimal"
                      value={roomCorrectionDraft.lengthM}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          lengthM: event.target.value
                        }))
                      }
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-perimeter" label="Omtrek">
                    <Input
                      id="measurement-room-edit-perimeter"
                      inputMode="decimal"
                      value={roomCorrectionDraft.perimeterM}
                      onChange={(event) =>
                        setRoomCorrectionDraft((current) => ({
                          ...current,
                          perimeterM: event.target.value
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field htmlFor="measurement-room-edit-notes" label="Notitie">
                  <Textarea
                    id="measurement-room-edit-notes"
                    rows={3}
                    value={roomCorrectionDraft.notes}
                    onChange={(event) =>
                      setRoomCorrectionDraft((current) => ({
                        ...current,
                        notes: event.target.value
                      }))
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
                    Meetruimte opslaan
                  </Button>
                  <Button
                    disabled={isSaving}
                    variant="secondary"
                    onClick={() => setEditingRoomId(null)}
                  >
                    Annuleren
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>

          {canEditMeasurement && measurement && tenantConvexId ? (
            <section className="panel" id="assign-panel-section">
              <SectionHeader
                compact
                title="Producten & diensten toewijzen aan ruimtes"
                description="Kies een product of dienst en pas het in één keer toe op één of meer ruimtes. De hoeveelheid volgt automatisch uit de ruimtematen."
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
              />
            </section>
          ) : null}

          {renderMeasurementLinesCard()}
        </div>
      )}
    </section>
  );

  function renderMeasurementLinesCard() {
    return (
      <Card>
        <SectionHeader
          compact
          title={isFieldMode ? "Stap 3 - Opgeslagen meetregels" : "Inmeetregels"}
          description={
            isFieldMode
              ? `Dit zijn de hoeveelheden die klaarstaan voor de conceptofferte. Richtprijzen zijn indicatief en ${showPricesIncVat ? "incl." : "excl."} btw.`
              : `Zet inmeetregels klaar zodat je ze in een offerte kunt overnemen. Richtprijzen zijn indicatief en ${showPricesIncVat ? "incl." : "excl."} btw; de definitieve prijs bepaal je in de offerte.`
          }
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
            <div className="grid three-column">
              <Field htmlFor="measurement-line-edit-room" label="Ruimte">
                <Select
                  id="measurement-line-edit-room"
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
                  inputMode="decimal"
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
