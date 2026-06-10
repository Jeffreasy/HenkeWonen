import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canWrite, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatEuro } from "../../lib/money";
import type { InvoiceStatus, PortalInvoiceDetail } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { SummaryList } from "../ui/SummaryList";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoiceDetailSkeleton } from "./InvoiceDetailSkeleton";

type InvoiceDetailProps = {
  session: AppSession;
  invoiceId: string;
};

type PendingAction =
  | { type: "mark_paid" }
  | { type: "mark_overdue" }
  | { type: "cancel" };

export default function InvoiceDetail({ session, invoiceId }: InvoiceDetailProps) {
  const [detail, setDetail] = useState<PortalInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Betaling-velden
  const [paidAmount, setPaidAmount] = useState("");
  const canEdit = canWrite(session.role);

  const loadDetail = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.invoiceDetail, {
        tenantSlug: session.tenantId,
        invoiceId
      });

      setDetail(result as PortalInvoiceDetail | null);
    } catch (loadError) {
      console.error(loadError);
      setError("Factuur kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId, session.tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function openMarkPaid() {
    const totalStr = detail?.invoice.totalIncVat.toFixed(2).replace(".", ",") ?? "";
    setPaidAmount(totalStr);
    setPendingAction({ type: "mark_paid" });
  }

  async function handleConfirm() {
    const client = createConvexHttpClient(session);

    if (!client || !detail) {
      return;
    }

    setIsBusy(true);
    setActionError(null);

    try {
      if (pendingAction?.type === "mark_paid") {
        const parsedAmount = parseFloat(paidAmount.replace(",", "."));

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          setActionError("Voer een geldig bedrag in.");
          setIsBusy(false);
          return;
        }

        await client.mutation(api.portal.markInvoicePaid, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          invoiceId,
          paidAmount: parsedAmount
        });
      } else if (pendingAction?.type === "mark_overdue") {
        await client.mutation(api.portal.updateInvoiceStatus, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          invoiceId,
          status: "overdue" as InvoiceStatus
        });
      } else if (pendingAction?.type === "cancel") {
        await client.mutation(api.portal.updateInvoiceStatus, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          invoiceId,
          status: "cancelled" as InvoiceStatus
        });
      }

      setPendingAction(null);
      await loadDetail();
    } catch (mutationError) {
      console.error(mutationError);
      setActionError("De actie kon niet worden verwerkt. Probeer het opnieuw.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return <InvoiceDetailSkeleton />;
  }

  if (error) {
    return <ErrorState title="Factuur niet geladen" description={error} />;
  }

  if (!detail?.invoice) {
    return (
      <EmptyState
        title="Factuur niet gevonden"
        description="Controleer de link of ga terug naar het factuuroverzicht."
      />
    );
  }

  const { invoice, customer, project, quote } = detail;
  const isEditable = canEdit && invoice.status !== "paid" && invoice.status !== "cancelled";

  const confirmCopy: Record<
    PendingAction["type"],
    { title: string; description: string; confirmLabel: string; tone?: "warning" | "danger" }
  > = {
    mark_paid: {
      title: "Betaling registreren",
      description: "Leg de ontvangen betaling vast. Bij volledig betaald wordt het dossier automatisch op 'Betaald' gezet.",
      confirmLabel: "Betaling registreren"
    },
    mark_overdue: {
      title: "Markeren als te laat?",
      description: "Je markeert deze factuur als te laat. De klant heeft de vervaldatum overschreden.",
      confirmLabel: "Te laat markeren",
      tone: "warning"
    },
    cancel: {
      title: "Factuur annuleren?",
      description: "Je annuleert deze factuur. Dit kan niet ongedaan worden gemaakt.",
      confirmLabel: "Factuur annuleren",
      tone: "danger"
    }
  };

  const currentActionCopy = pendingAction ? confirmCopy[pendingAction.type] : null;

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={currentActionCopy?.title ?? "Actie bevestigen"}
        description={currentActionCopy?.description ?? ""}
        confirmLabel={currentActionCopy?.confirmLabel ?? "Bevestigen"}
        tone={currentActionCopy?.tone ?? "warning"}
        isBusy={isBusy}
        onCancel={() => {
          if (!isBusy) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      >
        {pendingAction?.type === "mark_paid" ? (
          <div className="grid" style={{ gap: "var(--space-3)" }}>
            <Field
              htmlFor="paid-amount"
              label="Ontvangen bedrag (incl. btw)"
              description={`Totaalbedrag factuur: ${formatEuro(invoice.totalIncVat)}`}
            >
              <Input
                id="paid-amount"
                type="text"
                inputMode="decimal"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                placeholder="bijv. 1.250,00"
              />
            </Field>
            {actionError ? (
              <p style={{ color: "var(--color-danger, #b91c1c)", fontSize: "var(--text-sm)", margin: 0 }}>
                {actionError}
              </p>
            ) : null}
          </div>
        ) : actionError ? (
          <p style={{ color: "var(--color-danger, #b91c1c)", fontSize: "var(--text-sm)", margin: 0 }}>
            {actionError}
          </p>
        ) : null}
      </ConfirmDialog>

      {/* Header met status en acties */}
      <section className="panel">
        <SectionHeader
          title={
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {invoice.invoiceNumber}
              <InvoiceStatusBadge status={invoice.status} />
            </span>
          }
          description={`Factuur voor ${customer?.displayName ?? "Onbekende klant"}`}
          actions={
            isEditable ? (
              <div className="project-action-row">
                <Button onClick={openMarkPaid} size="sm" variant="primary">
                  Betaling registreren
                </Button>
                {invoice.status === "sent" ? (
                  <Button
                    onClick={() => setPendingAction({ type: "mark_overdue" })}
                    size="sm"
                    variant="secondary"
                  >
                    Te laat markeren
                  </Button>
                ) : null}
                <Button
                  onClick={() => setPendingAction({ type: "cancel" })}
                  size="sm"
                  variant="ghost"
                >
                  Annuleren
                </Button>
              </div>
            ) : null
          }
        />
      </section>

      <div className="grid two-column">
        {/* Factuurgegevens */}
        <section className="panel">
          <SectionHeader compact title="Factuurgegevens" />
          <SummaryList
            items={[
              { label: "Factuurnummer", value: invoice.invoiceNumber },
              { label: "Factuurdatum", value: formatDate(invoice.invoiceDate) },
              {
                label: "Vervaldatum",
                value: (
                  <span
                    style={
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" &&
                      invoice.dueDate < Date.now()
                        ? { color: "var(--color-danger, #b91c1c)", fontWeight: 700 }
                        : undefined
                    }
                  >
                    {formatDate(invoice.dueDate)}
                  </span>
                )
              },
              {
                label: "Excl. btw",
                value: formatEuro(invoice.subtotalExVat)
              },
              { label: "Btw", value: formatEuro(invoice.vatTotal) },
              {
                label: "Totaal incl. btw",
                value: <strong>{formatEuro(invoice.totalIncVat)}</strong>
              },
              {
                label: "Betaald",
                value: formatEuro(invoice.paidAmount),
                description: invoice.paidAt ? `op ${formatDate(invoice.paidAt)}` : undefined
              },
              {
                label: "Nog te ontvangen",
                value: (
                  <strong>
                    {formatEuro(Math.max(0, invoice.totalIncVat - invoice.paidAmount))}
                  </strong>
                )
              }
            ]}
          />
        </section>

        {/* Gekoppeld dossier en klant */}
        <section className="panel">
          <SectionHeader compact title="Gekoppeld dossier" />
          <SummaryList
            items={[
              {
                label: "Klant",
                value: customer ? (
                  <a href={`/portal/klanten/${customer.id}`}>{customer.displayName}</a>
                ) : (
                  "-"
                )
              },
              {
                label: "Project",
                value: project ? (
                  <a href={`/portal/projecten/${project.id}`}>{project.title}</a>
                ) : (
                  "-"
                )
              },
              {
                label: "Gekoppelde offerte",
                value: quote ? (
                  <a href={`/portal/offertes/${quote.id}`}>{quote.quoteNumber}</a>
                ) : (
                  <span className="muted">Geen offerte gekoppeld</span>
                )
              },
              ...(customer?.email
                ? [{ label: "E-mail", value: customer.email }]
                : []),
              ...(customer?.phone
                ? [{ label: "Telefoon", value: customer.phone }]
                : [])
            ]}
          />
        </section>
      </div>
    </div>
  );
}
