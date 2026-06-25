import { useCallback, useEffect, useState } from "react";
import { PackagePlus, FileText, Check, Ban, Truck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import { showToast } from "../../lib/toast";
import type {
  PortalSupplierOrder,
  PortalSupplierOrderLine,
  SupplierOrderStatus
} from "../../lib/portalTypes";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { Alert } from "../ui/feedback/Alert";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import SupplierOrderDocument from "./SupplierOrderDocument";

type SupplierOrdersPanelProps = {
  session: AppSession;
  projectId: string;
  canEdit: boolean;
};

type OrderDetail = {
  order: PortalSupplierOrder;
  lines: PortalSupplierOrderLine[];
  leverancier: { naam: string; contactpersoon?: string; email?: string; telefoon?: string } | null;
  project: { id: string; titel: string } | null;
};

const statusMeta: Record<SupplierOrderStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Concept", variant: "neutral" },
  ordered: { label: "Besteld", variant: "info" },
  confirmed: { label: "Bevestigd", variant: "info" },
  partially_received: { label: "Deels ontvangen", variant: "warning" },
  received: { label: "Ontvangen", variant: "success" },
  cancelled: { label: "Geannuleerd", variant: "danger" }
};

export default function SupplierOrdersPanel({ session, projectId, canEdit }: SupplierOrdersPanelProps) {
  const [orders, setOrders] = useState<PortalSupplierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, OrderDetail | "loading">>({});

  const loadOrders = useCallback(async () => {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.query(api.portal.listSupplierOrders, {
        tenantSlug: session.tenantId,
        projectId
      });
      setOrders(result as PortalSupplierOrder[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Bestellingen konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session.tenantId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function handleGenerate() {
    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }
    setIsGenerating(true);
    try {
      const result = (await client.mutation(api.portal.generateSupplierOrdersFromQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        projectId
      })) as { created: number; skipped: number; warnings: string[] };

      const description = result.warnings.length > 0 ? result.warnings.join(" ") : undefined;
      showToast({
        title:
          result.created > 0
            ? `${result.created} bestelling${result.created === 1 ? "" : "en"} aangemaakt`
            : "Geen nieuwe bestellingen",
        description,
        tone: result.created > 0 ? "success" : "warning"
      });
      setExpanded({});
      await loadOrders();
    } catch (generateError) {
      console.error(generateError);
      showToast({
        title: "Genereren mislukt",
        description:
          generateError instanceof Error && /offerte/i.test(generateError.message)
            ? "Accepteer eerst een offerte voor dit dossier."
            : undefined,
        tone: "error"
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAdvance(order: PortalSupplierOrder, status: "ordered" | "received") {
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }
    setBusyId(order.id);
    try {
      await client.mutation(api.portal.updateSupplierOrderStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        bestellingId: order.id,
        status
      });
      await loadOrders();
    } catch (statusError) {
      console.error(statusError);
      showToast({ title: "Status kon niet worden bijgewerkt", tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(order: PortalSupplierOrder) {
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }
    setBusyId(order.id);
    try {
      await client.mutation(api.portal.cancelSupplierOrder, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        bestellingId: order.id
      });
      await loadOrders();
    } catch (cancelError) {
      console.error(cancelError);
      showToast({ title: "Annuleren mislukt", tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDocument(order: PortalSupplierOrder) {
    if (expanded[order.id]) {
      setExpanded((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      return;
    }
    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }
    setExpanded((current) => ({ ...current, [order.id]: "loading" }));
    try {
      const detail = (await client.query(api.portal.supplierOrderDetail, {
        tenantSlug: session.tenantId,
        bestellingId: order.id
      })) as OrderDetail | null;
      if (detail) {
        setExpanded((current) => ({ ...current, [order.id]: detail }));
      } else {
        // Geen detail (verwijderd/niet gevonden): laadstatus opruimen i.p.v. blijven hangen.
        showToast({ title: "Bestelbon niet gevonden", tone: "error" });
        setExpanded((current) => {
          const next = { ...current };
          delete next[order.id];
          return next;
        });
      }
    } catch (detailError) {
      console.error(detailError);
      showToast({ title: "Bestelbon kon niet worden geladen", tone: "error" });
      setExpanded((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    }
  }

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Leveranciersbestellingen"
        description="Genereer bestellingen uit de geaccepteerde offerte, gegroepeerd per leverancier."
        actions={
          canEdit ? (
            <Button
              leftIcon={<PackagePlus size={16} aria-hidden="true" />}
              onClick={() => void handleGenerate()}
              isLoading={isGenerating}
              size="sm"
              variant="secondary"
            >
              Bestellingen genereren
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="danger" title="Bestellingen niet geladen" description={error} />
      ) : null}

      {isLoading ? (
        <p className="muted">Bestellingen laden…</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Nog geen bestellingen"
          description="Genereer bestellingen uit de geaccepteerde offerte; ze worden per leverancier gegroepeerd."
        />
      ) : (
        <div className="grid" style={{ gap: "var(--space-3)" }}>
          {orders.map((order) => {
            const meta = statusMeta[order.status];
            const detail = expanded[order.id];
            const canReceive =
              order.status === "ordered" ||
              order.status === "confirmed" ||
              order.status === "partially_received";
            const canCancel = order.status !== "received" && order.status !== "cancelled";

            return (
              <article key={order.id} className="panel" style={{ boxShadow: "none" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-3)",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <strong>{order.leverancierNaam ?? "Leverancier onbekend"}</strong>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <p className="muted" style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)" }}>
                      {order.regelAantal} regel{order.regelAantal === 1 ? "" : "s"} · Totaal inkoop{" "}
                      {formatEuro(order.totaalInkoopExBtw)} excl. btw
                    </p>
                  </div>
                  <div className="project-action-row">
                    <Button
                      leftIcon={<FileText size={15} aria-hidden="true" />}
                      onClick={() => void toggleDocument(order)}
                      size="sm"
                      variant="ghost"
                    >
                      {detail ? "Bestelbon sluiten" : "Bestelbon"}
                    </Button>
                    {canEdit && order.status === "draft" ? (
                      <Button
                        leftIcon={<Truck size={15} aria-hidden="true" />}
                        onClick={() => void handleAdvance(order, "ordered")}
                        isLoading={busyId === order.id}
                        size="sm"
                        variant="primary"
                      >
                        Markeer besteld
                      </Button>
                    ) : null}
                    {canEdit && canReceive ? (
                      <Button
                        leftIcon={<Check size={15} aria-hidden="true" />}
                        onClick={() => void handleAdvance(order, "received")}
                        isLoading={busyId === order.id}
                        size="sm"
                        variant="secondary"
                      >
                        Ontvangen
                      </Button>
                    ) : null}
                    {canEdit && canCancel ? (
                      <Button
                        leftIcon={<Ban size={15} aria-hidden="true" />}
                        onClick={() => void handleCancel(order)}
                        isLoading={busyId === order.id}
                        size="sm"
                        variant="ghost"
                      >
                        Annuleren
                      </Button>
                    ) : null}
                  </div>
                </div>

                {detail === "loading" ? (
                  <p className="muted" style={{ marginTop: "var(--space-3)" }}>
                    Bestelbon laden…
                  </p>
                ) : detail ? (
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <SupplierOrderDocument detail={detail} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
