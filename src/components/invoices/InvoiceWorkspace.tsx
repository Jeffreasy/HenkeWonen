import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import type { PortalInvoiceRow } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { StatCard } from "../ui/StatCard";
import { InvoicesTable, type StatusFilter } from "./InvoicesTable";

type InvoiceWorkspaceProps = {
  session: AppSession;
};

export default function InvoiceWorkspace({ session }: InvoiceWorkspaceProps) {
  const [invoices, setInvoices] = useState<PortalInvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadInvoices = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.listInvoices, {
        tenantSlug: session.tenantId
      });

      setInvoices(result as PortalInvoiceRow[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Facturen konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const stats = useMemo(() => {
    const now = Date.now();
    const openAmount = invoices
      .filter((inv) => inv.status === "sent" || inv.status === "partially_paid")
      .reduce((sum, inv) => sum + (inv.totaalInclBtw - inv.betaaldBedrag), 0);
    const overdueCount = invoices.filter(
      (inv) =>
        inv.status !== "paid" &&
        inv.status !== "cancelled" &&
        inv.vervaldatum < now
    ).length;
    const paidThisYear = invoices
      .filter(
        (inv) =>
          inv.status === "paid" &&
          inv.betaaldOp &&
          new Date(inv.betaaldOp).getFullYear() === new Date().getFullYear()
      )
      .reduce((sum, inv) => sum + inv.totaalInclBtw, 0);

    return { openAmount, overdueCount, paidThisYear, total: invoices.length };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesSearch =
        !normalizedSearch ||
        [invoice.factuurnummer, invoice.customerName, invoice.projectTitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Facturen niet geladen" description={error} />
      ) : null}

      <section className="grid four-column">
        <StatCard
          label="Openstaand"
          value={formatEuro(stats.openAmount)}
          description="Verzonden maar nog niet (volledig) betaald"
          tone={stats.openAmount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Te laat"
          value={stats.overdueCount}
          description="Vervaldatum verstreken, niet betaald"
          tone={stats.overdueCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Betaald dit jaar"
          value={formatEuro(stats.paidThisYear)}
          description={`${new Date().getFullYear()} — volledig ontvangen`}
          tone="success"
        />
        <StatCard
          label="Totaal facturen"
          value={stats.total}
          description="Alle facturen in dit portaal"
        />
      </section>

      <InvoicesTable
        invoices={filteredInvoices}
        isLoading={isLoading}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />
    </div>
  );
}
