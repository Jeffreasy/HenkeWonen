import { CalendarClock, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { FormModal } from "../ui/overlays/FormModal";

export type TeamMember = {
  id: string;
  naam: string;
  email: string;
  role: string;
};

type PlanMeasurementModalProps = {
  open: boolean;
  teamMembers: TeamMember[];
  defaultDate: string;
  defaultMeasuredBy: string;
  isSaving: boolean;
  onSubmit: (data: { date: string; measuredBy: string }) => void;
  onClose: () => void;
};

export function PlanMeasurementModal({
  open,
  teamMembers,
  defaultDate,
  defaultMeasuredBy,
  isSaving,
  onSubmit,
  onClose
}: PlanMeasurementModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [measuredBy, setMeasuredBy] = useState(defaultMeasuredBy);

  // Synchroniseer met de defaults zodra de modal opent (de winkelmedewerker
  // opent 'm vanuit het dossier; we vullen datum + huidige gebruiker voor).
  useEffect(() => {
    if (open) {
      setDate(defaultDate);
      setMeasuredBy(defaultMeasuredBy);
    }
  }, [open, defaultDate, defaultMeasuredBy]);

  function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!date) {
      return;
    }
    onSubmit({ date, measuredBy });
  }

  // Behoud een bestaande (vrije-tekst) monteurnaam die niet in de teamlijst
  // staat, zodat we 'm niet stilletjes wegvagen.
  const knownNames = new Set(teamMembers.map((member) => member.naam));

  return (
    <FormModal
      open={open}
      title="Inmeetbezoek inplannen"
      description="Kies een datum en wijs een monteur toe. Het bezoek verschijnt in de buitendienst-planning (Inmeten, en op de dag zelf onder Vandaag)."
      size="sm"
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <Field htmlFor="plan-measurement-date" label="Inmeetdatum" required>
          <Input
            id="plan-measurement-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
        <Field
          htmlFor="plan-measurement-monteur"
          label="Monteur"
          description="Wie voert de inmeting uit? Verschijnt op de buitendienst-kaart."
        >
          <Select
            id="plan-measurement-monteur"
            value={measuredBy}
            onChange={(event) => setMeasuredBy(event.target.value)}
          >
            <option value="">Nog niet toegewezen</option>
            {measuredBy && !knownNames.has(measuredBy) ? (
              <option value={measuredBy}>{measuredBy}</option>
            ) : null}
            {teamMembers.map((member) => (
              <option key={member.id} value={member.naam}>
                {member.naam}
              </option>
            ))}
          </Select>
        </Field>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<CalendarClock size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Inplannen
          </Button>
          <Button
            variant="secondary"
            leftIcon={<X size={15} aria-hidden="true" />}
            onClick={onClose}
            type="button"
          >
            Annuleren
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
