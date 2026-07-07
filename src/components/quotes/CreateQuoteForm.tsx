import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalProject, QuoteTemplate } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  default: "Standaard",
  flooring: "Vloeren",
  curtains: "Gordijnen",
  wall_panels: "Wandpanelen",
  custom: "Maatwerk"
};

function templateLabel(template: QuoteTemplate): string {
  const typeLabel = TEMPLATE_TYPE_LABELS[template.type] ?? template.type;
  return template.type === "default" ? template.naam : `${template.naam} — ${typeLabel}`;
}

type CreateQuoteFormProps = {
  projects: PortalProject[];
  /** Actieve offertesjablonen; bepaalt de begintekst/voorwaarden van de nieuwe offerte. */
  templates: QuoteTemplate[];
  /** Vooraf te selecteren project (bv. "Offerte maken" vanuit een dossier). */
  defaultProjectId?: string;
  onCreateQuote: (projectId: string, title: string, templateId: string) => Promise<void>;
};

export function CreateQuoteForm({
  projects,
  templates,
  defaultProjectId,
  onCreateQuote
}: CreateQuoteFormProps) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projectId || projects.length === 0) {
      return;
    }
    const preferred =
      defaultProjectId && projects.some((project) => project.id === defaultProjectId)
        ? defaultProjectId
        : projects[0].id;
    setProjectId(preferred);
  }, [projects, projectId, defaultProjectId]);

  // Begin op het standaardsjabloon (type "default"), anders het eerste beschikbare.
  useEffect(() => {
    if (templateId || templates.length === 0) {
      return;
    }
    const preferred = templates.find((template) => template.type === "default") ?? templates[0];
    setTemplateId(preferred.id);
  }, [templates, templateId]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!projectId || !title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreateQuote(projectId, title.trim(), templateId);
      setTitle("");
    } catch {
      // Fout is al gemeld via toast; behoud de invoer.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <Field htmlFor="quote-project" label="Project" required>
        <Select
          id="quote-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          required
        >
          {projects.map((project) => (
            <option value={project.id} key={project.id}>
              {project.titel}
            </option>
          ))}
        </Select>
      </Field>
      <Field htmlFor="quote-title" label="Offertenaam" required>
        <Input
          id="quote-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>
      {templates.length > 1 ? (
        <Field
          htmlFor="quote-template"
          label="Offertesjabloon"
          description="Bepaalt de begintekst, voorwaarden en betaalafspraken. Je past dit per offerte nog aan."
        >
          <Select
            id="quote-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option value={template.id} key={template.id}>
                {templateLabel(template)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Button
        disabled={projects.length === 0 || isSaving}
        isLoading={isSaving}
        leftIcon={<Save size={17} aria-hidden="true" />}
        type="submit"
        variant="primary"
      >
        Offerte starten
      </Button>
    </form>
  );
}
