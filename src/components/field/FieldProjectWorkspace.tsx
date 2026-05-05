import { AlertTriangle, CheckCircle2, Clock3, FileText, Mail, MapPin, Phone, Printer, Ruler, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditQuotes, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatMeasurementStatus, formatProjectStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type { FieldProjectWorkspaceResult, PortalQuote } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";
import MeasurementPanel from "../projects/MeasurementPanel";
import QuoteBuilder from "../quotes/QuoteBuilder";
import type { QuoteLineFormValues } from "../quotes/QuoteLineEditor";

type FieldProjectWorkspaceProps = {
  session: AppSession;
  projectId: string;
};

function customerAddress(workspace: FieldProjectWorkspaceResult) {
  const customer = workspace.customer;

  if (!customer) {
    return undefined;
  }

  return [customer.street, customer.houseNumber, customer.postalCode, customer.city]
    .filter(Boolean)
    .join(" ");
}

function pickInitialQuote(quotes: PortalQuote[]) {
  return (
    quotes.find((quote) => quote.status === "draft") ??
    quotes.find((quote) => quote.status === "sent") ??
    quotes[0]
  );
}

type FieldUrgency = {
  level: "red" | "orange" | "green";
  label: "Rood" | "Oranje" | "Groen";
  title: string;
  description: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function visitUrgency(workspace: FieldProjectWorkspaceResult): FieldUrgency {
  const measurementStatus = workspace.visit.measurementStatus;

  if (measurementStatus === "reviewed" || measurementStatus === "converted_to_quote") {
    return {
      level: "green",
      label: "Groen",
      title: "Op schema",
      description: "De inmeting is afgerond of gecontroleerd."
    };
  }

  if (!workspace.visit.visitAt) {
    return {
      level: "orange",
      label: "Oranje",
      title: "Meetmoment ontbreekt",
      description: "Plan of bevestig het bezoek voordat je verder werkt."
    };
  }

  const daysUntilVisit = Math.floor((workspace.visit.visitAt - startOfToday()) / DAY_MS);

  if (daysUntilVisit <= 1) {
    return {
      level: "red",
      label: "Rood",
      title: daysUntilVisit < 0 ? "Afspraak is verlopen" : "Afspraak heeft haast",
      description: "Vandaag of uiterlijk morgen oppakken."
    };
  }

  if (daysUntilVisit <= 7) {
    return {
      level: "orange",
      label: "Oranje",
      title: "Binnenkort opmeten",
      description: "Voorbereiden en klantgegevens controleren."
    };
  }

  return {
    level: "green",
    label: "Groen",
    title: "Rustig ingepland",
    description: "Er is nog voldoende tijd tot het meetmoment."
  };
}

function UrgencyIcon({ level }: { level: FieldUrgency["level"] }) {
  if (level === "green") {
    return <CheckCircle2 size={22} aria-hidden="true" />;
  }

  if (level === "orange") {
    return <Clock3 size={22} aria-hidden="true" />;
  }

  return <AlertTriangle size={22} aria-hidden="true" />;
}

export default function FieldProjectWorkspace({ session, projectId }: FieldProjectWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FieldProjectWorkspaceResult | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditQuote = canEditQuotes(session.role);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan dit klantbezoek nu niet bereiken.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.portal.fieldProjectWorkspace, {
        tenantSlug: session.tenantId,
        projectId
      })) as FieldProjectWorkspaceResult | null;

      setWorkspace(result);
      setSelectedQuoteId((current) => {
        if (!result) {
          return "";
        }

        return current || pickInitialQuote(result.quotes)?.id || "";
      });
    } catch (loadError) {
      console.error(loadError);
      setError("Klantbezoek kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session.tenantId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const selectedQuote = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return workspace.quotes.find((quote) => quote.id === selectedQuoteId) ?? pickInitialQuote(workspace.quotes) ?? null;
  }, [selectedQuoteId, workspace]);
  const draftQuote = workspace?.quotes.find((quote) => quote.status === "draft") ?? null;
  const address = workspace ? customerAddress(workspace) : undefined;
  const canEditSelectedQuote = canEditQuote && selectedQuote?.status === "draft";

  async function createConceptQuote() {
    if (!workspace || isCreatingQuote) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de conceptofferte nu niet maken.");
      return;
    }

    setIsCreatingQuote(true);
    setError(null);

    try {
      const quoteId = await client.mutation(api.portal.createQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        projectId: workspace.project.id,
        title: `${workspace.project.title} - conceptofferte`,
        createdByExternalUserId: session.userId
      });

      setSelectedQuoteId(String(quoteId));
      await loadWorkspace();
    } catch (createError) {
      console.error(createError);
      setError("Conceptofferte kon niet worden gemaakt.");
    } finally {
      setIsCreatingQuote(false);
    }
  }

  async function addQuoteLine(line: QuoteLineFormValues): Promise<string | void> {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de offertepost nu niet opslaan.");
      return;
    }

    const lineId = await client.mutation(api.portal.addQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuote.id,
      ...line
    });
    await loadWorkspace();
    return String(lineId);
  }

  async function deleteQuoteLine(lineId: string) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de offertepost nu niet verwijderen.");
      return;
    }

    await client.mutation(api.portal.deleteQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      lineId
    });
    await loadWorkspace();
  }

  async function updateQuoteLine(lineId: string, line: QuoteLineFormValues) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de offertepost nu niet aanpassen.");
      return;
    }

    await client.mutation(api.portal.updateQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      lineId,
      ...line
    });
    await loadWorkspace();
  }

  async function updateQuoteStatus(status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled") {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de offerte nu niet verwerken.");
      return;
    }

    await client.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuote.id,
      status
    });
    await loadWorkspace();
  }

  async function updateQuoteTerms(terms: string[], paymentTerms: string[]) {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de klantversie nu niet opslaan.");
      return;
    }

    await client.mutation(api.portal.updateQuoteTerms, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuote.id,
      terms,
      paymentTerms
    });
    await loadWorkspace();
  }

  if (isLoading) {
    return (
      <div className="panel field-loading-state">
        Klantbezoek voor Inmeten, Conceptofferte en Klantversie laden...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="grid">
        {error ? <Alert variant="danger" title="Klantbezoek niet geladen" description={error} /> : null}
        <EmptyState
          title="Klantbezoek niet gevonden"
          description="Dit dossier bestaat niet of hoort niet bij deze werkplek."
        />
      </div>
    );
  }

  const urgency = visitUrgency(workspace);

  return (
    <div className="grid field-project-workspace">
      {error ? <Alert variant="danger" title="Klantbezoek niet geladen" description={error} /> : null}

      <section className={`field-visit-header field-visit-header-${urgency.level}`}>
        <div className="field-visit-title">
          <p className="eyebrow">Klantbezoek</p>
          <h1>{workspace.project.title}</h1>
          <div className="field-visit-badges">
            <StatusBadge
              status={workspace.project.status}
              label={formatProjectStatus(workspace.project.status)}
            />
            {workspace.visit.measurementStatus ? (
              <StatusBadge
                status={workspace.visit.measurementStatus}
                label={formatMeasurementStatus(workspace.visit.measurementStatus)}
              />
            ) : null}
          </div>
        </div>

        <div className="field-visit-side">
          <div className={`field-urgency-card field-urgency-${urgency.level}`}>
            <span className="field-urgency-label">
              <UrgencyIcon level={urgency.level} />
              {urgency.label}
            </span>
            <strong>{urgency.title}</strong>
            <p>{urgency.description}</p>
          </div>

          <div className="field-visit-actions">
            {workspace.customer?.phone ? (
              <a className="ui-button ui-button-primary ui-button-md" href={`tel:${workspace.customer.phone}`}>
                <Phone size={17} aria-hidden="true" />
                <span>Bellen</span>
              </a>
            ) : null}
            {workspace.customer?.email ? (
              <a className="ui-button ui-button-secondary ui-button-md" href={`mailto:${workspace.customer.email}`}>
                <Mail size={17} aria-hidden="true" />
                <span>Mail</span>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="field-action-plan" aria-label="Werkvolgorde klantbezoek">
        <article className="field-action-card">
          <span>1</span>
          <div>
            <strong>Klant en adres</strong>
            <p>{workspace.customer?.displayName ?? "Onbekende klant"}</p>
            {address ? (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}>
                <MapPin size={16} aria-hidden="true" />
                Route openen
              </a>
            ) : null}
          </div>
        </article>
        <a className="field-action-card" href="#inmeten">
          <span>2</span>
          <div>
            <strong>Inmeten</strong>
            <p>{workspace.visit.measurementStatus ? formatMeasurementStatus(workspace.visit.measurementStatus) : "Nog te starten"}</p>
          </div>
        </a>
        <a className="field-action-card" href="#conceptofferte">
          <span>3</span>
          <div>
            <strong>Conceptofferte</strong>
            <p>{selectedQuote ? formatQuoteStatus(selectedQuote.status) : "Nog niet gestart"}</p>
          </div>
        </a>
      </section>

      <section className="grid field-project-grid">
        <article className="panel field-customer-card">
          <SectionHeader compact title="Klantgegevens" description="Alles wat nodig is voor het bezoek." />
          <dl className="field-detail-list">
            <div>
              <dt>Klant</dt>
              <dd>{workspace.customer?.displayName ?? "Onbekende klant"}</dd>
            </div>
            <div>
              <dt>Telefoon</dt>
              <dd>{workspace.customer?.phone ?? "-"}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{workspace.customer?.email ?? "-"}</dd>
            </div>
            <div>
              <dt>Adres</dt>
              <dd>{address ?? "-"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel field-customer-card">
          <SectionHeader compact title="Bezoekstatus" description="Meetmoment en relevante notities." />
          <dl className="field-detail-list">
            <div>
              <dt>Status</dt>
              <dd>{workspace.visit.status}</dd>
            </div>
            <div>
              <dt>Meetdatum</dt>
              <dd>{workspace.visit.visitAt ? formatDate(workspace.visit.visitAt) : "-"}</dd>
            </div>
            <div>
              <dt>Projectnotitie</dt>
              <dd>{workspace.project.customerNotes ?? workspace.project.description ?? "-"}</dd>
            </div>
            <div>
              <dt>Klantnotitie</dt>
              <dd>{workspace.customer?.notes ?? "-"}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="field-measurement-section" id="inmeten">
        <SectionHeader
          compact
          title="Inmeten"
          description="Leg ruimtes en meetregels vast voor vloeren, ramen en andere werkzaamheden."
          actions={<Ruler size={20} aria-hidden="true" />}
        />
        <MeasurementPanel
          mode="field"
          session={session}
          tenantId={session.tenantId}
          projectId={workspace.project.id}
          customerId={workspace.customer?.id ?? workspace.project.customerId}
          projectRooms={workspace.project.rooms}
        />
      </section>

      <section className="field-quote-section" id="conceptofferte">
        <SectionHeader
          compact
          title="Conceptofferte"
          description="Werk aan posten, voorwaarden en een nette Klantversie op basis van de inmeting."
          actions={
            !draftQuote && canEditQuote ? (
              <Button
                isLoading={isCreatingQuote}
                leftIcon={<Save size={17} aria-hidden="true" />}
                onClick={createConceptQuote}
                variant="primary"
              >
                Conceptofferte maken
              </Button>
            ) : selectedQuote ? (
              <span className="field-customer-version">
                <Printer size={17} aria-hidden="true" />
                Klantversie
              </span>
            ) : null
          }
        />

        {workspace.quotes.length > 1 ? (
          <div className="field-quote-tabs" aria-label="Conceptoffertes">
            {workspace.quotes.map((quote) => (
              <button
                key={quote.id}
                className={quote.id === selectedQuote?.id ? "field-quote-tab active" : "field-quote-tab"}
                type="button"
                onClick={() => setSelectedQuoteId(quote.id)}
              >
                <FileText size={16} aria-hidden="true" />
                <span>{quote.quoteNumber}</span>
                <small>{formatQuoteStatus(quote.status)}</small>
              </button>
            ))}
          </div>
        ) : null}

        {selectedQuote ? (
          <QuoteBuilder
            mode="field"
            quote={selectedQuote}
            customer={workspace.customer ?? undefined}
            canEdit={canEditSelectedQuote}
            session={session}
            project={workspace.project}
            quoteTemplates={workspace.templates}
            onAddLine={addQuoteLine}
            onDeleteLine={deleteQuoteLine}
            onUpdateLine={updateQuoteLine}
            onUpdateStatus={updateQuoteStatus}
            onMeasurementLinesImported={loadWorkspace}
            onUpdateTerms={updateQuoteTerms}
          />
        ) : (
          <EmptyState
            title="Nog geen conceptofferte"
            description={
              canEditQuote
                ? "Maak een conceptofferte zodra de inmeting voldoende is uitgewerkt."
                : "Je kunt de klantgegevens en inmeting bekijken, maar geen offerte opslaan."
            }
          />
        )}
      </section>
    </div>
  );
}
