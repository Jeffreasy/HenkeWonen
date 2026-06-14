import {
  ArrowUpDown,
  Layers,
  LayoutGrid,
  Minus,
  PanelRight,
  Pencil,
  Save,
  SquareStack
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalcTabId =
  | "flooring"
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "window_covering"
  | "stairs"
  | "manual";

export type CalcTab = {
  id: CalcTabId;
  label: string;
  icon: ReactNode;
  /** Form fields (left column) */
  fields: ReactNode;
  /** Computed result display (right column) */
  result: ReactNode;
  /** Primitive key derived from the computed result — triggers flash animation when it changes */
  resultKey: string | number;
  /** True when at least one field has been filled in */
  hasInput: boolean;
  validationError?: string;
  isSaving: boolean;
  onSubmit: (event: SubmitEventLike) => void;
};

type CalculatorTabsProps = {
  tabs: CalcTab[];
  activeTab: CalcTabId;
  onTabChange: (id: CalcTabId) => void;
};

// ─── Icon map ─────────────────────────────────────────────────────────────────

export const CALC_TAB_ICONS: Record<CalcTabId, ReactNode> = {
  flooring: <SquareStack size={15} aria-hidden="true" />,
  plinths: <Minus size={15} aria-hidden="true" />,
  wallpaper: <Layers size={15} aria-hidden="true" />,
  wall_panels: <PanelRight size={15} aria-hidden="true" />,
  window_covering: <LayoutGrid size={15} aria-hidden="true" />,
  stairs: <ArrowUpDown size={15} aria-hidden="true" />,
  manual: <Pencil size={15} aria-hidden="true" />
};

const INDICATIVE_TEXT =
  "Indicatief — controleer altijd legrichting, patroon, productafmetingen en snijverlies vóór je de inmeetregel opslaat. Een richtprijs is een indicatie; de definitieve prijs bepaal je in de offerte.";

// ─── Result highlight hook ─────────────────────────────────────────────────────

/**
 * Increments a counter whenever `resultKey` changes.
 * `resultKey` must be a primitive (string/number) derived from calculation output.
 */
function useFlashKey(resultKey: string | number): number {
  const [key, setKey] = useState(0);
  const prev = useRef<string | number | null>(null);

  useEffect(() => {
    if (prev.current !== null && prev.current !== resultKey) {
      setKey((k) => k + 1);
    }
    prev.current = resultKey;
  }, [resultKey]);

  return key;
}

// ─── Single tab panel ─────────────────────────────────────────────────────────

function TabPanel({ tab }: { tab: CalcTab }) {
  const flashKey = useFlashKey(tab.resultKey);

  return (
    <form
      id={`calc-panel-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`calc-tab-${tab.id}`}
      className="calc-tab-body"
      onSubmit={tab.onSubmit}
    >
      {/* ── Left: input fields ─────────────────────────────── */}
      <div className="calc-tab-inputs">
        {tab.fields}

        {tab.validationError ? (
          <div className="calc-tab-validation" role="alert">
            <Alert
              variant="warning"
              title="Controleer invoer"
              description="Controleer de ingevulde maten voordat je opslaat."
            />
          </div>
        ) : null}

        <div className="calc-tab-save">
          <Button
            isLoading={tab.isSaving}
            leftIcon={<Save size={16} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Inmeetregel opslaan
          </Button>
        </div>
      </div>

      {/* ── Right: live result ─────────────────────────────── */}
      <div className="calc-tab-result" aria-live="polite" aria-atomic="true">
        <p className="calc-result-label">Live berekening</p>
        <div
          key={flashKey}
          className="calc-result-card calc-result-highlight"
          aria-label="Berekend resultaat"
        >
          {tab.result}
        </div>
        <div className="calc-result-hint">
          <Alert variant="info" description={INDICATIVE_TEXT} />
        </div>
      </div>
    </form>
  );
}

// ─── Main CalculatorTabs component ────────────────────────────────────────────

export function CalculatorTabs({ tabs, activeTab, onTabChange }: CalculatorTabsProps) {
  const activeTabData = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="calc-tabs-wrapper" role="group" aria-label="Rekenhulpen">
      {/* Tab strip */}
      <div className="calc-tab-strip" role="tablist" aria-label="Rekenhulp kiezen">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`calc-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`calc-panel-${tab.id}`}
              className={`calc-tab-btn${isActive ? " calc-tab-btn-active" : ""}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
            >
              <span className="calc-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.hasInput && !isActive ? (
                <span className="calc-tab-dot" aria-label="Heeft invoer" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {activeTabData ? <TabPanel tab={activeTabData} /> : null}
    </div>
  );
}
