import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalRoom } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Textarea } from "../ui/Textarea";

type RoomEditFormProps = {
  room: PortalRoom;
  onSave: (data: {
    name: string;
    floor?: string;
    areaM2?: number;
    perimeterMeter?: number;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
};

function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function numberFromInput(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() ? parsed : undefined;
}

export function RoomEditForm({ room, onSave, onCancel }: RoomEditFormProps) {
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [perimeterMeter, setPerimeterMeter] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(true, formRef);

  useEffect(() => {
    setName(room.name);
    setFloor(room.floor ?? "");
    setAreaM2(decimalText(room.areaM2));
    setPerimeterMeter(decimalText(room.perimeterMeter));
    setNotes(room.notes ?? "");
  }, [room]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        floor: floor.trim() || undefined,
        areaM2: numberFromInput(areaM2),
        perimeterMeter: numberFromInput(perimeterMeter),
        notes: notes.trim() || undefined
      });
    } catch (err) {
      // Keep state on failure
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="form-grid edit-work-panel"
      onSubmit={handleSubmit}
      ref={formRef}
      style={{ marginTop: 16 }}
    >
      <SectionHeader
        compact
        title={`Ruimte aanpassen: ${room.name}`}
        description="Je corrigeert nu deze projectruimte."
      />
      <div className="grid three-column">
        <Field htmlFor="edit-room-name" label="Ruimte" required>
          <Input
            id="edit-room-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field htmlFor="edit-room-area" label="m2">
          <Input
            id="edit-room-area"
            inputMode="decimal"
            value={areaM2}
            onChange={(event) => setAreaM2(event.target.value)}
          />
        </Field>
        <Field htmlFor="edit-room-perimeter" label="Omtrek m">
          <Input
            id="edit-room-perimeter"
            inputMode="decimal"
            value={perimeterMeter}
            onChange={(event) => setPerimeterMeter(event.target.value)}
          />
        </Field>
      </div>
      <Field htmlFor="edit-room-notes" label="Notities">
        <Textarea
          id="edit-room-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <div className="toolbar">
        <Button
          isLoading={isSaving}
          leftIcon={<Save size={17} aria-hidden="true" />}
          type="submit"
          variant="primary"
        >
          Ruimte opslaan
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
