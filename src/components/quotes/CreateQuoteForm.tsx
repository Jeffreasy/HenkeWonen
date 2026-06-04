import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalProject } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";

type CreateQuoteFormProps = {
  projects: PortalProject[];
  onCreateQuote: (projectId: string, title: string) => Promise<void>;
};

export function CreateQuoteForm({ projects, onCreateQuote }: CreateQuoteFormProps) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!projectId || !title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreateQuote(projectId, title.trim());
      setTitle("");
    } catch (err) {
      // Keep state on failure
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Nieuwe offerte"
        description="Start een offerte vanuit een bestaand project."
      />
      <form className="responsive-form-row" onSubmit={handleSubmit}>
        <Field htmlFor="quote-project" label="Project" required>
          <Select
            id="quote-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            required
          >
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.title}
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
    </section>
  );
}
