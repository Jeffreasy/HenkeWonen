import {
  ArrowUpDown,
  Info,
  Layers,
  LayoutGrid,
  Minus,
  PanelRight,
  Pencil,
  Save,
  SquareStack
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type { SubmitEventLike } from "../../lib/events";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";

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
  "Richtprijs is indicatief — de definitieve prijs bepaal je in de offerte.";

const INDICATIVE_DETAIL =
  "Indicatief — controleer altijd productafmetingen en snijverlies (en waar van toepassing legrichting en patroon) vóór je de inmeetregel opslaat. Een richtprijs is een indicatie; de definitieve prijs bepaal je in de offerte.";

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
              description={
                tab.validationError ??
                "Controleer de ingevulde maten voordat je opslaat."
              }
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
          <Alert variant="info">
            <p className="ui-alert-description calc-result-hint-text">
              {INDICATIVE_TEXT}
              <span
                className="calc-result-hint-info"
                tabIndex={0}
                role="img"
                title={INDICATIVE_DETAIL}
                aria-label={INDICATIVE_DETAIL}
              >
                <Info size={14} aria-hidden="true" />
              </span>
            </p>
          </Alert>
        </div>
      </div>
    </form>
  );
}

// ─── Main CalculatorTabs component ────────────────────────────────────────────

export function CalculatorTabs({ tabs, activeTab, onTabChange }: CalculatorTabsProps) {
  const activeTabData = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (safeIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (safeIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab && nextTab.id !== activeTab) {
      onTabChange(nextTab.id);
    }
  };

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
              tabIndex={isActive ? 0 : -1}
              className={`calc-tab-btn${isActive ? " calc-tab-btn-active" : ""}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
              onKeyDown={handleTabKeyDown}
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
