import type { ImportWarning } from "../../lib/portalTypes";

type ImportWarningsProps = {
  warnings: ImportWarning[];
};

export default function ImportWarnings({ warnings }: ImportWarningsProps) {
  if (warnings.length === 0) {
    return <div className="empty-state">Geen waarschuwingen.</div>;
  }

  return (
    <div className="grid">
      {warnings.map((warning) => (
        <div className="card" key={`${warning.rowNumber}-${warning.message}`}>
          <span className={warning.severity === "error" ? "badge danger" : "badge warning"}>
            regel {warning.rowNumber}
          </span>
          <p>{warning.message}</p>
        </div>
      ))}
    </div>
  );
}
