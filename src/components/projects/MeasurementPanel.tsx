import { CalendarClock, Plus, Ruler, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AppSession } from "../../lib/auth/session";
import {
  calculateFlooring,
  calculatePlinths,
  calculateStairs,
  calculateWallPanels,
  calculateWallpaperRolls
} from "../../lib/calculators";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import {
  formatLineType,
  formatMeasurementCalculationType,
  formatMeasurementProductGroup,
  formatMeasurementStatus,
  formatQuotePreparationStatus,
  formatUnit
} from "../../lib/i18n/statusLabels";
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  MeasurementStatus,
  PortalRoom,
  QuoteLineType,
  QuotePreparationStatus
} from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import { Textarea } from "../ui/Textarea";

type MeasurementPanelProps = {
  tenantId: string;
  projectId: string;
  customerId: string;
  projectRooms: PortalRoom[];
  session: AppSession;
};

type MeasurementDoc = {
  _id: string;
  status: MeasurementStatus;
  measurementDate?: number;
  measuredBy?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

type MeasurementRoomDoc = {
  _id: string;
  projectRoomId?: string;
  name: string;
  floor?: string;
  widthM?: number;
  lengthM?: number;
  heightM?: number;
  areaM2?: number;
  perimeterM?: number;
  notes?: string;
  sortOrder: number;
};

type MeasurementLineDoc = {
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
  quotePreparationStatus: QuotePreparationStatus;
};

type WasteProfileDoc = {
  _id: string;
  productGroup: MeasurementProductGroup;
  name: string;
  defaultWastePercent: number;
  description?: string;
};

type MeasurementData = {
  measurement: MeasurementDoc | null;
  rooms: MeasurementRoomDoc[];
  lines: MeasurementLineDoc[];
  wasteProfiles: WasteProfileDoc[];
};

type CalculatorFormProps = {
  title: string;
  description: string;
  children: ReactNode;
  result?: ReactNode;
  validationError?: string;
  onSubmit: (event: SubmitEventLike) => void;
  isSaving: boolean;
};

const INDICATIVE_TEXT =
  "Indicatief. Controleer altijd inmeting, legrichting, patroon, productafmetingen en snijverlies.";

const PRODUCT_GROUP_OPTIONS: MeasurementProductGroup[] = [
  "flooring",
  "plinths",
  "wallpaper",
  "wall_panels",
  "curtains",
  "rails",
  "stairs",
  "other"
];

const QUOTE_LINE_TYPE_OPTIONS: QuoteLineType[] = [
  "product",
  "service",
  "labor",
  "material",
  "text",
  "manual"
];

function parseDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function formatNumber(value?: number, suffix = "") {
  if (value === undefined || value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value)}${suffix}`;
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

function toDateInputValue(value?: number): string {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00`).getTime();
}

