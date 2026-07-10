import { MessageSquareText, Ruler, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { MeasurementWorktype } from "../../lib/measurementIntent";
import { Button } from "../ui/forms/Button";
import { SectionHeader } from "../ui/layout/SectionHeader";

export type CustomerScopeOption = {
  id: string;
  label: string;
  description: string;
  projectTitle: string;
  projectDescription: string;
  /** Bestemming na het starten. "measurement" = naar de inmeting (standaard),
   *  "quote" = direct naar een nieuwe offerte met catalogus (directe verkoop). */
  target?: "measurement" | "quote";
  /** Werksoort-hint voor het inmeet-paneel: opent de juiste product-tab
   *  (Vloer/Plint/Behang/...) i.p.v. altijd de eerste. */
  werksoort?: MeasurementWorktype;
};

type CustomerIntakePanelProps = {
  onStartProject: (scope: CustomerScopeOption) => Promise<void> | void;
  /** Opent het contactmoment-formulier (route "gesprek / oriëntatie"). */
  onLogVisit: () => void;
};

/**
 * Werksoorten voor een inmeettraject. Deze lijst voedt óók de
 * buitendienst-intake (FieldIntakeForm) — daar kiest de monteur één scope.
 */
export const customerScopeOptions: CustomerScopeOption[] = [
  {
    id: "verkoop",
    label: "Directe verkoop / product",
    description: "Klant koopt een product zonder inmeten — meteen door naar de offerte.",
    projectTitle: "Directe verkoop",
    projectDescription: "Aanvraag gestart vanuit klantdossier: directe verkoop.",
    target: "quote"
  },
  {
    id: "pvc",
    label: "PVC vloer",
    description: "Vloeroppervlak, legwijze en snijverlies.",
    projectTitle: "PVC vloer",
    projectDescription: "Aanvraag gestart vanuit klantdossier: PVC vloer.",
    werksoort: "vloer"
  },
  {
    id: "tapijt",
    label: "Tapijt",
    description: "Vloeroppervlak en plaatsingsnotities.",
    projectTitle: "Tapijt",
    projectDescription: "Aanvraag gestart vanuit klantdossier: tapijt.",
    werksoort: "vloer"
  },
  {
    id: "vinyl",
    label: "Vinyl",
    description: "Vloeroppervlak en snijverlies.",
    projectTitle: "Vinyl",
    projectDescription: "Aanvraag gestart vanuit klantdossier: vinyl.",
    werksoort: "vloer"
  },
  {
    id: "plinten",
    label: "Plinten",
    description: "Omtrek, deuropeningen en meters plint.",
    projectTitle: "Plinten",
    projectDescription: "Aanvraag gestart vanuit klantdossier: plinten.",
    werksoort: "plint"
  },
  {
    id: "trap",
    label: "Traprenovatie",
    description: "Treden, stootborden en trapvorm (recht, kwart- of halve draai).",
    projectTitle: "Traprenovatie",
    projectDescription: "Aanvraag gestart vanuit klantdossier: traprenovatie.",
    werksoort: "trap"
  },
  {
    id: "behang",
    label: "Behang",
    description: "Wandmaat, rolbreedte, rollengte en patroonrapport.",
    projectTitle: "Behang",
    projectDescription: "Aanvraag gestart vanuit klantdossier: behang.",
    werksoort: "behang"
  },
  {
    id: "wandpanelen",
    label: "Wandpanelen",
    description: "Wandmaat en aantal panelen (akoestisch of badkamer).",
    projectTitle: "Wandpanelen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: wandpanelen.",
    werksoort: "wandpaneel"
  },
  {
    id: "raambekleding",
    label: "Raambekleding",
    description: "Jaloezieën en rolgordijnen op maat (breedte × hoogte).",
    projectTitle: "Raambekleding",
    projectDescription: "Aanvraag gestart vanuit klantdossier: raambekleding.",
    werksoort: "raambekleding"
  },
  {
    id: "gordijnen",
    label: "Gordijnen",
    description: "Vrije maatregel voor gordijnen en rails.",
    projectTitle: "Gordijnen",
    projectDescription: "Aanvraag gestart vanuit klantdossier: gordijnen.",
    werksoort: "gordijn"
  },
  {
    id: "overig",
    label: "Overig",
    description: "Vrije aanvraag die niet in de andere werksoorten past.",
    projectTitle: "Nieuwe aanvraag",
    projectDescription: "Aanvraag gestart vanuit klantdossier."
  }
];

const verkoopScope = customerScopeOptions.find((scope) => scope.id === "verkoop")!;
const inmeetScopes = customerScopeOptions.filter((scope) => scope.id !== "verkoop");

/**
 * Combineert meerdere gekozen werksoorten tot één dossier: de klant die de
 * woonkamer laat inrichten (vloer + gordijnen + behang) krijgt één traject,
 * geen drie losse projecten. De eerste keuze bepaalt de inmeet-tab-hint.
 */
function combinedScope(selected: CustomerScopeOption[]): CustomerScopeOption {
  if (selected.length === 1) {
    return selected[0];
  }
  const labels = selected.map((scope) => scope.label);
  return {
    id: selected.map((scope) => scope.id).join("+"),
    label: labels.join(" + "),
    description: "",
    projectTitle: labels.join(" + "),
    projectDescription: `Aanvraag gestart vanuit klantdossier: ${labels.join(", ").toLowerCase()}.`,
    werksoort: selected[0].werksoort
  };
}

/**
 * Winkel-intake in drie routes, in de volgorde van een echt winkelgesprek:
 * de meeste klanten komen práten over hun inrichting (gesprek vastleggen,
 * staalboek mee, opvolgen), een deel plant een inmeettraject (vaak meerdere
 * werksoorten tegelijk), en soms rekent iemand direct iets af.
 */
export function CustomerIntakePanel({ onStartProject, onLogVisit }: CustomerIntakePanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  // Hint als er op "starten" wordt geklikt zonder werksoortkeuze. Bewust géén
  // uitgeschakelde (grijze) knop: die oogt als kapot naast de twee actieve
  // kaarten en legt niet uit wat er moet gebeuren.
  const [needsChoice, setNeedsChoice] = useState(false);

  function toggleWorktype(id: string) {
    setNeedsChoice(false);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function startSelected() {
    // Volgorde van aanklikken bewaren: de eerste keuze bepaalt de inmeet-tab.
    const selected = selectedIds
      .map((id) => inmeetScopes.find((scope) => scope.id === id))
      .filter((scope): scope is CustomerScopeOption => Boolean(scope));
    if (isStarting) {
      return;
    }
    if (selected.length === 0) {
      setNeedsChoice(true);
      return;
    }

    setIsStarting(true);
    try {
      // Bij succes navigeert de aanroeper weg (component unmount); bij een fout
      // wordt de knop in finally weer vrijgegeven zodat de gebruiker opnieuw kan.
      await onStartProject(combinedScope(selected));
    } finally {
      setIsStarting(false);
    }
  }

  async function startDirectSale() {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await onStartProject(verkoopScope);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <section className="panel customer-detail-panel">
      <SectionHeader
        compact
        title="Wat komt de klant doen?"
        description="Leg een gesprek vast, start een inmeettraject of verkoop direct een product."
      />
      <div className="customer-route-grid">
        <div className="customer-route-card">
          <div className="customer-route-heading">
            <MessageSquareText size={18} aria-hidden="true" />
            <strong>Gesprek of oriëntatie</strong>
          </div>
          <p className="muted">
            Klant kijkt rond of praat over de inrichting. Leg het gesprek vast, geef eventueel een
            staalboek mee en zet een opvolgdatum.
          </p>
          <div className="customer-route-action">
            <Button variant="primary" size="sm" onClick={onLogVisit} disabled={isStarting}>
              Gesprek vastleggen
            </Button>
          </div>
        </div>

        <div className="customer-route-card">
          <div className="customer-route-heading">
            <Ruler size={18} aria-hidden="true" />
            <strong>Inmeettraject starten</strong>
          </div>
          <p className="muted">
            Klant wil een offerte met inmeten. Kies wat er speelt — meerdere werksoorten mag, dat
            wordt één dossier. De maten vul je pas in bij de inmeting.
          </p>
          <div className="customer-route-chips" role="group" aria-label="Werksoorten voor het inmeettraject">
            {inmeetScopes.map((scope) => {
              const isSelected = selectedIds.includes(scope.id);
              return (
                <button
                  className={isSelected ? "customer-route-chip selected" : "customer-route-chip"}
                  key={scope.id}
                  type="button"
                  aria-pressed={isSelected}
                  title={scope.description}
                  onClick={() => toggleWorktype(scope.id)}
                >
                  {scope.label}
                </button>
              );
            })}
          </div>
          <div className="customer-route-action">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void startSelected()}
              disabled={isStarting}
              isLoading={isStarting && selectedIds.length > 0}
            >
              {selectedIds.length > 1
                ? `Inmeettraject starten (${selectedIds.length} werksoorten)`
                : "Inmeettraject starten"}
            </Button>
            {needsChoice ? (
              <p className="customer-route-hint" role="alert">
                Kies eerst hierboven wat er speelt — één of meer werksoorten.
              </p>
            ) : null}
          </div>
        </div>

        <div className="customer-route-card">
          <div className="customer-route-heading">
            <ShoppingBag size={18} aria-hidden="true" />
            <strong>Directe verkoop</strong>
          </div>
          <p className="muted">
            Klant koopt nu een product — bijvoorbeeld een lamp of karpet. Meteen door naar de
            offerte met de catalogus.
          </p>
          <div className="customer-route-action">
            <Button variant="secondary" size="sm" onClick={() => void startDirectSale()} disabled={isStarting}>
              Verkoop starten
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
