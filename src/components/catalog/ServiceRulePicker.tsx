import { Check, ChevronDown, Wrench, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import type { ServiceRuleRow } from "../settings/settings/settingsTypes";
import { Alert } from "../ui/feedback/Alert";
import { Field } from "../ui/forms/Field";
import { IconButton } from "../ui/forms/IconButton";
import { SearchInput } from "../ui/forms/SearchInput";
import { BaseDialog } from "../ui/overlays/BaseDialog";
import {
  type ServiceRuleDoc,
  filterServiceRules,
  formatCalculationType,
  toActiveServiceRuleRows
} from "./serviceRuleCatalog";

type ServiceRulePickerProps = {
  session: AppSession;
  /** Uniek prefix voor DOM-ids zodat de kiezer naast de productkiezer kan staan. */
  idPrefix: string;
  selectedRuleId: string;
  /** Weergavenaam van de huidige keuze, voor als die buiten de lijst valt. */
  selectedRuleLabel?: string;
  onSelect: (rule: ServiceRuleRow | null) => void;
  label?: string;
  description?: string;
  emptyOptionLabel?: string;
  required?: boolean;
  /** Toon de prijs excl. btw in het optielabel. */
  showPriceInLabel?: boolean;
};

/**
 * Herbruikbare kiezer voor vaste werkzaamheden (serviceCostRules), zusje van
 * CatalogProductPicker. Een triggerknop opent een zoekdialoog (BaseDialog) met
 * grote, tikbare resultaatrijen. De werkzaamhedenlijst is klein, dus we laden
 * hem eenmalig (slug -> tenant-id -> regels) en filteren client-side; geen
 * serverside zoekopdracht/debounce nodig zoals bij de duizenden producten.
 */
export default function ServiceRulePicker({
  session,
  idPrefix,
  selectedRuleId,
  selectedRuleLabel,
  onSelect,
  label = "Werkzaamheid",
  description,
  emptyOptionLabel = "Geen vaste werkzaamheid",
  required = false,
  showPriceInLabel = false
}: ServiceRulePickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<ServiceRuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Eenmalig laden: slug -> tenant-id (getBySlug, rol user/editor/admin) ->
  // serviceCostRules.list. createConvexHttpClient injecteert automatisch de actor.
  useEffect(() => {
    let isActive = true;

    async function loadRules() {
      const client = createConvexHttpClient(session);

      if (!client) {
        if (isActive) {
          setError("Kan de werkzaamheden nu niet bereiken.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tenant = (await client.query(api.beheer.tenants.getBySlug, {
          slug: session.tenantId
        })) as { _id: string } | null;

        if (!tenant?._id) {
          throw new Error("Tenant niet gevonden.");
        }

        const docs = (await client.query(api.beheer.serviceCostRules.list, {
          tenantId: tenant._id
        })) as ServiceRuleDoc[];

        if (isActive) {
          setRules(toActiveServiceRuleRows(docs ?? []));
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setRules([]);
          setError("Werkzaamheden konden niet worden opgehaald.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadRules();

    return () => {
      isActive = false;
    };
    // Alleen tenantId als dep: de query hangt daar van af; het session-object
    // gaat enkel naar de client-factory (voorkomt her-fetch bij nieuwe referentie).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.tenantId]);

  const filtered = useMemo(() => filterServiceRules(rules, search), [rules, search]);
  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  // Triggertekst: eerst de regel uit de lijst, dan het door de ouder meegegeven
  // label, dan een generieke terugval.
  const triggerText = (() => {
    if (!selectedRuleId) {
      return null;
    }
    if (selectedRule) {
      return selectedRule.name;
    }
    return selectedRuleLabel ?? "Gekozen werkzaamheid";
  })();

  function choose(rule: ServiceRuleRow | null) {
    onSelect(rule);
    setOpen(false);
  }

  function openDialog() {
    setSearch("");
    setOpen(true);
  }

  return (
    <Field htmlFor={`${idPrefix}-service-rule`} label={label} description={description} required={required}>
      <button
        type="button"
        id={`${idPrefix}-service-rule`}
        className={`ui-control catalog-picker-trigger${triggerText ? "" : " is-placeholder"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={description ? `${idPrefix}-service-rule-desc` : undefined}
        onClick={openDialog}
      >
        <Wrench size={16} aria-hidden="true" className="catalog-picker-trigger-icon" />
        <span className="catalog-picker-trigger-label">{triggerText ?? "Kies een werkzaamheid…"}</span>
        <ChevronDown size={16} aria-hidden="true" className="catalog-picker-trigger-chevron" />
      </button>

      <BaseDialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabelledBy={titleId}
        className="catalog-picker-dialog"
      >
        <div className="catalog-picker-panel">
          <div className="catalog-picker-header">
            <h2 id={titleId} className="catalog-picker-title">
              {label}
            </h2>
            <IconButton aria-label="Sluiten" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X size={18} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="catalog-picker-search">
            <SearchInput
              aria-label="Werkzaamheid zoeken"
              placeholder="Zoek op naam of omschrijving"
              value={search}
              onChange={setSearch}
              data-autofocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Geen formulier submitten; Enter kiest de eerste treffer.
                  event.preventDefault();
                  if (!isLoading && filtered.length > 0) {
                    choose(filtered[0]);
                  }
                }
              }}
            />
          </div>

          <div className="catalog-picker-body">
            {error ? <Alert variant="warning" description={error} /> : null}

            {!required && selectedRuleId ? (
              <button
                type="button"
                className="catalog-picker-option catalog-picker-option-clear"
                onClick={() => choose(null)}
              >
                <span className="catalog-picker-option-main">{emptyOptionLabel}</span>
              </button>
            ) : null}

            {isLoading ? (
              <p className="catalog-picker-status">Werkzaamheden laden…</p>
            ) : filtered.length === 0 ? (
              <p className="catalog-picker-status">
                {rules.length === 0
                  ? "Nog geen werkzaamheden. Voeg ze toe bij Instellingen › Werkzaamheden."
                  : "Geen werkzaamheden gevonden — pas de zoekterm aan."}
              </p>
            ) : (
              <ul className="catalog-picker-list">
                {filtered.map((rule) => {
                  const price =
                    showPriceInLabel && rule.priceExVat > 0 ? formatEuro(rule.priceExVat) : null;
                  const isActive = rule.id === selectedRuleId;

                  return (
                    <li key={rule.id}>
                      <button
                        type="button"
                        className={`catalog-picker-option${isActive ? " is-active" : ""}`}
                        aria-current={isActive || undefined}
                        onClick={() => choose(rule)}
                      >
                        <span className="catalog-picker-option-text">
                          <span className="catalog-picker-option-main">{rule.name}</span>
                          <span className="catalog-picker-option-meta">
                            {formatCalculationType(rule.calculationType)}
                          </span>
                        </span>
                        {price ? <span className="catalog-picker-option-price">{price}</span> : null}
                        {isActive ? (
                          <Check size={16} aria-hidden="true" className="catalog-picker-option-check" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </BaseDialog>
    </Field>
  );
}
