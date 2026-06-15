import { Save , X} from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalProject } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Textarea } from "../ui/Textarea";

type ProjectEditFormProps = {
  project: PortalProject;
  onSave: (data: {
    title: string;
    description?: string;
    measurementDate?: number;
    executionDate?: number;
    internalNotes?: string;
    customerNotes?: string;
  }) => Promise<void>;
  onCancel: () => void;
};

function toDateInputValue(value?: number) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00`).getTime();
}

export function ProjectEditForm({ project, onSave, onCancel }: ProjectEditFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [measurementDate, setMeasurementDate] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(project.titel);
    setDescription(project.omschrijving ?? "");
    setMeasurementDate(toDateInputValue(project.inmeetdatum));
    setExecutionDate(toDateInputValue(project.uitvoerdatum));
    setInternalNotes(project.interneNotities ?? "");
    setCustomerNotes(project.klantNotities ?? "");
  }, [project]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        measurementDate: fromDateInputValue(measurementDate),
        executionDate: fromDateInputValue(executionDate),
        internalNotes: internalNotes.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined
      });
    } catch (err) {
      // Keep input states on error
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel edit-work-panel">
      <SectionHeader
        compact
        title="Projectgegevens aanpassen"
        description="Wijzig planning, omschrijving en interne of klantzichtbare notities."
      />
      <form className="form-grid" onSubmit={handleSubmit}>
        <Field htmlFor="edit-project-title" label="Projectnaam" required>
          <Input
            id="edit-project-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
        <Field htmlFor="edit-project-description" label="Omschrijving">
          <Textarea
            id="edit-project-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid two-column-even">
          <Field htmlFor="edit-project-measurement-date" label="Inmeetdatum">
            <Input
              id="edit-project-measurement-date"
              type="date"
              value={measurementDate}
              onChange={(event) => setMeasurementDate(event.target.value)}
            />
          </Field>
          <Field htmlFor="edit-project-execution-date" label="Uitvoerdatum">
            <Input
              id="edit-project-execution-date"
              type="date"
              value={executionDate}
              onChange={(event) => setExecutionDate(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid two-column-even">
          <Field htmlFor="edit-project-internal-notes" label="Interne notities">
            <Textarea
              id="edit-project-internal-notes"
              rows={4}
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
            />
          </Field>
          <Field htmlFor="edit-project-customer-notes" label="Notities voor klant">
            <Textarea
              id="edit-project-customer-notes"
              rows={4}
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
            />
          </Field>
        </div>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Projectgegevens opslaan
          </Button>
          <Button variant="secondary" leftIcon={<X size={15} aria-hidden="true" />} onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </section>
  );
}
