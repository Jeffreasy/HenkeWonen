import { Save , X} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { formatMeasurementProductGroup, formatStatusLabel } from "../../lib/i18n/statusLabels";
import type { MeasurementProductGroup } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { type CategoryRow } from "./settings/settingsTypes";

// Lokaal gehouden i.p.v. import uit measurementTypes (dat de calculator-tree meesleept).
const PRODUCT_GROUP_OPTIONS: MeasurementProductGroup[] = [
  "flooring",
  "plinths",
  "wallpaper",
  "wall_panels",
  "curtains",
  "rails",
  "stairs",
  "other"
];

type CategoryFormProps = {
  category: CategoryRow | null;
  defaultSortOrder: string;
  isSaving: boolean;
  onSave: (data: {
    name: string;
    slug: string;
    productGroep?: MeasurementProductGroup;
    sortOrder: number;
    status: "active" | "inactive";
  }) => Promise<void>;
  onCancel: () => void;
};

function slugFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryForm({
  category,
  defaultSortOrder,
  isSaving,
  onSave,
  onCancel
}: CategoryFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [productGroep, setProductGroep] = useState<MeasurementProductGroup | "">("");
  const [sortOrder, setSortOrder] = useState("10");
  const [status, setStatus] = useState<CategoryRow["status"]>("active");

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(Boolean(category), formRef);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setProductGroep(category.productGroep ?? "");
      setSortOrder(String(category.sortOrder));
      setStatus(category.status);
    } else {
      setName("");
      setSlug("");
      setProductGroep("");
      setSortOrder(defaultSortOrder);
      setStatus("active");
    }
  }, [category, defaultSortOrder]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim() || slugFromName(name),
        productGroep: productGroep || undefined,
        sortOrder: Number(sortOrder) || 0,
        status
      });

      if (!category) {
        setName("");
        setSlug("");
        setProductGroep("");
        setSortOrder(defaultSortOrder);
        setStatus("active");
      }
    } catch {
      // Fout is al gemeld via toast; behoud de invoer.
    }
  }

  return (
    <section className="panel">
      <form
        className={category ? "form-grid edit-work-panel" : "form-grid"}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <SectionHeader
          compact
          title={category ? `Productgroep bewerken: ${category.name}` : "Productgroep toevoegen"}
          description={
            category
              ? "Je past nu deze productgroep aan. Bestaande producten blijven gekoppeld."
              : "Gebruik productgroepen voor duidelijke catalogusindeling en offertekeuzes."
          }
          actions={<StatusBadge status={status} label={formatStatusLabel(status)} />}
        />
        <div className="grid three-column">
          <Field htmlFor="category-name" label="Naam" required>
            <Input
              id="category-name"
              required
              value={name}
              onChange={(event) => {
                const newName = event.target.value;
                setName(newName);
                if (!category && (!slug || slug === slugFromName(name))) {
                  setSlug(slugFromName(newName));
                }
              }}
            />
          </Field>
          <Field htmlFor="category-slug" label="Interne sleutel">
            <Input
              id="category-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </Field>
          <Field htmlFor="category-sort-order" label="Volgorde">
            <Input
              id="category-sort-order"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        <Field
          htmlFor="category-productgroep"
          label="Meetgroep"
          description="Koppelt deze categorie aan een inmeet-/offertegroep (Vloeren, Gordijnen, …). Bepaalt waarop de catalogus- en offertekiezer filtert. 'Geen' = niet gekoppeld."
        >
          <Select
            id="category-productgroep"
            value={productGroep}
            onChange={(event) => setProductGroep(event.target.value as MeasurementProductGroup | "")}
          >
            <option value="">Geen productgroep</option>
            {PRODUCT_GROUP_OPTIONS.map((group) => (
              <option value={group} key={group}>
                {formatMeasurementProductGroup(group)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="category-status" label="Status">
          <Select
            id="category-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as CategoryRow["status"])}
          >
            <option value="active">{formatStatusLabel("active")}</option>
            <option value="inactive">{formatStatusLabel("inactive")}</option>
          </Select>
        </Field>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Productgroep opslaan
          </Button>
          {category ? (
            <Button variant="secondary" leftIcon={<X size={15} aria-hidden="true" />} onClick={onCancel}>
              Annuleren
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
