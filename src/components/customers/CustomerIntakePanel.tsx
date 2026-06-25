import { ClipboardList } from "lucide-react";
import { Button } from "../ui/forms/Button";
import { SectionHeader } from "../ui/layout/SectionHeader";
import type { FieldMeasureTool } from "../projects/measurement/measurementTypes";

export type CustomerScopeOption = {
  id: string;
  label: string;
  description: string;
  projectTitle: string;
  projectDescription: string;
  measureTool: FieldMeasureTool;
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
    projectDescription: "Aanvraag gestart vanuit klantdossier: PVC vloer.",
    measureTool: "flooring"
  },
  {
    id: "tapijt",
    label: "Tapijt",
    description: "Vloeroppervlak en plaatsingsnotities.",
    projectTitle: "Tapijt",
    projectDescription: "Aanvraag gestart vanuit klantdossier: tapijt.",
    measureTool: "flooring"
  },
  {
    id: "vinyl",
    label: "Vinyl",
    description: "Vloeroppervlak en snijverlies.",
    projectTitle: "Vinyl",
    projectDescription: "Aanvraag gestart vanuit klantdossier: vinyl.",
    measureTool: "flooring"
  },
  {
    id: "plinten",
    label: "Plinten",
    description: "Omtrek, deuropeningen en meters plint.",
    projectTitle: "Plinten",
    projectDescription: "Aanvraag gestart vanuit klantdossier: plinten.",
    measureTool: "plinths"
  },
  {
    id: "behang",
    label: "Behang",
    description: "Wandmaat, rolbreedte, rollengte en patroonrapport.",
    projectTitle: "Behang",
    projectDescription: "Aanvraag gestart vanuit klantdossier: behang.",
    measureTool: "wallpaper"
  },
  {
    id: "raambekleding",
    label: "Raambekleding",
    description: "Vrije maatregel voor raamdecoratie.",
    projectTitle: "Raambekleding",
    projectDescription: "Aanvraag gestart vanuit klantdossier: raambekleding.",
    measureTool: "window_covering"
  },
  {
    id: "gordijnen",
    label: "Gordijnen",
    description: "Vrije maatregel voor gordijnen en rails.",
    projectTitle: "Gordijnen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: gordijnen.",
    measureTool: "curtains"
  },
  {
    id: "overig",
    label: "Overig",
    description: "Vrije aanvraag die niet in de andere werksoorten past.",
    projectTitle: "Nieuwe aanvraag",
    projectDescription: "Aanvraag gestart vanuit klantdossier.",
    measureTool: "manual"
  }
];

export function CustomerIntakePanel({ onStartProject }: CustomerIntakePanelProps) {
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
                onClick={() => void onStartProject(scope)}
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
