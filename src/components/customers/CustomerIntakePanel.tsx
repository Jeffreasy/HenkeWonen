import { ClipboardList } from "lucide-react";
import { useState } from "react";
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
};

type CustomerIntakePanelProps = {
  onStartProject: (scope: CustomerScopeOption) => Promise<void> | void;
};

export const customerScopeOptions: CustomerScopeOption[] = [
  {
    id: "pvc",
    label: "PVC vloer",
    description: "Vloeroppervlak, legwijze en snijverlies.",
    projectTitle: "PVC vloer",
    projectDescription: "Aanvraag gestart vanuit klantdossier: PVC vloer."
  },
  {
    id: "tapijt",
    label: "Tapijt",
    description: "Vloeroppervlak en plaatsingsnotities.",
    projectTitle: "Tapijt",
    projectDescription: "Aanvraag gestart vanuit klantdossier: tapijt."
  },
  {
    id: "vinyl",
    label: "Vinyl",
    description: "Vloeroppervlak en snijverlies.",
    projectTitle: "Vinyl",
    projectDescription: "Aanvraag gestart vanuit klantdossier: vinyl."
  },
  {
    id: "plinten",
    label: "Plinten",
    description: "Omtrek, deuropeningen en meters plint.",
    projectTitle: "Plinten",
    projectDescription: "Aanvraag gestart vanuit klantdossier: plinten."
  },
  {
    id: "behang",
    label: "Behang",
    description: "Wandmaat, rolbreedte, rollengte en patroonrapport.",
    projectTitle: "Behang",
    projectDescription: "Aanvraag gestart vanuit klantdossier: behang."
  },
  {
    id: "raambekleding",
    label: "Raambekleding",
    description: "Vrije maatregel voor raamdecoratie.",
    projectTitle: "Raambekleding",
    projectDescription: "Aanvraag gestart vanuit klantdossier: raambekleding."
  },
  {
    id: "gordijnen",
    label: "Gordijnen",
    description: "Vrije maatregel voor gordijnen en rails.",
    projectTitle: "Gordijnen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: gordijnen."
  },
  {
    id: "overig",
    label: "Overig",
    description: "Vrije aanvraag die niet in de andere werksoorten past.",
    projectTitle: "Nieuwe aanvraag",
    projectDescription: "Aanvraag gestart vanuit klantdossier."
  },
  {
    id: "verkoop",
    label: "Directe verkoop / product",
    description: "Klant koopt een product zonder inmeten — meteen door naar de offerte.",
    projectTitle: "Directe verkoop",
    projectDescription: "Aanvraag gestart vanuit klantdossier: directe verkoop.",
    target: "quote"
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
        description="Kies een werksoort en start direct een traject vanuit dit klantdossier."
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
