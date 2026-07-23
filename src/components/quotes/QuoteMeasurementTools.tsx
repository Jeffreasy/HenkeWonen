import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AppSession } from "../../lib/auth/session";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { createConvexHttpClient } from "../../lib/convex/client";
import MeasurementAssignPanel, {
  type MeasurementAssignLine
} from "../projects/measurement/MeasurementAssignPanel";
import type { MeasurementData } from "../projects/measurement/measurementTypes";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";

const QUOTE_ROOM_PRESETS = [
  { label: "Trap", name: "Trap" },
  { label: "Hal", name: "Hal" },
  { label: "Overloop", name: "Overloop" },
  { label: "Woonkamer", name: "Woonkamer" },
  { label: "Slaapkamer", name: "Slaapkamer" }
];

export type QuoteMeasurementImportResult = {
  measurementLineIds: string[];
  quoteLineIds: string[];
  count: number;
};

export type QuoteMeasurementToolsProps = {
  quoteId: string;
  projectId: string;
  tenantSlug: string;
  session: AppSession;
  sortOrder: number;
  onImported?: (result: QuoteMeasurementImportResult) => void | Promise<void>;
  refresh?: () => void | Promise<void>;
};

function preferredRoomId(data: MeasurementData): string | null {
  return data.rooms[0]?._id ?? null;
}

