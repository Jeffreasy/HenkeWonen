import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalProject } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";

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
