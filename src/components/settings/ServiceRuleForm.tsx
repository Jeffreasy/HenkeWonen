import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

type ServiceRuleStatus = "active" | "inactive";
type ServiceRuleCalculationType =
  | "fixed"
  | "per_m2"
  | "per_meter"
  | "per_roll"
  | "per_side"
  | "per_staircase"
  | "manual";

type ServiceRuleRow = {
  id: string;
  name: string;
  description?: string;
  calculationType: ServiceRuleCalculationType;
  priceExVat: number;
  vatRate: number;
  status: ServiceRuleStatus;
};

const calculationTypes: ServiceRuleCalculationType[] = [
  "fixed",
  "per_m2",
  "per_meter",
  "per_roll",
  "per_side",
  "per_staircase",
  "manual"
];

type ServiceRuleFormProps = {
  rule: ServiceRuleRow | null;
  isSaving: boolean;
  onSave: (data: {
    name: string;
    description: string;
    calculationType: ServiceRuleCalculationType;
    priceExVat: number;
    vatRate: number;
    status: ServiceRuleStatus;
  }) => Promise<void>;
  onCancel: () => void;
};

function optionalNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ServiceRuleForm({ rule, isSaving, onSave, onCancel }: ServiceRuleFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calculationType, setCalculationType] = useState<ServiceRuleCalculationType>("fixed");
  const [priceExVat, setPriceExVat] = useState("");
  const [vatRate, setVatRate] = useState("21");
  const [status, setStatus] = useState<ServiceRuleStatus>("active");

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(Boolean(rule), formRef);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description ?? "");
      setCalculationType(rule.calculationType);
      setPriceExVat(String(rule.priceExVat));
      setVatRate(String(rule.vatRate));
      setStatus(rule.status);
    } else {
      setName("");
      setDescription("");
      setCalculationType("fixed");
      setPriceExVat("");
      setVatRate("21");
      setStatus("active");
    }
  }, [rule]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        calculationType,
        priceExVat: optionalNumber(priceExVat),
        vatRate: optionalNumber(vatRate),
        status
      });

      if (!rule) {
        setName("");
        setDescription("");
        setCalculationType("fixed");
        setPriceExVat("");
        setVatRate("21");
        setStatus("active");
      }
    } catch (err) {
      // Keep state so user doesn't lose inputs on failure
    }
  }

  return (
    <section className="panel">
      <form
        className={rule ? "form-grid edit-work-panel" : "form-grid"}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <SectionHeader
          compact
          title={rule ? `Werkzaamheid bewerken: ${rule.name}` : "Werkzaamheid toevoegen"}
          description={
            rule
              ? "Je past nu deze werkzaamheid aan. Historische offertes blijven intact."
              : "Beheer werkzaamheden die als offertepost of standaardregel gebruikt worden."
          }
          actions={<StatusBadge status={status} label={formatStatusLabel(status)} />}
        />
        <div className="grid two-column-even">
          <Field htmlFor="service-rule-name" label="Naam" required>
            <Input
              id="service-rule-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field htmlFor="service-rule-calculation" label="Berekening">
            <Select
              id="service-rule-calculation"
              value={calculationType}
              onChange={(event) => setCalculationType(event.target.value as ServiceRuleCalculationType)}
            >
              {calculationTypes.map((type) => (
                <option key={type} value={type}>
                  {formatStatusLabel(type)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field htmlFor="service-rule-description" label="Omschrijving">
          <Textarea
            id="service-rule-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid three-column">
          <Field htmlFor="service-rule-price" label="Prijs excl. btw">
            <Input
              id="service-rule-price"
              inputMode="decimal"
              value={priceExVat}
              onChange={(event) => setPriceExVat(event.target.value)}
            />
          </Field>
          <Field htmlFor="service-rule-vat" label="Btw %">
            <Input
              id="service-rule-vat"
              inputMode="decimal"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
            />
          </Field>
          <Field htmlFor="service-rule-status" label="Status">
            <Select
              id="service-rule-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ServiceRuleStatus)}
            >
              <option value="active">{formatStatusLabel("active")}</option>
              <option value="inactive">{formatStatusLabel("inactive")}</option>
            </Select>
          </Field>
        </div>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Werkzaamheid opslaan
          </Button>
          {rule ? (
            <Button variant="secondary" onClick={onCancel}>
              Annuleren
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
