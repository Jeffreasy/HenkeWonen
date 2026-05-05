import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalCustomer } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

export type ProjectFormValues = {
  customerId: string;
  title: string;
  description?: string;
};

type ProjectFormProps = {
  customers: PortalCustomer[];
  onCreate: (project: ProjectFormValues) => Promise<void> | void;
};

export default function ProjectForm({ customers, onCreate }: ProjectFormProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!customerId && customers[0]) {
      setCustomerId(customers[0].id);
    }
  }, [customerId, customers]);

  async function submit(event: SubmitEventLike) {
    event.preventDefault();

    if (!customerId || !title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        customerId,
        title: title.trim(),
        description: description.trim() || undefined
      });

      setTitle("");
      setDescription("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <SectionHeader
        compact
        title="Nieuw project"
        description="Start een traject vanuit een klantdossier."
      />
      {customers.length === 0 ? (
        <EmptyState
          title="Geen klanten beschikbaar"
          description="Maak eerst een klant aan voordat je een project start."
        />
      ) : null}
      <Field htmlFor="project-customer" label="Klant" required>
        <Select
          disabled={customers.length === 0}
          id="project-customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          required
        >
          {customers.map((customer) => (
            <option value={customer.id} key={customer.id}>
              {customer.displayName}
            </option>
          ))}
        </Select>
      </Field>
      <Field htmlFor="project-title" label="Projectnaam" required>
        <Input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>
      <Field htmlFor="project-description" label="Omschrijving">
        <Textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Button
        disabled={customers.length === 0}
        isLoading={isSaving}
        leftIcon={<Save size={17} aria-hidden="true" />}
        type="submit"
        variant="primary"
      >
        {isSaving ? "Starten..." : "Project starten"}
      </Button>
    </form>
  );
}
