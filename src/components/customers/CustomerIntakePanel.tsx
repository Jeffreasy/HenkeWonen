import { ClipboardList } from "lucide-react";
import { useState } from "react";
import type { MeasurementWorktype } from "../../lib/measurementIntent";
import { Button } from "../ui/forms/Button";
import { SectionHeader } from "../ui/layout/SectionHeader";

export type CustomerScopeOption = {
  id: string;
  label: string;
  description: string;
  projectTitle: string;
  projectDescription: string;
  /** Bestemming na het starten. "measurement" = naar de inmeting (standaard),
   *  "quote" = direct naar een nieuwe offerte met catalogus (directe verkoop). */
  target?: "measurement" | "quote";
  /** Werksoort-hint voor het inmeet-paneel: opent de juiste product-tab
   *  (Vloer/Plint/Behang/...) i.p.v. altijd de eerste. */
  werksoort?: MeasurementWorktype;
};

type CustomerIntakePanelProps = {
  onStartProject: (scope: CustomerScopeOption) => Promise<void> | void;
};

export const customerScopeOptions: CustomerScopeOption[] = [
  {
    id: "verkoop",
    label: "Directe verkoop / product",
    description: "Klant koopt een product zonder inmeten — meteen door naar de offerte.",
    projectTitle: "Directe verkoop",
    projectDescription: "Aanvraag gestart vanuit klantdossier: directe verkoop.",
    target: "quote"
  },
  {
    id: "pvc",
    label: "PVC vloer",
    description: "Vloeroppervlak, legwijze en snijverlies.",
    projectTitle: "PVC vloer",
    projectDescription: "Aanvraag gestart vanuit klantdossier: PVC vloer.",
    werksoort: "vloer"
  },
  {
    id: "tapijt",
    label: "Tapijt",
    description: "Vloeroppervlak en plaatsingsnotities.",
    projectTitle: "Tapijt",
    projectDescription: "Aanvraag gestart vanuit klantdossier: tapijt.",
    werksoort: "vloer"
  },
  {
    id: "vinyl",
    label: "Vinyl",
    description: "Vloeroppervlak en snijverlies.",
    projectTitle: "Vinyl",
    projectDescription: "Aanvraag gestart vanuit klantdossier: vinyl.",
    werksoort: "vloer"
  },
  {
    id: "plinten",
    label: "Plinten",
    description: "Omtrek, deuropeningen en meters plint.",
    projectTitle: "Plinten",
    projectDescription: "Aanvraag gestart vanuit klantdossier: plinten.",
    werksoort: "plint"
  },
  {
    id: "trap",
    label: "Traprenovatie",
    description: "Treden, stootborden en trapvorm (recht, kwart- of halve draai).",
    projectTitle: "Traprenovatie",
    projectDescription: "Aanvraag gestart vanuit klantdossier: traprenovatie.",
    werksoort: "trap"
  },
  {
    id: "behang",
    label: "Behang",
    description: "Wandmaat, rolbreedte, rollengte en patroonrapport.",
    projectTitle: "Behang",
    projectDescription: "Aanvraag gestart vanuit klantdossier: behang.",
    werksoort: "behang"
  },
  {
    id: "wandpanelen",
    label: "Wandpanelen",
    description: "Wandmaat en aantal panelen (akoestisch of badkamer).",
    projectTitle: "Wandpanelen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: wandpanelen.",
    werksoort: "wandpaneel"
  },
  {
    id: "raambekleding",
    label: "Raambekleding",
    description: "Jaloezieën en rolgordijnen op maat (breedte × hoogte).",
    projectTitle: "Raambekleding",
    projectDescription: "Aanvraag gestart vanuit klantdossier: raambekleding.",
    werksoort: "raambekleding"
  },
  {
    id: "gordijnen",
    label: "Gordijnen",
    description: "Vrije maatregel voor gordijnen en rails.",
    projectTitle: "Gordijnen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: gordijnen.",
    werksoort: "gordijn"
  },
  {
    id: "overig",
    label: "Overig",
    description: "Vrije aanvraag die niet in de andere werksoorten past.",
    projectTitle: "Nieuwe aanvraag",
    projectDescription: "Aanvraag gestart vanuit klantdossier."
  }
];

export function CustomerIntakePanel({ onStartProject }: CustomerIntakePanelProps) {
  const [startingId, setStartingId] = useState<string | null>(null);

  async function handleStart(scope: CustomerScopeOption) {
    if (startingId) {
      return;
    }

    setStartingId(scope.id);
    try {
      // Bij succes navigeert de aanroeper weg (component unmount); bij een fout
      // wordt de knop in finally weer vrijgegeven zodat de gebruiker opnieuw kan.
      await onStartProject(scope);
    } finally {
      setStartingId(null);
    }
  }

  return (
    <section className="panel customer-detail-panel">
      <SectionHeader
        compact
        title="Aanvraag intake"
        description="Verkoop direct een product, of kies een werksoort om in te meten."
      />
      <div className="customer-scope-list">
        {customerScopeOptions.map((scope) => (
          <details className="customer-scope-disclosure" key={scope.id}>
            <summary>
              <span>{scope.label}</span>
              <small className="muted">{scope.description}</small>
            </summary>
            <div className="customer-scope-content">
              <Button
                leftIcon={<ClipboardList size={16} aria-hidden="true" />}
                onClick={() => void handleStart(scope)}
                disabled={startingId !== null}
                isLoading={startingId === scope.id}
                size="sm"
                variant="primary"
              >
                Aanvraag starten
              </Button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