function CalculatorForm({
  title,
  description,
  children,
  result,
  validationError,
  onSubmit,
  isSaving
}: CalculatorFormProps) {
  return (
    <Card className="calculator-card" variant="muted">
      <form className="calculator-card-content" onSubmit={onSubmit}>
        <SectionHeader compact title={title} description={description} />
        <div className="responsive-form-row calculator-form-row">{children}</div>
        {result ? <div className="calculator-result">{result}</div> : null}
        {validationError ? (
          <Alert
            variant="warning"
            title="Controleer invoer"
            description="Controleer de ingevulde maten voordat je deze meetregel opslaat."
            style={{ marginTop: 12 }}
          />
        ) : null}
        <Alert variant="info" description={INDICATIVE_TEXT} style={{ marginTop: 12 }} />
        <div className="toolbar calculator-actions">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={16} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Meetregel opslaan
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function MeasurementPanel({
  tenantId,
  projectId,
  customerId,
  projectRooms,
  session
}: MeasurementPanelProps) {
  const [tenantConvexId, setTenantConvexId] = useState<string | null>(null);
  const [data, setData] = useState<MeasurementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  const [roomNotes, setRoomNotes] = useState("");

  const [floorRoomId, setFloorRoomId] = useState("");
  const [floorLengthM, setFloorLengthM] = useState("");
  const [floorWidthM, setFloorWidthM] = useState("");
  const [floorWastePercent, setFloorWastePercent] = useState("7");
  const [floorPatternType, setFloorPatternType] = useState("straight");
  const [floorNotes, setFloorNotes] = useState("");

  const [plinthRoomId, setPlinthRoomId] = useState("");
  const [plinthPerimeterM, setPlinthPerimeterM] = useState("");
  const [plinthDoorOpeningM, setPlinthDoorOpeningM] = useState("0");
  const [plinthWastePercent, setPlinthWastePercent] = useState("5");
  const [plinthNotes, setPlinthNotes] = useState("");

  const [wallpaperRoomId, setWallpaperRoomId] = useState("");
  const [wallpaperWidthM, setWallpaperWidthM] = useState("");
  const [wallpaperHeightM, setWallpaperHeightM] = useState("");
  const [rollWidthCm, setRollWidthCm] = useState("53");
  const [rollLengthM, setRollLengthM] = useState("10.05");
  const [patternRepeatCm, setPatternRepeatCm] = useState("0");
  const [wallpaperWastePercent, setWallpaperWastePercent] = useState("10");
  const [wallpaperNotes, setWallpaperNotes] = useState("");

  const [wallPanelRoomId, setWallPanelRoomId] = useState("");
  const [wallWidthM, setWallWidthM] = useState("");
  const [wallHeightM, setWallHeightM] = useState("");
  const [panelWidthM, setPanelWidthM] = useState("");
  const [panelHeightM, setPanelHeightM] = useState("");
  const [wallPanelWastePercent, setWallPanelWastePercent] = useState("8");
  const [wallPanelNotes, setWallPanelNotes] = useState("");

  const [stairRoomId, setStairRoomId] = useState("");
  const [stairType, setStairType] = useState("closed");
  const [treadCount, setTreadCount] = useState("");
  const [riserCount, setRiserCount] = useState("0");
  const [stripLengthM, setStripLengthM] = useState("");
  const [stairNotes, setStairNotes] = useState("");

  const [manualRoomId, setManualRoomId] = useState("");
  const [manualProductGroup, setManualProductGroup] = useState<MeasurementProductGroup>("other");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualUnit, setManualUnit] = useState("custom");
  const [manualQuoteLineType, setManualQuoteLineType] = useState<QuoteLineType>("manual");
  const [manualWastePercent, setManualWastePercent] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const measurement = data?.measurement ?? null;
  const rooms = data?.rooms ?? [];
  const lines = data?.lines ?? [];
  const wasteProfiles = data?.wasteProfiles ?? [];
  const readyLineCount = lines.filter((line) => line.quotePreparationStatus === "ready_for_quote")
    .length;

  const loadMeasurement = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await client.query(api.tenants.getBySlug, { slug: tenantId });
      const resolvedTenantId = String(tenant?._id ?? tenantId);
      setTenantConvexId(resolvedTenantId);

      const result = await client.query(api.measurements.getForProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">
      });

      setData(result as MeasurementData);
    } catch (loadError) {
      console.error(loadError);
      setError("Inmeting kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantId]);

  useEffect(() => {
    void loadMeasurement();
  }, [loadMeasurement]);

  useEffect(() => {
    if (!measurement) {
      return;
    }

    setMeasurementStatus(measurement.status);
    setMeasurementDate(toDateInputValue(measurement.measurementDate));
    setMeasuredBy(measurement.measuredBy ?? "");
    setMeasurementNotes(measurement.notes ?? "");
  }, [measurement]);

  const roomNameById = useMemo(() => {
    const names = new Map<string, string>();
    rooms.forEach((room) => names.set(room._id, room.name));
    return names;
  }, [rooms]);

  const getProfilesForGroup = useCallback(
    (group: MeasurementProductGroup) => {
      return wasteProfiles.filter((profile) => profile.productGroup === group);
    },
    [wasteProfiles]
  );

  const setWasteFromProfile = useCallback(
    (
      profileId: string,
      setter: (value: string) => void,
      productGroupFilter?: MeasurementProductGroup
    ) => {
      const profile = wasteProfiles.find(
        (item) =>
          item._id === profileId &&
          (!productGroupFilter || item.productGroup === productGroupFilter)
      );

      if (profile) {
        setter(String(profile.defaultWastePercent));
      }
    },
    [wasteProfiles]
  );

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

  const floorResult = useMemo(
    () =>
      calculateFlooring({
        lengthM: parseDecimal(floorLengthM) ?? 0,
        widthM: parseDecimal(floorWidthM) ?? 0,
        wastePercent: parseDecimal(floorWastePercent) ?? 0,
        patternType: floorPatternType as "straight" | "herringbone" | "tile" | "custom"
      }),
    [floorLengthM, floorPatternType, floorWastePercent, floorWidthM]
  );

  const plinthResult = useMemo(
    () =>
      calculatePlinths({
        perimeterM: parseDecimal(plinthPerimeterM) ?? 0,
        doorOpeningM: parseDecimal(plinthDoorOpeningM) ?? 0,
        wastePercent: parseDecimal(plinthWastePercent) ?? 0
      }),
    [plinthDoorOpeningM, plinthPerimeterM, plinthWastePercent]
  );

  const wallpaperResult = useMemo(
    () =>
      calculateWallpaperRolls({
        wallWidthM: parseDecimal(wallpaperWidthM) ?? 0,
        wallHeightM: parseDecimal(wallpaperHeightM) ?? 0,
        rollWidthCm: parseDecimal(rollWidthCm),
        rollLengthM: parseDecimal(rollLengthM),
        patternRepeatCm: parseDecimal(patternRepeatCm),
        wastePercent: parseDecimal(wallpaperWastePercent)
      }),
    [
      patternRepeatCm,
      rollLengthM,
      rollWidthCm,
      wallpaperHeightM,
      wallpaperWastePercent,
      wallpaperWidthM
    ]
  );

  const wallPanelResult = useMemo(
    () =>
      calculateWallPanels({
        wallWidthM: parseDecimal(wallWidthM) ?? 0,
        wallHeightM: parseDecimal(wallHeightM) ?? 0,
        panelWidthM: parseDecimal(panelWidthM) ?? 0,
        panelHeightM: parseDecimal(panelHeightM) ?? 0,
        wastePercent: parseDecimal(wallPanelWastePercent) ?? 0
      }),
    [panelHeightM, panelWidthM, wallHeightM, wallPanelWastePercent, wallWidthM]
  );

  const stairResult = useMemo(
    () =>
      calculateStairs({
        stairType: stairType as "straight" | "quarter_turn" | "half_turn" | "open" | "closed",
        treadCount: parseDecimal(treadCount) ?? 0,
        riserCount: parseDecimal(riserCount) ?? 0,
        stripLengthM: parseDecimal(stripLengthM)
      }),
    [riserCount, stairType, stripLengthM, treadCount]
  );

  function requireClientAndMeasurement() {
    const client = createConvexHttpClient();

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
    const client = createConvexHttpClient();

    if (!client || !tenantConvexId) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.measurements.createForProject, {
        tenantId: tenantConvexId as Id<"tenants">,
        projectId: projectId as Id<"projects">,
        customerId: customerId as Id<"customers">,
        measuredBy: session.name ?? session.email,
        createdByExternalUserId: session.userId
      });
      setNotice("Inmeting gestart.");
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
    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await context.client.mutation(api.measurements.updateMeasurement, {
        tenantId: context.tenantId,
        measurementId: context.measurementId,
        status: measurementStatus,
        measurementDate: fromDateInputValue(measurementDate),
        measuredBy: measuredBy.trim(),
        notes: measurementNotes.trim()
      });
      setNotice("Inmeting bijgewerkt.");
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
    setNotice(null);

    try {
      await context.client.mutation(api.measurements.addMeasurementRoom, {
        tenantId: context.tenantId,
        measurementId: context.measurementId,
        projectRoomId: projectRoomId ? (projectRoomId as Id<"projectRooms">) : undefined,
        name: roomName.trim(),
        floor: roomFloor.trim() || undefined,
        widthM,
        lengthM,
        heightM: parseDecimal(roomHeightM),
        areaM2,
        perimeterM,
        notes: roomNotes.trim() || undefined
      });
      setProjectRoomId("");
      setRoomName("");
      setRoomFloor("");
      setRoomWidthM("");
      setRoomLengthM("");
      setRoomHeightM("");
      setRoomAreaM2("");
      setRoomPerimeterM("");
      setRoomNotes("");
      setNotice("Meetruimte toegevoegd.");
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetruimte kon niet worden toegevoegd.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addLine(
    event: SubmitEventLike,
    line: {
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
      validationError?: string;
      successMessage: string;
    }
  ) {
    event.preventDefault();
    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    if (line.validationError || line.quantity <= 0) {
      setError("Controleer de invoer voordat je de meetregel opslaat.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await context.client.mutation(api.measurements.addMeasurementLine, {
        tenantId: context.tenantId,
        measurementId: context.measurementId,
        roomId: line.roomId ? (line.roomId as Id<"measurementRooms">) : undefined,
        productGroup: line.productGroup,
        calculationType: line.calculationType,
        input: line.input,
        result: line.result,
        wastePercent: line.wastePercent,
        quantity: line.quantity,
        unit: line.unit,
        notes: line.notes,
        quoteLineType: line.quoteLineType
      });
      setNotice(line.successMessage);
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetregel kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markLineReady(lineId: string) {
    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await context.client.mutation(api.measurements.updateMeasurementLineStatus, {
        tenantId: context.tenantId,
        lineId: lineId as Id<"measurementLines">,
        quotePreparationStatus: "ready_for_quote"
      });
      setNotice("Meetregel klaargezet voor offerte.");
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetregel kon niet worden klaargezet.");
    } finally {
      setIsSaving(false);
    }
  }

  function applyProjectRoom(projectRoomValue: string) {
    setProjectRoomId(projectRoomValue);

    const sourceRoom = projectRooms.find((room) => room.id === projectRoomValue);

    if (!sourceRoom) {
      return;
    }

    setRoomName(sourceRoom.name);
    setRoomFloor(sourceRoom.floor ?? "");
    setRoomWidthM(decimalText(sourceRoom.widthCm ? sourceRoom.widthCm / 100 : undefined));
    setRoomLengthM(decimalText(sourceRoom.lengthCm ? sourceRoom.lengthCm / 100 : undefined));
    setRoomAreaM2(decimalText(sourceRoom.areaM2));
    setRoomPerimeterM(decimalText(sourceRoom.perimeterMeter));
    setRoomNotes(sourceRoom.notes ?? "");
  }

  function applyMeasurementRoomToFloor(roomId: string) {
    setFloorRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setFloorLengthM(decimalText(room.lengthM));
      setFloorWidthM(decimalText(room.widthM));
    }
  }

  function applyMeasurementRoomToPlinth(roomId: string) {
    setPlinthRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setPlinthPerimeterM(decimalText(room.perimeterM));
    }
  }

  function applyMeasurementRoomToWallpaper(roomId: string) {
    setWallpaperRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setWallpaperWidthM(decimalText(room.widthM));
      setWallpaperHeightM(decimalText(room.heightM));
    }
  }

  function applyMeasurementRoomToWallPanel(roomId: string) {
    setWallPanelRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setWallWidthM(decimalText(room.widthM));
      setWallHeightM(decimalText(room.heightM));
    }
  }

  const roomColumns = useMemo<Array<DataTableColumn<MeasurementRoomDoc>>>(
    () => [
      {
        key: "name",
        header: "Ruimte",
        priority: "primary",
        render: (room) => <strong>{room.name}</strong>
      },
      {
        key: "floor",
        header: "Verdieping",
        hideOnMobile: true,
        render: (room) => room.floor ?? "-"
      },
      {
        key: "width",
        header: "Breedte",
        align: "right",
        render: (room) => formatNumber(room.widthM, " m")
      },
      {
        key: "length",
        header: "Lengte",
        align: "right",
        render: (room) => formatNumber(room.lengthM, " m")
      },
      {
        key: "height",
        header: "Hoogte",
        align: "right",
        hideOnMobile: true,
        render: (room) => formatNumber(room.heightM, " m")
      },
      {
        key: "area",
        header: "Oppervlakte",
        align: "right",
        render: (room) => formatNumber(room.areaM2, " m²")
      },
      {
        key: "perimeter",
        header: "Omtrek",
        align: "right",
        render: (room) => formatNumber(room.perimeterM, " m")
      },
      {
        key: "notes",
        header: "Notitie",
        hideOnMobile: true,
        render: (room) => room.notes ?? "-"
      }
    ],
    []
  );

  const lineColumns = useMemo<Array<DataTableColumn<MeasurementLineDoc>>>(
    () => [
      {
        key: "group",
        header: "Productgroep",
        priority: "primary",
        render: (line) => <strong>{formatMeasurementProductGroup(line.productGroup)}</strong>
      },
      {
        key: "room",
        header: "Ruimte",
        render: (line) => (line.roomId ? roomNameById.get(line.roomId) ?? "-" : "-")
      },
      {
        key: "calculation",
        header: "Berekening",
        render: (line) => formatMeasurementCalculationType(line.calculationType)
      },
      {
        key: "quantity",
        header: "Hoeveelheid",
        align: "right",
        render: (line) => formatNumber(line.quantity)
      },
      {
        key: "unit",
        header: "Eenheid",
        render: (line) => formatUnit(line.unit)
      },
      {
        key: "waste",
        header: "Snijverlies",
        align: "right",
        hideOnMobile: true,
        render: (line) => (line.wastePercent !== undefined ? `${line.wastePercent}%` : "-")
      },
      {
        key: "status",
        header: "Status",
        render: (line) => (
          <StatusBadge
            status={line.quotePreparationStatus}
            label={formatQuotePreparationStatus(line.quotePreparationStatus)}
          />
        )
      },
      {
        key: "notes",
        header: "Notitie",
        hideOnMobile: true,
        render: (line) => line.notes ?? "-"
      },
      {
        key: "action",
        header: "Actie",
        render: (line) =>
          line.quotePreparationStatus === "draft" ? (
            <Button
              disabled={isSaving}
              onClick={() => void markLineReady(line._id)}
              size="sm"
              variant="secondary"
            >
              Klaarzetten
            </Button>
          ) : (
            "-"
          )
      }
    ],
    [isSaving, roomNameById]
  );

  if (isLoading) {
    return <LoadingState title="Inmeting laden" description="Meetgegevens ophalen." />;
  }

  if (error && !data) {
    return <ErrorState title="Inmeting niet geladen" description={error} />;
  }

  return (
    <section className="panel measurement-panel">
      <SectionHeader
        compact
        title="Inmeting"
        description="Leg ruimtes, maten en indicatieve hoeveelheden vast voor latere offertevoorbereiding."
      />

      <Alert
        variant="warning"
        title="Geen prijsberekening"
        description="Inmeting bereidt hoeveelheden voor. Prijzen en btw worden pas in de offerte bepaald."
      />

      {notice ? (
        <Alert variant="success" description={notice} style={{ marginTop: 12 }} />
      ) : null}
      {error ? <Alert variant="danger" description={error} style={{ marginTop: 12 }} /> : null}

      {!measurement ? (
        <EmptyState
          title="Nog geen inmeting"
          description="Start een inmeting om meetruimtes en indicatieve hoeveelheden vast te leggen."
          action={
            <Button
              isLoading={isSaving}
              leftIcon={<Ruler size={17} aria-hidden="true" />}
              onClick={() => void startMeasurement()}
              variant="primary"
            >
              Inmeting starten
            </Button>
          }
        />
      ) : (
        <div className="grid">
          <section className="grid three-column">
            <StatCard
              label="Status"
              value={formatMeasurementStatus(measurement.status)}
              tone={measurement.status === "reviewed" ? "success" : "warning"}
            />
            <StatCard label="Meetruimtes" value={rooms.length} tone="info" />
            <StatCard
              label="Klaar voor offerte"
              value={readyLineCount}
              description={`${lines.length} meetregels totaal`}
              tone={readyLineCount > 0 ? "success" : "neutral"}
            />
          </section>

          <Card>
            <form onSubmit={saveMeasurementMeta}>
              <SectionHeader
                compact
                title="Inmeting samenvatting"
                description="Deze gegevens horen bij het projectdossier en wijzigen geen offerte."
                actions={
                  <StatusBadge
                    status={measurement.status}
                    label={formatMeasurementStatus(measurement.status)}
                  />
                }
              />
              <SummaryList
                items={[
                  { id: "date", label: "Inmeetdatum", value: dateText(measurement.measurementDate) },
                  { id: "person", label: "Ingemeten door", value: measurement.measuredBy ?? "-" },
                  { id: "updated", label: "Bijgewerkt", value: dateText(measurement.updatedAt) }
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
                <Button
                  isLoading={isSaving}
                  leftIcon={<CalendarClock size={16} aria-hidden="true" />}
                  type="submit"
                  variant="secondary"
                >
                  Inmeting opslaan
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeader
              compact
              title="Meetruimtes"
              description="Een meetruimte is de vastgelegde maatvoering binnen deze inmeting."
            />
            <form onSubmit={addRoom}>
              <div className="responsive-form-row">
                <Field htmlFor="project-room-source" label="Bestaande projectruimte">
                  <Select
                    id="project-room-source"
                    value={projectRoomId}
                    onChange={(event) => applyProjectRoom(event.target.value)}
                  >
                    <option value="">Geen basisruimte</option>
                    {projectRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
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
                  label="Oppervlakte"
                  description={
                    selectedRoomArea
                      ? `Voorstel: ${formatNumber(selectedRoomArea, " m²")}`
                      : undefined
                  }
                >
                  <Input
                    id="measurement-room-area"
                    inputMode="decimal"
                    value={roomAreaM2}
                    onChange={(event) => setRoomAreaM2(event.target.value)}
                  />
                </Field>
                <Field
                  htmlFor="measurement-room-perimeter"
                  label="Omtrek"
                  description={
                    selectedRoomPerimeter
                      ? `Voorstel: ${formatNumber(selectedRoomPerimeter, " m")}`
                      : undefined
                  }
                >
                  <Input
                    id="measurement-room-perimeter"
                    inputMode="decimal"
                    value={roomPerimeterM}
                    onChange={(event) => setRoomPerimeterM(event.target.value)}
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
                <Button
                  isLoading={isSaving}
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                  type="submit"
                  variant="primary"
                >
                  Meetruimte toevoegen
                </Button>
              </div>
            </form>
            <div style={{ marginTop: 16 }}>
              <DataTable
                ariaLabel="Meetruimtes"
                columns={roomColumns}
                density="compact"
                emptyDescription="Voeg een meetruimte toe of gebruik een bestaande projectruimte als basis."
                emptyTitle="Nog geen meetruimtes"
                getRowKey={(room) => room._id}
                mobileMode="cards"
                renderMobileCard={(room) => (
                  <div>
                    <strong>{room.name}</strong>
                    <p className="muted">
                      {formatNumber(room.areaM2, " m²")} · {formatNumber(room.perimeterM, " m")}
                    </p>
                    <p className="muted">{room.notes ?? "Geen notitie"}</p>
                  </div>
                )}
                rows={rooms}
              />
            </div>
          </Card>

          <Card>
            <SectionHeader
              compact
              title="Meetregels"
              description="Meetregels kunnen worden klaargezet voor offertevoorbereiding. Er wordt nog niets aan een offerte toegevoegd."
            />
            <DataTable
              ariaLabel="Meetregels"
              columns={lineColumns}
              density="compact"
              emptyDescription="Gebruik hieronder een rekenhulp om de eerste meetregel op te slaan."
              emptyTitle="Nog geen meetregels"
              getRowKey={(line) => line._id}
              mobileMode="cards"
              renderMobileCard={(line) => (
                <div>
                  <div className="toolbar" style={{ justifyContent: "space-between" }}>
                    <strong>{formatMeasurementProductGroup(line.productGroup)}</strong>
                    <StatusBadge
                      status={line.quotePreparationStatus}
                      label={formatQuotePreparationStatus(line.quotePreparationStatus)}
                    />
                  </div>
                  <p className="muted">
                    {roomNameById.get(line.roomId ?? "") ?? "Geen ruimte"} ·{" "}
                    {formatNumber(line.quantity)} {formatUnit(line.unit)}
                  </p>
                  <p className="muted">{line.notes ?? "Geen notitie"}</p>
                  {line.quotePreparationStatus === "draft" ? (
                    <div className="mobile-card-actions">
                      <Button
                        disabled={isSaving}
                        onClick={() => void markLineReady(line._id)}
                        size="sm"
                        variant="secondary"
                      >
                        Klaarzetten voor offerte
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              rows={lines}
            />
          </Card>

          <section className="panel">
            <SectionHeader
              compact
              title="Rekenhulpen"
              description="Gebruik een rekenhulp om een indicatieve hoeveelheid als meetregel vast te leggen."
            />
            <Alert
              variant="info"
              description="De rekenhulpen bepalen alleen hoeveelheden. Product, prijs en btw controleer je later in de offerte."
            />
          </section>

          <section className="grid two-column calculator-grid">
            <CalculatorForm
              title="Vloer berekenen"
              description="Bereken oppervlakte met snijverlies."
              isSaving={isSaving}
              validationError={floorLengthM || floorWidthM ? floorResult.validationError : undefined}
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: floorRoomId || undefined,
                  productGroup: "flooring",
                  calculationType: "area",
                  input: {
                    lengthM: parseDecimal(floorLengthM),
                    widthM: parseDecimal(floorWidthM),
                    wastePercent: parseDecimal(floorWastePercent),
                    patternType: floorPatternType
                  },
                  result: floorResult,
                  wastePercent: parseDecimal(floorWastePercent),
                  quantity: floorResult.quoteQuantityM2,
                  unit: "m2",
                  notes: floorNotes.trim() || undefined,
                  quoteLineType: "product",
                  validationError: floorResult.validationError,
                  successMessage: "Vloermeetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Netto oppervlakte", value: formatNumber(floorResult.areaM2, " m²") },
                    { label: "Snijverlies", value: formatNumber(floorResult.wasteM2, " m²") },
                    { label: "Offertehoeveelheid", value: formatNumber(floorResult.quoteQuantityM2, " m²") }
                  ]}
                />
              }
            >
              {renderRoomSelect("floor-room", "Meetruimte", floorRoomId, applyMeasurementRoomToFloor)}
              {renderWasteProfileSelect(
                "floor-waste-profile",
                "Snijverliesprofiel",
                getProfilesForGroup("flooring"),
                (profileId) => setWasteFromProfile(profileId, setFloorWastePercent, "flooring")
              )}
              <Field htmlFor="floor-length" label="Lengte in meter">
                <Input id="floor-length" inputMode="decimal" value={floorLengthM} onChange={(event) => setFloorLengthM(event.target.value)} />
              </Field>
              <Field htmlFor="floor-width" label="Breedte in meter">
                <Input id="floor-width" inputMode="decimal" value={floorWidthM} onChange={(event) => setFloorWidthM(event.target.value)} />
              </Field>
              <Field htmlFor="floor-waste" label="Snijverlies %">
                <Input id="floor-waste" inputMode="decimal" value={floorWastePercent} onChange={(event) => setFloorWastePercent(event.target.value)} />
              </Field>
              <Field htmlFor="floor-pattern" label="Legpatroon">
                <Select id="floor-pattern" value={floorPatternType} onChange={(event) => setFloorPatternType(event.target.value)}>
                  <option value="straight">Rechte plank</option>
                  <option value="herringbone">Visgraat</option>
                  <option value="tile">Tegelpatroon</option>
                  <option value="custom">Maatwerk</option>
                </Select>
              </Field>
              <Field htmlFor="floor-notes" label="Notitie">
                <Input id="floor-notes" value={floorNotes} onChange={(event) => setFloorNotes(event.target.value)} />
              </Field>
            </CalculatorForm>

            <CalculatorForm
              title="Plinten berekenen"
              description="Bereken meters plint op basis van omtrek en deuropeningen."
              isSaving={isSaving}
              validationError={plinthPerimeterM ? plinthResult.validationError : undefined}
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: plinthRoomId || undefined,
                  productGroup: "plinths",
                  calculationType: "perimeter",
                  input: {
                    perimeterM: parseDecimal(plinthPerimeterM),
                    doorOpeningM: parseDecimal(plinthDoorOpeningM),
                    wastePercent: parseDecimal(plinthWastePercent)
                  },
                  result: plinthResult,
                  wastePercent: parseDecimal(plinthWastePercent),
                  quantity: plinthResult.quoteQuantityMeter,
                  unit: "meter",
                  notes: plinthNotes.trim() || undefined,
                  quoteLineType: "material",
                  validationError: plinthResult.validationError,
                  successMessage: "Plintenmeetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Netto meters", value: formatNumber(plinthResult.netMeter, " m") },
                    { label: "Snijverlies", value: formatNumber(plinthResult.wasteMeter, " m") },
                    { label: "Offertehoeveelheid", value: formatNumber(plinthResult.quoteQuantityMeter, " m") }
                  ]}
                />
              }
            >
              {renderRoomSelect("plinth-room", "Meetruimte", plinthRoomId, applyMeasurementRoomToPlinth)}
              {renderWasteProfileSelect(
                "plinth-waste-profile",
                "Snijverliesprofiel",
                getProfilesForGroup("plinths"),
                (profileId) => setWasteFromProfile(profileId, setPlinthWastePercent, "plinths")
              )}
              <Field htmlFor="plinth-perimeter" label="Omtrek in meter">
                <Input id="plinth-perimeter" inputMode="decimal" value={plinthPerimeterM} onChange={(event) => setPlinthPerimeterM(event.target.value)} />
              </Field>
              <Field htmlFor="plinth-door" label="Deuropeningen in meter">
                <Input id="plinth-door" inputMode="decimal" value={plinthDoorOpeningM} onChange={(event) => setPlinthDoorOpeningM(event.target.value)} />
              </Field>
              <Field htmlFor="plinth-waste" label="Snijverlies %">
                <Input id="plinth-waste" inputMode="decimal" value={plinthWastePercent} onChange={(event) => setPlinthWastePercent(event.target.value)} />
              </Field>
              <Field htmlFor="plinth-notes" label="Notitie">
                <Input id="plinth-notes" value={plinthNotes} onChange={(event) => setPlinthNotes(event.target.value)} />
              </Field>
            </CalculatorForm>

            <CalculatorForm
              title="Behang berekenen"
              description="Bereken indicatief het aantal rollen behang."
              isSaving={isSaving}
              validationError={
                wallpaperWidthM || wallpaperHeightM ? wallpaperResult.validationError : undefined
              }
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: wallpaperRoomId || undefined,
                  productGroup: "wallpaper",
                  calculationType: "rolls",
                  input: {
                    wallWidthM: parseDecimal(wallpaperWidthM),
                    wallHeightM: parseDecimal(wallpaperHeightM),
                    rollWidthCm: parseDecimal(rollWidthCm),
                    rollLengthM: parseDecimal(rollLengthM),
                    patternRepeatCm: parseDecimal(patternRepeatCm),
                    wastePercent: parseDecimal(wallpaperWastePercent)
                  },
                  result: wallpaperResult as unknown as Record<string, unknown>,
                  wastePercent: parseDecimal(wallpaperWastePercent),
                  quantity: wallpaperResult.rollsNeeded,
                  unit: "roll",
                  notes: wallpaperNotes.trim() || undefined,
                  quoteLineType: "product",
                  validationError: wallpaperResult.validationError,
                  successMessage: "Behangmeetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Banen nodig", value: wallpaperResult.banenNeeded },
                    { label: "Banen per rol", value: wallpaperResult.banenPerRol },
                    { label: "Offertehoeveelheid", value: `${wallpaperResult.rollsNeeded} rollen` }
                  ]}
                />
              }
            >
              {renderRoomSelect("wallpaper-room", "Meetruimte", wallpaperRoomId, applyMeasurementRoomToWallpaper)}
              {renderWasteProfileSelect(
                "wallpaper-waste-profile",
                "Snijverliesprofiel",
                getProfilesForGroup("wallpaper"),
                (profileId) => setWasteFromProfile(profileId, setWallpaperWastePercent, "wallpaper")
              )}
              <Field htmlFor="wallpaper-width" label="Wandbreedte in meter">
                <Input id="wallpaper-width" inputMode="decimal" value={wallpaperWidthM} onChange={(event) => setWallpaperWidthM(event.target.value)} />
              </Field>
              <Field htmlFor="wallpaper-height" label="Wandhoogte in meter">
                <Input id="wallpaper-height" inputMode="decimal" value={wallpaperHeightM} onChange={(event) => setWallpaperHeightM(event.target.value)} />
              </Field>
              <Field htmlFor="roll-width" label="Rolbreedte cm">
                <Input id="roll-width" inputMode="decimal" value={rollWidthCm} onChange={(event) => setRollWidthCm(event.target.value)} />
              </Field>
              <Field htmlFor="roll-length" label="Rollengte m">
                <Input id="roll-length" inputMode="decimal" value={rollLengthM} onChange={(event) => setRollLengthM(event.target.value)} />
              </Field>
              <Field htmlFor="pattern-repeat" label="Patroonrapport cm">
                <Input id="pattern-repeat" inputMode="decimal" value={patternRepeatCm} onChange={(event) => setPatternRepeatCm(event.target.value)} />
              </Field>
              <Field htmlFor="wallpaper-waste" label="Snijverlies %">
                <Input id="wallpaper-waste" inputMode="decimal" value={wallpaperWastePercent} onChange={(event) => setWallpaperWastePercent(event.target.value)} />
              </Field>
              <Field htmlFor="wallpaper-notes" label="Notitie">
                <Input id="wallpaper-notes" value={wallpaperNotes} onChange={(event) => setWallpaperNotes(event.target.value)} />
              </Field>
            </CalculatorForm>

            <CalculatorForm
              title="Wandpanelen berekenen"
              description="Bereken indicatief het aantal panelen."
              isSaving={isSaving}
              validationError={
                wallWidthM || wallHeightM || panelWidthM || panelHeightM
                  ? wallPanelResult.validationError
                  : undefined
              }
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: wallPanelRoomId || undefined,
                  productGroup: "wall_panels",
                  calculationType: "panels",
                  input: {
                    wallWidthM: parseDecimal(wallWidthM),
                    wallHeightM: parseDecimal(wallHeightM),
                    panelWidthM: parseDecimal(panelWidthM),
                    panelHeightM: parseDecimal(panelHeightM),
                    wastePercent: parseDecimal(wallPanelWastePercent)
                  },
                  result: wallPanelResult,
                  wastePercent: parseDecimal(wallPanelWastePercent),
                  quantity: wallPanelResult.quoteQuantityPieces,
                  unit: "piece",
                  notes: wallPanelNotes.trim() || undefined,
                  quoteLineType: "product",
                  validationError: wallPanelResult.validationError,
                  successMessage: "Wandpanelenmeetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Wandoppervlakte", value: formatNumber(wallPanelResult.wallAreaM2, " m²") },
                    { label: "Panelen nodig", value: wallPanelResult.panelsNeeded },
                    { label: "Offertehoeveelheid", value: `${wallPanelResult.quoteQuantityPieces} stuks` }
                  ]}
                />
              }
            >
              {renderRoomSelect("wall-panel-room", "Meetruimte", wallPanelRoomId, applyMeasurementRoomToWallPanel)}
              {renderWasteProfileSelect(
                "wall-panel-waste-profile",
                "Snijverliesprofiel",
                getProfilesForGroup("wall_panels"),
                (profileId) => setWasteFromProfile(profileId, setWallPanelWastePercent, "wall_panels")
              )}
              <Field htmlFor="wall-panel-wall-width" label="Wandbreedte in meter">
                <Input id="wall-panel-wall-width" inputMode="decimal" value={wallWidthM} onChange={(event) => setWallWidthM(event.target.value)} />
              </Field>
              <Field htmlFor="wall-panel-wall-height" label="Wandhoogte in meter">
                <Input id="wall-panel-wall-height" inputMode="decimal" value={wallHeightM} onChange={(event) => setWallHeightM(event.target.value)} />
              </Field>
              <Field htmlFor="panel-width" label="Paneelbreedte in meter">
                <Input id="panel-width" inputMode="decimal" value={panelWidthM} onChange={(event) => setPanelWidthM(event.target.value)} />
              </Field>
              <Field htmlFor="panel-height" label="Paneelhoogte in meter">
                <Input id="panel-height" inputMode="decimal" value={panelHeightM} onChange={(event) => setPanelHeightM(event.target.value)} />
              </Field>
              <Field htmlFor="wall-panel-waste" label="Snijverlies %">
                <Input id="wall-panel-waste" inputMode="decimal" value={wallPanelWastePercent} onChange={(event) => setWallPanelWastePercent(event.target.value)} />
              </Field>
              <Field htmlFor="wall-panel-notes" label="Notitie">
                <Input id="wall-panel-notes" value={wallPanelNotes} onChange={(event) => setWallPanelNotes(event.target.value)} />
              </Field>
            </CalculatorForm>

            <CalculatorForm
              title="Trap berekenen"
              description="Leg aantallen vast zonder vaste prijsregel te kiezen."
              isSaving={isSaving}
              validationError={treadCount ? stairResult.validationError : undefined}
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: stairRoomId || undefined,
                  productGroup: "stairs",
                  calculationType: "stairs",
                  input: {
                    stairType,
                    treadCount: parseDecimal(treadCount),
                    riserCount: parseDecimal(riserCount),
                    stripLengthM: parseDecimal(stripLengthM)
                  },
                  result: stairResult as unknown as Record<string, unknown>,
                  quantity: stairResult.quoteQuantity,
                  unit: "stairs",
                  notes: stairNotes.trim() || undefined,
                  quoteLineType: "service",
                  validationError: stairResult.validationError,
                  successMessage: "Trapmeetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Treden", value: stairResult.treadCount },
                    { label: "Stootborden", value: stairResult.riserCount },
                    { label: "Offertehoeveelheid", value: `${stairResult.quoteQuantity} trap` }
                  ]}
                />
              }
            >
              {renderRoomSelect("stair-room", "Meetruimte", stairRoomId, setStairRoomId)}
              <Field htmlFor="stair-type" label="Traptype">
                <Select id="stair-type" value={stairType} onChange={(event) => setStairType(event.target.value)}>
                  <option value="straight">Rechte trap</option>
                  <option value="quarter_turn">Kwart draai</option>
                  <option value="half_turn">Halve draai</option>
                  <option value="open">Open trap</option>
                  <option value="closed">Dichte trap</option>
                </Select>
              </Field>
              <Field htmlFor="tread-count" label="Aantal treden">
                <Input id="tread-count" inputMode="numeric" value={treadCount} onChange={(event) => setTreadCount(event.target.value)} />
              </Field>
              <Field htmlFor="riser-count" label="Aantal stootborden">
                <Input id="riser-count" inputMode="numeric" value={riserCount} onChange={(event) => setRiserCount(event.target.value)} />
              </Field>
              <Field htmlFor="strip-length" label="Striplengte in meter">
                <Input id="strip-length" inputMode="decimal" value={stripLengthM} onChange={(event) => setStripLengthM(event.target.value)} />
              </Field>
              <Field htmlFor="stair-notes" label="Notitie">
                <Input id="stair-notes" value={stairNotes} onChange={(event) => setStairNotes(event.target.value)} />
              </Field>
            </CalculatorForm>

            <CalculatorForm
              title="Handmatige meetregel"
              description="Gebruik dit voor afwijkende of nog niet ondersteunde berekeningen."
              isSaving={isSaving}
              validationError={
                manualQuantity && !parseDecimal(manualQuantity) ? "quantity is required." : undefined
              }
              onSubmit={(event) =>
                void addLine(event, {
                  roomId: manualRoomId || undefined,
                  productGroup: manualProductGroup,
                  calculationType: "manual",
                  input: {
                    quantity: parseDecimal(manualQuantity),
                    unit: manualUnit,
                    wastePercent: parseDecimal(manualWastePercent)
                  },
                  result: {
                    quantity: parseDecimal(manualQuantity),
                    unit: manualUnit,
                    isIndicative: true
                  },
                  wastePercent: parseDecimal(manualWastePercent),
                  quantity: parseDecimal(manualQuantity) ?? 0,
                  unit: manualUnit,
                  notes: manualNotes.trim() || undefined,
                  quoteLineType: manualQuoteLineType,
                  validationError: parseDecimal(manualQuantity) ? undefined : "quantity is required.",
                  successMessage: "Handmatige meetregel opgeslagen."
                })
              }
              result={
                <SummaryList
                  items={[
                    { label: "Productgroep", value: formatMeasurementProductGroup(manualProductGroup) },
                    { label: "Regeltype", value: formatLineType(manualQuoteLineType) },
                    { label: "Hoeveelheid", value: `${manualQuantity || "-"} ${formatUnit(manualUnit)}` }
                  ]}
                />
              }
            >
              {renderRoomSelect("manual-room", "Meetruimte", manualRoomId, setManualRoomId)}
              <Field htmlFor="manual-group" label="Productgroep">
                <Select id="manual-group" value={manualProductGroup} onChange={(event) => setManualProductGroup(event.target.value as MeasurementProductGroup)}>
                  {PRODUCT_GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>
                      {formatMeasurementProductGroup(group)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="manual-quantity" label="Hoeveelheid">
                <Input id="manual-quantity" inputMode="decimal" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} />
              </Field>
              <Field htmlFor="manual-unit" label="Eenheid">
                <Input id="manual-unit" value={manualUnit} onChange={(event) => setManualUnit(event.target.value)} />
              </Field>
              <Field htmlFor="manual-line-type" label="Offerteposttype">
                <Select id="manual-line-type" value={manualQuoteLineType} onChange={(event) => setManualQuoteLineType(event.target.value as QuoteLineType)}>
                  {QUOTE_LINE_TYPE_OPTIONS.map((lineType) => (
                    <option key={lineType} value={lineType}>
                      {formatLineType(lineType)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="manual-waste" label="Snijverlies %">
                <Input id="manual-waste" inputMode="decimal" value={manualWastePercent} onChange={(event) => setManualWastePercent(event.target.value)} />
              </Field>
              <Field htmlFor="manual-notes" label="Notitie">
                <Input id="manual-notes" value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} />
              </Field>
            </CalculatorForm>
          </section>
        </div>
      )}
    </section>
  );

  function renderRoomSelect(
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void
  ) {
    return (
      <Field htmlFor={id} label={label}>
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Geen specifieke ruimte</option>
          {rooms.map((room) => (
            <option key={room._id} value={room._id}>
              {room.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  function renderWasteProfileSelect(
    id: string,
    label: string,
    profiles: WasteProfileDoc[],
    onChange: (value: string) => void
  ) {
    return (
      <Field htmlFor={id} label={label}>
        <Select id={id} defaultValue="" onChange={(event) => onChange(event.target.value)}>
          <option value="">Handmatig percentage</option>
          {profiles.map((profile) => (
            <option key={profile._id} value={profile._id}>
              {profile.name} ({profile.defaultWastePercent}%)
            </option>
          ))}
        </Select>
      </Field>
    );
  }
}
