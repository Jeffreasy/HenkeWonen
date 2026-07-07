import { Hammer, Layers, Package, Pencil, Percent, Type, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatLineType } from "../../lib/i18n/statusLabels";
import type { QuoteLineType } from "../../lib/portalTypes";

const ICONS: Record<QuoteLineType, LucideIcon> = {
  product: Package,
  service: Wrench,
  labor: Hammer,
  material: Layers,
  discount: Percent,
  text: Type,
  manual: Pencil
};

type LineTypeButtonsProps = {
  value: QuoteLineType;
  options: QuoteLineType[];
  onChange: (type: QuoteLineType) => void;
  label?: string;
};

/**
 * Soort offertepost als knoppenrij (Product · Werkzaamheid · Arbeid · Materiaal ·
 * Korting · Tekst) i.p.v. een dropdown — op klantverzoek. Elke knop toont een icoon
 * plus label; de gekozen soort krijgt een accent.
 */
export function LineTypeButtons({ value, options, onChange, label = "Soort post" }: LineTypeButtonsProps) {
  return (
    <div className="line-type-buttons-field">
      <span className="line-type-buttons-label">{label}</span>
      <div className="line-type-buttons" role="group" aria-label={label}>
        {options.map((type) => {
          const Icon = ICONS[type];
          const selected = type === value;

          return (
            <button
              key={type}
              type="button"
              className={`line-type-button${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => onChange(type)}
            >
              <Icon size={16} aria-hidden="true" />
              {formatLineType(type)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
