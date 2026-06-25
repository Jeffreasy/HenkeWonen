import { ArrowRight, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CustomerType, PortalCustomer } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { FormModal } from "../ui/overlays/FormModal";

export type KlantKeuze =
  | { soort: "bestaand"; customerId: string; naam: string }
  | { soort: "nieuw"; type: CustomerType; naam: string; email?: string; telefoon?: string };

type KlantStapModalProps = {
  open: boolean;
  customers: PortalCustomer[];
  onNext: (keuze: KlantKeuze) => void;
  onClose: () => void;
};

export function KlantStapModal({ open, customers, onNext, onClose }: KlantStapModalProps) {
  const [tab, setTab] = useState<"bestaand" | "nieuw">("bestaand");
  const [search, setSearch] = useState("");
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [type, setType] = useState<CustomerType>("private");
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");

  const gefilterd = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lijst = q
      ? customers.filter((c) =>
          [c.weergaveNaam, c.email, c.telefoon, c.plaats]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : customers;
    return lijst.slice(0, 12);
  }, [customers, search]);

  const kanVolgende = tab === "bestaand" ? Boolean(gekozenId) : naam.trim().length > 0;

  function volgende() {
    if (tab === "bestaand") {
      const c = customers.find((x) => x.id === gekozenId);
      if (!c) return;
      onNext({ soort: "bestaand", customerId: c.id, naam: c.weergaveNaam });
    } else {
      if (!naam.trim()) return;
      onNext({
        soort: "nieuw",
        type,
        naam: naam.trim(),
        email: email.trim() || undefined,
        telefoon: telefoon.trim() || undefined
      });
    }
  }

  return (
    <FormModal
      open={open}
      title="Inmeting inplannen — klant"
      description="Kies een bestaande klant of leg snel een nieuwe vast."
      size="sm"
      onClose={onClose}
    >
      <div className="plan-klant-tabs" role="tablist" aria-label="Klantkeuze">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bestaand"}
          className={tab === "bestaand" ? "active" : ""}
          onClick={() => setTab("bestaand")}
        >
          <Users size={15} aria-hidden="true" /> Bestaande klant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "nieuw"}
          className={tab === "nieuw" ? "active" : ""}
          onClick={() => setTab("nieuw")}
        >
          <UserPlus size={15} aria-hidden="true" /> Nieuwe klant
        </button>
      </div>

      {tab === "bestaand" ? (
        <div className="form-grid">
          <Field htmlFor="plan-klant-zoek" label="Zoek klant">
            <Input
              id="plan-klant-zoek"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op naam, plaats of telefoon"
            />
          </Field>
          <ul className="plan-klant-lijst">
            {gefilterd.length === 0 ? (
              <li className="plan-klant-leeg">Geen klant gevonden.</li>
            ) : (
              gefilterd.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={gekozenId === c.id ? "plan-klant-optie active" : "plan-klant-optie"}
                    aria-pressed={gekozenId === c.id}
                    onClick={() => setGekozenId(c.id)}
                  >
                    <span className="plan-klant-naam">{c.weergaveNaam}</span>
                    {c.plaats ? <span className="plan-klant-meta">{c.plaats}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="form-grid">
          <Field htmlFor="plan-klant-type" label="Type">
            <Select
              id="plan-klant-type"
              value={type}
              onChange={(event) => setType(event.target.value as CustomerType)}
            >
              <option value="private">Particulier</option>
              <option value="business">Zakelijk</option>
            </Select>
          </Field>
          <Field htmlFor="plan-klant-naam" label="Naam" required>
            <Input
              id="plan-klant-naam"
              value={naam}
              onChange={(event) => setNaam(event.target.value)}
              placeholder="Bijv. Familie Jansen"
              required
            />
          </Field>
          <Field htmlFor="plan-klant-tel" label="Telefoon">
            <Input
              id="plan-klant-tel"
              value={telefoon}
              onChange={(event) => setTelefoon(event.target.value)}
              placeholder="06…"
            />
          </Field>
          <Field htmlFor="plan-klant-email" label="E-mail">
            <Input
              id="plan-klant-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="naam@example.nl"
            />
          </Field>
        </div>
      )}

      <div className="toolbar">
        <Button
          variant="primary"
          rightIcon={<ArrowRight size={16} aria-hidden="true" />}
          disabled={!kanVolgende}
          onClick={volgende}
          type="button"
        >
          Volgende
        </Button>
        <Button
          variant="secondary"
          leftIcon={<X size={15} aria-hidden="true" />}
          onClick={onClose}
          type="button"
        >
          Annuleren
        </Button>
      </div>
    </FormModal>
  );
}