export default function QuoteMeasurementTools({
  quoteId,
  projectId,
  tenantSlug,
  session,
  sortOrder,
  onImported,
  refresh
}: QuoteMeasurementToolsProps) {
  const titleId = useId();
  const requestSequence = useRef(0);
  const [tenantConvexId, setTenantConvexId] = useState<string | null>(null);
  const [data, setData] = useState<MeasurementData | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const initializedMeasurementIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postCommitWarning, setPostCommitWarning] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const client = createConvexHttpClient(session);

    setIsLoading(true);
    setError(null);

    if (!client) {
      if (requestSequence.current === requestId) {
        setError("De rekenhulpen kunnen nu niet worden geladen. Probeer het opnieuw.");
        setIsLoading(false);
      }
      return;
    }

    try {
      const tenant = await client.query(api.beheer.tenants.getBySlug, { slug: tenantSlug });
      const resolvedTenantId = String(tenant?._id ?? tenantSlug);
      const result = await client.query(api.projecten.measurements.getForProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">,
        quoteCalculationQuoteId: quoteId as Id<"quotes">,
        actor: mutationActorFromSession(session)
      });

      if (requestSequence.current !== requestId) return;

      setTenantConvexId(resolvedTenantId);
      setData(result as MeasurementData);
    } catch (loadError) {
      console.error(loadError);
      if (requestSequence.current === requestId) {
        setError("De rekenhulpen konden niet worden geladen.");
      }
    } finally {
      if (requestSequence.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [projectId, quoteId, session, tenantSlug]);

  useEffect(() => {
    void loadContext();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadContext]);

  useEffect(() => {
    if (!data?.measurement) {
      initializedMeasurementIdRef.current = null;
      setSelectedRoomIds([]);
      return;
    }

    const measurementId = data.measurement._id;
    const isFirstLoad = initializedMeasurementIdRef.current !== measurementId;
    initializedMeasurementIdRef.current = measurementId;
    const availableRoomIds = new Set(data.rooms.map((room) => room._id));

    setSelectedRoomIds((current) => {
      const validCurrent = current.filter((roomId) => availableRoomIds.has(roomId));
      if (validCurrent.length > 0) {
        return validCurrent;
      }
      if (!isFirstLoad) {
        return [];
      }

      const defaultRoomId = preferredRoomId(data);
      return defaultRoomId ? [defaultRoomId] : [];
    });
  }, [data]);

  async function startTools() {
    setPostCommitWarning(null);
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("De rekenhulpen kunnen nu niet worden gestart. Probeer het opnieuw.");
      return;
    }

    setIsStarting(true);
    setError(null);
    try {
      const context = (await client.mutation(api.offertes.core.ensureQuoteCalculationContext, {
        tenantSlug,
        actor: mutationActorFromSession(session),
        quoteId: quoteId as Id<"quotes">
      })) as { measurementRoomId?: string };

      setSelectedRoomIds(context.measurementRoomId ? [String(context.measurementRoomId)] : []);
      await loadContext();
    } catch (startError) {
      console.error(startError);
      setError("De rekenhulpen konden niet worden gestart.");
    } finally {
      setIsStarting(false);
    }
  }

  async function importLines(regels: MeasurementAssignLine[]) {
    setPostCommitWarning(null);
    if (!data?.measurement) {
      const importError = new Error("De rekencontext ontbreekt.");
      throw importError;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      const importError = new Error("De offerte kan nu niet worden bijgewerkt.");
      throw importError;
    }

    setIsImporting(true);
    setError(null);
    try {
      const result = (await client.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
        tenantSlug,
        actor: mutationActorFromSession(session),
        quoteId: quoteId as Id<"quotes">,
        measurementId: data.measurement._id as Id<"measurements">,
        startSortOrder: sortOrder,
        regels
      })) as QuoteMeasurementImportResult;

      const refreshResults = await Promise.allSettled([
        Promise.resolve().then(() => onImported?.(result)),
        Promise.resolve().then(() => refresh?.())
      ]);
      const refreshFailure = refreshResults.find(
        (refreshResult) => refreshResult.status === "rejected"
      );
      if (refreshFailure?.status === "rejected") {
        console.error(refreshFailure.reason);
        setPostCommitWarning(
          "De regels zijn toegevoegd, maar het scherm kon niet volledig worden ververst."
        );
      }
    } catch (importError) {
      console.error(importError);
      throw importError;
    } finally {
      setIsImporting(false);
    }
  }

  const contextMissing = !data?.measurement || data.measurement.status !== "draft";

  return (
    <section
      className="panel quote-measurement-tools"
      aria-labelledby={titleId}
      aria-busy={isLoading || isStarting || isImporting || undefined}
    >
      <div className="grid" style={{ gap: 12 }}>
        <div>
          <p className="eyebrow">Offerteposten berekenen</p>
          <h3 id={titleId}>Rekenhulpen</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            Bereken materiaal en diensten en voeg de uitkomst direct toe aan deze offerte.
          </p>
        </div>

        {postCommitWarning ? (
          <Alert
            variant="warning"
            role="status"
            title="Offerte bijgewerkt"
            description={postCommitWarning}
          />
        ) : null}

        {isLoading && !data ? (
          <p role="status" aria-live="polite" className="muted">
            Rekenhulpen laden...
          </p>
        ) : null}

        {error ? (
          <Alert variant="danger" title="Rekenhulpen niet beschikbaar" description={error}>
            {!isStarting && !isImporting ? (
              <div style={{ marginTop: 10 }}>
                <Button size="sm" variant="secondary" onClick={() => void loadContext()}>
                  Opnieuw proberen
                </Button>
              </div>
            ) : null}
          </Alert>
        ) : null}

        {!isLoading && !error && contextMissing ? (
          <div className="grid" style={{ gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Start een rekencontext voor deze offerte. Er wordt pas iets aangemaakt nadat je op de
              knop klikt.
            </p>
            <div>
              <Button variant="primary" isLoading={isStarting} onClick={() => void startTools()}>
                Rekenhulpen starten
              </Button>
            </div>
          </div>
        ) : null}

        {data?.measurement && tenantConvexId && !contextMissing ? (
          <MeasurementAssignPanel
            session={session}
            tenantSlug={tenantSlug}
            tenantConvexId={tenantConvexId}
            measurementId={data.measurement._id}
            rooms={data.rooms}
            canEdit
            selectedRoomIds={selectedRoomIds}
            onSelectedRoomIdsChange={setSelectedRoomIds}
            onAdded={loadContext}
            roomPresets={QUOTE_ROOM_PRESETS}
            onSubmitLines={importLines}
            submitLabel="Gebruik in offerte"
            successCopy="Toegevoegd aan de offerte."
            draftScopeId={`quote:${quoteId}:tools`}
          />
        ) : null}
      </div>
    </section>
  );
}
