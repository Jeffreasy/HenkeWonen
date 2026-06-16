import { FileSpreadsheet } from "lucide-react";
import type { SubmitEventLike } from "../../lib/events";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Select } from "../ui/forms/Select";

type StartImportFormProps = {
  sourceFiles: string[];
  fileName: string;
  supplierName: string;
  setFileName: (value: string) => void;
  setSupplierName: (value: string) => void;
  onSubmit: (event: SubmitEventLike) => void;
  isBusy: boolean;
  isCreatingBatch: boolean;
};

export function StartImportForm({
  sourceFiles,
  fileName,
  supplierName,
  setFileName,
  setSupplierName,
  onSubmit,
  isBusy,
  isCreatingBatch
}: StartImportFormProps) {
  return (
    <section className="panel import-start-panel">
      <form
        className="import-start-form"
        onSubmit={onSubmit}
        aria-label="Nieuwe prijslijstcontrole"
      >
        <div className="import-start-copy">
          <p className="eyebrow">Nieuwe controle</p>
          <h2>Prijslijstcontrole starten</h2>
          <p className="muted">
            Start eerst een veilige preview. Definitief verwerken gebeurt pas vanuit de detailcontrole.
          </p>
        </div>
        <div className="import-start-controls">
          <Field label="Bestand" htmlFor="import-file">
            <Select
              id="import-file"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
            >
              {sourceFiles.map((file) => (
                <option value={file} key={file}>
                  {file}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Leverancier" htmlFor="import-supplier">
            <input
              className="ui-control"
              id="import-supplier"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
            />
          </Field>
          <div className="import-start-action">
            <Button
              className="import-start-submit"
              variant="primary"
              type="submit"
              disabled={isBusy}
              isLoading={isCreatingBatch}
              leftIcon={<FileSpreadsheet size={17} aria-hidden="true" />}
            >
              {isCreatingBatch ? "Preview voorbereiden" : "Preview starten"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
