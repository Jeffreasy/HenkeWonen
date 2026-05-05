import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatLineType, formatStatusLabel, formatUnit } from "../../lib/i18n/statusLabels";
import type { QuoteTemplate } from "../../lib/portalTypes";
import { polishQuoteTemplateLines, polishQuoteTemplateText } from "../../lib/quoteTemplateCopy";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatCard } from "../ui/StatCard";
import { Textarea } from "../ui/Textarea";

type QuoteTemplatesSettingsProps = {
  session: AppSession;
};

type Drafts = Record<string, { terms: string; paymentTerms: string }>;

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function sectionLines(template: QuoteTemplate, sectionKey: string) {
  return template.defaultLines
    .filter((line) => line.sectionKey === sectionKey)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function fallbackLines(template: QuoteTemplate) {
  const sectionKeys = new Set((template.sections ?? []).map((section) => section.key));

  return template.defaultLines
    .filter((line) => !line.sectionKey || !sectionKeys.has(line.sectionKey))
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export default function QuoteTemplatesSettings({ session }: QuoteTemplatesSettingsProps) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    const convexClient = client;

    async function loadTemplates() {
      setIsLoading(true);
      setError(null);

      try {
        const result = (await convexClient.query(api.portal.listQuoteTemplates, {
          tenantSlug: session.tenantId
        })) as QuoteTemplate[];

        if (isActive) {
          setTemplates(result);
          setDrafts(
            Object.fromEntries(
              result.map((template) => [
                template.id,
                {
                  terms: polishQuoteTemplateLines(template.defaultTerms).join("\n"),
                  paymentTerms: polishQuoteTemplateLines(template.paymentTerms ?? []).join("\n")
                }
              ])
            )
          );
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Offerteteksten konden niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      isActive = false;
    };
  }, [session.tenantId]);

  const lineCount = useMemo(
    () => templates.reduce((sum, template) => sum + template.defaultLines.length, 0),
    [templates]
  );

  async function saveTemplate(template: QuoteTemplate) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    const draft = drafts[template.id];
    setSavingTemplateId(template.id);
    setError(null);
    setMessage(null);

    try {
      await client.mutation(api.portal.updateQuoteTemplateContent, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        templateId: template.id,
        defaultTerms: splitLines(draft?.terms ?? ""),
        paymentTerms: splitLines(draft?.paymentTerms ?? "")
      });
      setMessage("Voorwaarden en betalingsafspraken opgeslagen. Nieuwe offertes gebruiken deze teksten.");
    } catch (saveError) {
      console.error(saveError);
      setError("Voorwaarden konden niet worden opgeslagen.");
    } finally {
      setSavingTemplateId(null);
    }
  }

  if (isLoading) {
    return (
      <LoadingState
        title="Offerteteksten laden..."
        description="De standaardregels, voorwaarden en betalingsafspraken worden opgehaald."
      />
    );
  }

  if (error && templates.length === 0) {
    return (
      <ErrorState
        title="Offerteteksten konden niet worden geladen"
        description={error}
      />
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="Geen offerteteksten"
        description="Standaardteksten verschijnen hier zodra ze zijn toegevoegd."
      />
    );
  }

  return (
    <div className="grid">
      {message ? <Alert variant="success" title={message} /> : null}
      {error ? <Alert variant="danger" title="Opslaan mislukt" description={error} /> : null}
      <Alert
        variant="info"
        title="Wijzigingen gelden voor nieuwe offertes"
        description="Nieuwe offertes nemen deze voorwaarden en betalingsafspraken over. Bestaande offertes bewaren hun eigen teksten, zodat lopende offertes niet stil worden aangepast."
      />

      <section className="grid quote-template-summary">
        <StatCard label="Offerteteksten" value={templates.length} description="Beschikbaar voor nieuwe offertes" />
        <StatCard label="Standaardregels" value={lineCount} description="Te gebruiken bij offerte maken" />
        <StatCard
          label="Voorwaarden"
          value={templates.reduce((sum, template) => sum + template.defaultTerms.length, 0)}
          description="Uitvoering en voorbereiding"
        />
        <StatCard
          label="Betalingsafspraken"
          value={templates.reduce((sum, template) => sum + (template.paymentTerms ?? []).length, 0)}
          description="Facturering en betaalwijze"
        />
      </section>

      {templates.map((template) => (
        <section className="panel" key={template.id}>
          <SectionHeader
            compact
            title={template.name}
            description="Standaard offerteblokken, voorwaarden en betalingsafspraken voor nieuwe offertes."
            actions={
              <div className="quote-template-header-badges">
                <Badge variant="accent">{formatStatusLabel(template.type)}</Badge>
                <Badge variant={template.status === "active" ? "success" : "neutral"}>
                  {formatStatusLabel(template.status ?? "active")}
                </Badge>
              </div>
            }
          />

          <div className="grid two-column-even">
            <Card variant="muted">
              <h3>Secties</h3>
              <div className="quote-template-chip-list">
                {(template.sections ?? []).map((section) => (
                  <Badge key={section.key} variant="neutral">
                    {section.sortOrder}. {polishQuoteTemplateText(section.title)}
                  </Badge>
                ))}
              </div>
            </Card>
            <Card variant="muted">
              <h3>Soorten posten</h3>
              <div className="quote-template-chip-list">
                {Array.from(new Set(template.defaultLines.map((line) => line.lineType))).map(
                  (lineType) => (
                    <Badge key={lineType} variant="info">
                      {formatLineType(lineType)}
                    </Badge>
                  )
                )}
              </div>
            </Card>
          </div>

          <div className="quote-template-sections">
            {(template.sections ?? []).map((section) => {
              const lines = sectionLines(template, section.key);

              if (lines.length === 0 || section.key === "voorwaarden" || section.key === "facturering") {
                return null;
              }

              return (
                <Card padding="sm" key={section.key}>
                  <div className="quote-template-section-title">
                    <div>
                      <h3>{polishQuoteTemplateText(section.title)}</h3>
                      {section.description ? <p className="muted">{polishQuoteTemplateText(section.description)}</p> : null}
                    </div>
                    <Badge variant="neutral">{lines.length} regels</Badge>
                  </div>
                  <div className="quote-template-section-lines">
                    {lines.map((line) => (
                      <div className="quote-template-line" key={`${line.sortOrder}-${line.title}`}>
                        <Badge variant="neutral">{formatLineType(line.lineType)}</Badge>
                        <div>
                          <strong>{polishQuoteTemplateText(line.title)}</strong>
                          {line.description ? <p className="muted">{polishQuoteTemplateText(line.description)}</p> : null}
                          <small className="quote-template-line-meta">
                            {line.defaultEnabled ? "Standaard ingeschakeld" : "Optioneel"} ·{" "}
                            {formatUnit(line.unit)}
                            {line.categoryHint ? ` · Categorie: ${polishQuoteTemplateText(line.categoryHint)}` : ""}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
            {fallbackLines(template).length > 0 ? (
              <Card padding="sm">
                <h3>Overige posten</h3>
                <div className="quote-template-section-lines">
                  {fallbackLines(template).map((line) => (
                    <div className="quote-template-line" key={`${line.sortOrder}-${line.title}`}>
                      <Badge variant="neutral">{formatLineType(line.lineType)}</Badge>
                      <div>
                        <strong>{polishQuoteTemplateText(line.title)}</strong>
                        {line.description ? <p className="muted">{polishQuoteTemplateText(line.description)}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="grid two-column-even">
            <Field
              htmlFor={`template-terms-${template.id}`}
              label="Voorwaarden"
              description="Een voorwaarde per regel. Deze teksten gaan over voorbereiding en uitvoering."
            >
              <Textarea
                id={`template-terms-${template.id}`}
                rows={10}
                value={polishQuoteTemplateText(drafts[template.id]?.terms ?? "")}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [template.id]: {
                      terms: event.target.value,
                      paymentTerms: current[template.id]?.paymentTerms ?? ""
                    }
                  }))
                }
              />
            </Field>
            <Field
              htmlFor={`template-payment-terms-${template.id}`}
              label="Betalingsafspraken"
              description="Aanbetaling, betalingstermijn en betaalwijze per regel. Deze teksten staan los van uitvoeringsvoorwaarden."
            >
              <Textarea
                id={`template-payment-terms-${template.id}`}
                rows={10}
                value={polishQuoteTemplateText(drafts[template.id]?.paymentTerms ?? "")}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [template.id]: {
                      terms: current[template.id]?.terms ?? "",
                      paymentTerms: event.target.value
                    }
                  }))
                }
              />
            </Field>
          </div>

          <Button
            isLoading={savingTemplateId === template.id}
            leftIcon={<Save size={17} aria-hidden="true" />}
            onClick={() => void saveTemplate(template)}
            variant="primary"
          >
            Voorwaarden en betalingsafspraken opslaan
          </Button>
        </section>
      ))}
    </div>
  );
}
