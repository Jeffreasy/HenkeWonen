import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canWrite, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatEuro } from "../../lib/money";
import type { InvoiceStatus, PortalInvoiceDetail } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { SummaryList } from "../ui/data-display/SummaryList";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoiceDetailSkeleton } from "./InvoiceDetailSkeleton";
import InvoiceDocumentPreview from "./InvoiceDocumentPreview";
import { buildInvoiceDocumentModel } from "../../lib/invoices/invoiceDocumentModel";

type InvoiceDetailProps = {
  session: AppSession;
  invoiceId: string;
};

type PendingAction =
  | { type: "mark_paid" }
  | { type: "mark_overdue" }
  | { type: "send" }
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
    const totalStr = detail?.invoice.totaalInclBtw.toFixed(2).replace(".", ",") ?? "";
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
          betaaldBedrag: parsedAmount
        });
      } else if (pendingAction?.type === "mark_overdue") {
        await client.mutation(api.portal.updateInvoiceStatus, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          invoiceId,
          status: "overdue" as InvoiceStatus
        });
      } else if (pendingAction?.type === "send") {
        await client.mutation(api.portal.updateInvoiceStatus, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          invoiceId,
          status: "sent" as InvoiceStatus
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

  const { invoice, customer, project, quote, quoteLines } = detail;
  const isEditable = canEdit && invoice.status !== "paid" && invoice.status !== "cancelled";
  const isOpen = invoice.status !== "paid" && invoice.status !== "cancelled";
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysOverdue =
    isOpen && invoice.vervaldatum < Date.now()
      ? Math.floor((Date.now() - invoice.vervaldatum) / msPerDay)
      : 0;
  const outstanding = Math.max(0, invoice.totaalInclBtw - invoice.betaaldBedrag);
  const paidPct =
    invoice.totaalInclBtw > 0
      ? Math.min(100, Math.max(0, Math.round((invoice.betaaldBedrag / invoice.totaalInclBtw) * 100)))
      : 0;
  const addressLines = customer
    ? [
        [customer.straat, customer.huisnummer].filter(Boolean).join(" "),
        [customer.postcode, customer.plaats].filter(Boolean).join("  "),
        customer.land
      ].filter((line) => line && line.trim().length > 0)
    : [];

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
    send: {
      title: "Factuur versturen?",
      description: "Je zet deze conceptfactuur op 'Verstuurd'. Daarna is de factuur definitief en kun je betalingen registreren.",
      confirmLabel: "Versturen"
    },
    cancel: {
      title: "Factuur annuleren?",
      description: "Je annuleert deze factuur. Dit kan niet ongedaan worden gemaakt.",
      confirmLabel: "Factuur annuleren",
      tone: "danger"
    }
  };

  const currentActionCopy = pendingAction ? confirmCopy[pendingAction.type] : null;
  const invoiceDocumentModel = buildInvoiceDocumentModel({ detail });

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
              description={`Totaalbedrag factuur: ${formatEuro(invoice.totaalInclBtw)}`}
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
              {invoice.factuurnummer}
              <InvoiceStatusBadge status={invoice.status} />
            </span>
          }
          description={`Factuur voor ${customer?.weergaveNaam ?? "Onbekende klant"}`}
          actions={
            isEditable ? (
              <div className="project-action-row">
                {invoice.status === "draft" ? (
                  <Button onClick={() => setPendingAction({ type: "send" })} size="sm" variant="primary">
                    Versturen
                  </Button>
                ) : (
                  <Button onClick={openMarkPaid} size="sm" variant="primary">
                    Betaling registreren
                  </Button>
                )}
                {invoice.status === "sent" || invoice.status === "partially_paid" ? (
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
              { label: "Factuurnummer", value: invoice.factuurnummer },
              { label: "Factuurdatum", value: formatDate(invoice.factuurdatum) },
              {
                label: "Vervaldatum",
                value: (
                  <span
                    style={
                      daysOverdue > 0
                        ? { color: "var(--color-danger, #b91c1c)", fontWeight: 700 }
                        : undefined
                    }
                  >
                    {formatDate(invoice.vervaldatum)}
                  </span>
                ),
                description:
                  daysOverdue > 0 ? `${daysOverdue} dag${daysOverdue === 1 ? "" : "en"} te laat` : undefined
              },
              ...(invoice.herinneringVerzondenOp
                ? [
                    {
                      label: "Herinnering verstuurd",
                      value: formatDate(invoice.herinneringVerzondenOp)
                    }
                  ]
                : []),
              {
                label: "Excl. btw",
                value: formatEuro(invoice.subtotaalExBtw)
              },
              { label: "Btw", value: formatEuro(invoice.btwTotaal) },
              {
                label: "Totaal incl. btw",
                value: <strong>{formatEuro(invoice.totaalInclBtw)}</strong>
              },
              {
                label: "Betaald",
                value: formatEuro(invoice.betaaldBedrag),
                description: invoice.betaaldOp ? `op ${formatDate(invoice.betaaldOp)}` : undefined
              },
              {
                label: "Nog te ontvangen",
                value: <strong>{formatEuro(outstanding)}</strong>
              }
            ]}
          />
          {invoice.betaaldBedrag > 0 && invoice.status !== "cancelled" ? (
            <div style={{ marginTop: "var(--space-3)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-1)"
                }}
              >
                <span className="muted">Betaalvoortgang</span>
                <span>{paidPct}%</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "var(--color-surface-muted, #e5e7eb)",
                  overflow: "hidden"
                }}
                role="progressbar"
                aria-valuenow={paidPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    width: `${paidPct}%`,
                    height: "100%",
                    background:
                      invoice.status === "paid"
                        ? "var(--color-success, #16a34a)"
                        : "var(--color-primary, #2563eb)"
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Gekoppeld dossier en klant */}
        <section className="panel">
          <SectionHeader compact title="Gekoppeld dossier" />
          <SummaryList
            items={[
              {
                label: "Klant",
                value: customer ? (
                  <a href={`/portal/klanten/${customer.id}`}>{customer.weergaveNaam}</a>
                ) : (
                  "-"
                )
              },
              {
                label: "Project",
                value: project ? (
                  <a href={`/portal/projecten/${project.id}`}>{project.titel}</a>
                ) : (
                  "-"
                )
              },
              {
                label: "Gekoppelde offerte",
                value: quote ? (
                  <a href={`/portal/offertes/${quote.id}`}>{quote.offertenummer}</a>
                ) : (
                  <span className="muted">Geen offerte gekoppeld</span>
                )
              },
              ...(addressLines.length > 0
                ? [
                    {
                      label: "Factuuradres",
                      value: (
                        <span style={{ display: "flex", flexDirection: "column" }}>
                          {addressLines.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </span>
                      )
                    }
                  ]
                : []),
              ...(customer?.email
                ? [{ label: "E-mail", value: customer.email }]
                : []),
              ...(customer?.telefoon
                ? [{ label: "Telefoon", value: customer.telefoon }]
                : [])
            ]}
          />
        </section>
      </div>

      {/* Specificatie (factuurregels uit de gekoppelde offerte) */}
      <section className="panel">
        <SectionHeader
          compact
          title="Specificatie"
          description={
            quote
              ? `Regels overgenomen uit offerte ${quote.offertenummer}`
              : "Geen gekoppelde offerte"
          }
        />
        {quoteLines.length > 0 ? (
          <>
            <div className="quote-document-table-wrap">
              <table className="quote-document-table">
                <thead>
                  <tr>
                    <th>Aantal</th>
                    <th>Eenheid</th>
                    <th>Omschrijving</th>
                    <th>Prijs excl. btw</th>
                    <th>Btw</th>
                    <th>Totaal incl. btw</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteLines.map((line) =>
                    line.regelType === "text" ? (
                      <tr key={line.id}>
                        <td />
                        <td />
                        <td colSpan={4}>
                          <span className="muted">{line.titel}</span>
                        </td>
                      </tr>
                    ) : (
                      <tr key={line.id}>
                        <td>{line.aantal}</td>
                        <td>{line.eenheid}</td>
                        <td>
                          {line.titel}
                          {line.kortingExBtw
                            ? ` (korting ${formatEuro(line.kortingExBtw)})`
                            : ""}
                        </td>
                        <td>{formatEuro(line.eenheidsprijsExBtw)}</td>
                        <td>{line.btwTarief}%</td>
                        <td>{formatEuro(line.regelTotaalInclBtw)}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            <div className="quote-document-totals" style={{ marginTop: "var(--space-3)" }}>
              <div>
                <span>Subtotaal excl. btw</span>
                <strong>{formatEuro(invoice.subtotaalExBtw)}</strong>
              </div>
              <div>
                <span>Btw</span>
                <strong>{formatEuro(invoice.btwTotaal)}</strong>
              </div>
              <div className="quote-document-total-row">
                <span>Totaal incl. btw</span>
                <strong>{formatEuro(invoice.totaalInclBtw)}</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">
            Deze factuur heeft geen gekoppelde offerte, dus er is geen regelspecificatie beschikbaar.
          </p>
        )}
      </section>

      {/* Klantversie — printbaar factuurdocument (zelfde print-patroon als de offerte) */}
      <section className="panel">
        <SectionHeader
          compact
          title="Klantversie"
          description="Bekijk de factuur zoals de klant hem ontvangt. Printen gebeurt vanuit deze preview."
        />
        <InvoiceDocumentPreview model={invoiceDocumentModel} />
      </section>

      <p className="muted" style={{ fontSize: "var(--text-sm)", margin: 0 }}>
        Aangemaakt op {formatDate(invoice.aangemaaktOp)} · Laatst gewijzigd op{" "}
        {formatDate(invoice.gewijzigdOp)}
      </p>
    </div>
  );
}
