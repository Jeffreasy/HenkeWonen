import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Optionele teller naast het label (bv. aantal regels). Verberg met undefined/0. */
  badge?: ReactNode;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Toegankelijke naam van de tabstrook. */
  ariaLabel: string;
  /** Prefix voor de tab-/panel-id's zodat meerdere Tabs op één pagina niet botsen. */
  idBase: string;
};

/**
 * Toegankelijke tabs (tablist/tab/tabpanel + pijltjesnavigatie).
 *
 * Alle panels blijven gemount; inactieve panels krijgen `hidden`. Zo behouden
 * zware kinderen (bv. het inmeetpaneel) hun state en blijven hun effecten lopen,
 * terwijl er visueel maar één tegelijk zichtbaar is.
 */
export function Tabs({ tabs, activeId, onChange, ariaLabel, idBase }: TabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
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
    if (nextTab) {
      onChange(nextTab.id);
      // Focus de nieuw geselecteerde tab zodat pijltjesnavigatie blijft werken.
      const button = stripRef.current?.querySelector<HTMLButtonElement>(
        `#${idBase}-tab-${CSS.escape(nextTab.id)}`
      );
      button?.focus();
    }
  };

  return (
    <div className="ui-tabs">
      <div className="ui-tab-strip" role="tablist" aria-label={ariaLabel} ref={stripRef}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`${idBase}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${idBase}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`ui-tab-btn${isActive ? " ui-tab-btn-active" : ""}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={handleKeyDown}
            >
              {tab.icon ? (
                <span className="ui-tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
              ) : null}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && tab.badge !== "" ? (
                <span className="ui-tab-badge">{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            id={`${idBase}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${idBase}-tab-${tab.id}`}
            className="ui-tabpanel"
            hidden={!isActive}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
