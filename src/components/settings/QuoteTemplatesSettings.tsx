import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { QuoteTemplate } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import { StatCard } from "../ui/StatCard";
import { QuoteTemplateCard } from "./QuoteTemplateCard";

type QuoteTemplatesSettingsProps = {
  session: AppSession;
};

export default function QuoteTemplatesSettings({ session }: QuoteTemplatesSettingsProps) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient(session);

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

  async function handleSaveTemplate(
    templateId: string,
    defaultTerms: string[],
    paymentTerms: string[]
  ) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingTemplateId(templateId);
    setError(null);
    setMessage(null);

    try {
      await client.mutation(api.portal.updateQuoteTemplateContent, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        templateId,
        defaultTerms,
        paymentTerms
      });
      setMessage("Voorwaarden en betalingsafspraken opgeslagen. Nieuwe offertes gebruiken deze teksten.");
      
      // Update template content in local state without full reload
      setTemplates((current) =>
        current.map((t) =>
          t.id === templateId
            ? { ...t, defaultTerms, paymentTerms }
            : t
        )
      );
    } catch (saveError) {
      console.error(saveError);
      setError("Voorwaarden konden niet worden opgeslagen.");
      throw saveError;
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
        <QuoteTemplateCard
          key={template.id}
          template={template}
          isSaving={savingTemplateId === template.id}
          onSave={handleSaveTemplate}
        />
      ))}
    </div>
  );
}
