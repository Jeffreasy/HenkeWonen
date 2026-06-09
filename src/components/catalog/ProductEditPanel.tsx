import { Save , X} from "lucide-react";
import { useState } from "react";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { type ProductStatus, PRODUCT_STATUSES } from "./catalog/catalogTypes";


export type ProductDraft = {
  name: string;
  articleNumber: string;
  supplierCode: string;
  commercialCode: string;
  colorName: string;
  supplierProductGroup: string;
  packageContentM2: string;
  piecesPerPackage: string;
  status: ProductStatus;
};

type ProductEditPanelProps = {
  displayName: string;
  initialDraft: ProductDraft;
  onSave: (draft: ProductDraft) => Promise<void> | void;
  onCancel: () => void;
  formRef: React.RefObject<HTMLElement | null>;
};

export function ProductEditPanel({
  displayName,
  initialDraft,
  onSave,
  onCancel,
  formRef
}: ProductEditPanelProps) {
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel edit-work-panel" ref={formRef}>
      <SectionHeader
        compact
        title={`Catalogusproduct bewerken: ${displayName}`}
        description="Je past nu dit product aan. Prijshistorie en importherkomst blijven bewaard."
        actions={<StatusBadge status={draft.status} label={formatStatusLabel(draft.status)} />}
      />
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="grid two-column-even">
          <Field htmlFor="product-edit-name" label="Productnaam" required>
            <Input
              id="product-edit-name"
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="product-edit-status" label="Status">
            <Select
              id="product-edit-status"
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value as ProductStatus
                }))
              }
            >
              {PRODUCT_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid three-column">
          <Field htmlFor="product-edit-article" label="Artikelnummer">
            <Input
              id="product-edit-article"
              value={draft.articleNumber}
              onChange={(event) =>
                setDraft((current) => ({ ...current, articleNumber: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="product-edit-supplier-code" label="Leverancierscode">
            <Input
              id="product-edit-supplier-code"
              value={draft.supplierCode}
              onChange={(event) =>
                setDraft((current) => ({ ...current, supplierCode: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="product-edit-commercial" label="Verkoopcode">
            <Input
              id="product-edit-commercial"
              value={draft.commercialCode}
              onChange={(event) =>
                setDraft((current) => ({ ...current, commercialCode: event.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid three-column">
          <Field htmlFor="product-edit-color" label="Kleur">
            <Input
              id="product-edit-color"
              value={draft.colorName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, colorName: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="product-edit-group" label="Leveranciersgroep">
            <Input
              id="product-edit-group"
              value={draft.supplierProductGroup}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  supplierProductGroup: event.target.value
                }))
              }
            />
          </Field>
          <Field htmlFor="product-edit-package" label="Pakinhoud m2">
            <Input
              id="product-edit-package"
              inputMode="decimal"
              value={draft.packageContentM2}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  packageContentM2: event.target.value
                }))
              }
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
            Product opslaan
          </Button>
          <Button variant="secondary" leftIcon={<X size={15} aria-hidden="true" />} onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </section>
  );
}
