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
  return template.standaardRegels
    .filter((line) => line.sectieSleutel === sectionKey)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function fallbackLines(template: QuoteTemplate) {
  const sectionKeys = new Set((template.secties ?? []).map((section) => section.sleutel));

  return template.standaardRegels
    .filter((line) => !line.sectieSleutel || !sectionKeys.has(line.sectieSleutel))
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function QuoteTemplateCard({ template, isSaving, onSave }: QuoteTemplateCardProps) {
  const [terms, setTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  useEffect(() => {
    setTerms(polishQuoteTemplateLines(template.standaardVoorwaarden).join("\n"));
    setPaymentTerms(polishQuoteTemplateLines(template.betalingsvoorwaarden ?? []).join("\n"));
  }, [template]);

  async function handleSave() {
    await onSave(template.id, splitLines(terms), splitLines(paymentTerms));
  }

  return (
    <section className="panel">
      <SectionHeader
        compact
        title={template.naam}
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
            {(template.secties ?? []).map((section) => (
              <Badge key={section.sleutel} variant="neutral">
                {section.sortOrder}. {polishQuoteTemplateText(section.titel)}
              </Badge>
            ))}
          </div>
        </Card>
        <Card variant="muted">
          <h3>Soorten posten</h3>
          <div className="quote-template-chip-list">
            {Array.from(new Set(template.standaardRegels.map((line) => line.regelType))).map(
              (regelType) => (
                <Badge key={regelType} variant="info">
                  {formatLineType(regelType)}
                </Badge>
              )
            )}
          </div>
        </Card>
      </div>

      <div className="quote-template-sections">
        {(template.secties ?? []).map((section) => {
          const lines = sectionLines(template, section.sleutel);

          if (
            lines.length === 0 ||
            section.sleutel === "voorwaarden" ||
            section.sleutel === "facturering"
          ) {
            return null;
          }

          return (
            <Card padding="sm" key={section.sleutel}>
              <div className="quote-template-section-title">
                <div>
                  <h3>{polishQuoteTemplateText(section.titel)}</h3>
                  {section.omschrijving ? (
                    <p className="muted">{polishQuoteTemplateText(section.omschrijving)}</p>
                  ) : null}
                </div>
                <Badge variant="neutral">{lines.length} regels</Badge>
              </div>
              <div className="quote-template-section-lines">
                {lines.map((line) => (
                  <div className="quote-template-line" key={`${line.sortOrder}-${line.titel}`}>
                    <Badge variant="neutral">{formatLineType(line.regelType)}</Badge>
                    <div>
                      <strong>{polishQuoteTemplateText(line.titel)}</strong>
                      {line.omschrijving ? (
                        <p className="muted">{polishQuoteTemplateText(line.omschrijving)}</p>
                      ) : null}
                      <small className="quote-template-line-meta">
                        {line.standaardIngeschakeld ? "Standaard ingeschakeld" : "Optioneel"} ·{" "}
                        {formatUnit(line.eenheid)}
                        {line.categorieHint ? ` · Categorie: ${polishQuoteTemplateText(line.categorieHint)}` : ""}
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
                <div className="quote-template-line" key={`${line.sortOrder}-${line.titel}`}>
                  <Badge variant="neutral">{formatLineType(line.regelType)}</Badge>
                  <div>
                    <strong>{polishQuoteTemplateText(line.titel)}</strong>
                    {line.omschrijving ? (
                      <p className="muted">{polishQuoteTemplateText(line.omschrijving)}</p>
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
