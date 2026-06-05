import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLineType, formatStatusLabel, formatUnit } from "../../lib/i18n/statusLabels";
import type { QuoteTemplate } from "../../lib/portalTypes";
import { polishQuoteTemplateLines, polishQuoteTemplateText } from "../../lib/quotes/quoteTemplateCopy";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { SectionHeader } from "../ui/SectionHeader";
import { Textarea } from "../ui/Textarea";

type QuoteTemplateCardProps = {
  template: QuoteTemplate;
  isSaving: boolean;
  onSave: (
    templateId: string,
    defaultTerms: string[],
    paymentTerms: string[]
  ) => Promise<void>;
};

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

export function QuoteTemplateCard({ template, isSaving, onSave }: QuoteTemplateCardProps) {
  const [terms, setTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  useEffect(() => {
    setTerms(polishQuoteTemplateLines(template.defaultTerms).join("\n"));
    setPaymentTerms(polishQuoteTemplateLines(template.paymentTerms ?? []).join("\n"));
  }, [template]);

  async function handleSave() {
    await onSave(template.id, splitLines(terms), splitLines(paymentTerms));
  }

  return (
    <section className="panel">
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
                  {section.description ? (
                    <p className="muted">{polishQuoteTemplateText(section.description)}</p>
                  ) : null}
                </div>
                <Badge variant="neutral">{lines.length} regels</Badge>
              </div>
              <div className="quote-template-section-lines">
                {lines.map((line) => (
                  <div className="quote-template-line" key={`${line.sortOrder}-${line.title}`}>
                    <Badge variant="neutral">{formatLineType(line.lineType)}</Badge>
                    <div>
                      <strong>{polishQuoteTemplateText(line.title)}</strong>
                      {line.description ? (
                        <p className="muted">{polishQuoteTemplateText(line.description)}</p>
                      ) : null}
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
                    {line.description ? (
                      <p className="muted">{polishQuoteTemplateText(line.description)}</p>
                    ) : null}
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
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
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
            value={paymentTerms}
            onChange={(event) => setPaymentTerms(event.target.value)}
          />
        </Field>
      </div>

      <Button
        isLoading={isSaving}
        leftIcon={<Save size={17} aria-hidden="true" />}
        onClick={handleSave}
        variant="primary"
      >
        Voorwaarden en betalingsafspraken opslaan
      </Button>
    </section>
  );
}
