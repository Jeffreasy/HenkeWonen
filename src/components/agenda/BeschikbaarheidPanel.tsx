import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  AFWEZIGHEID_LABEL,
  WEEKDAG_LANG,
  formatMinuut,
  type Afwezigheid,
  type Werktijd
} from "../../lib/agenda";
import { showErrorToast, showToast } from "../../lib/toast";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { FormModal } from "../ui/overlays/FormModal";

type RoosterRij = { weekdag: number; actief: boolean; start: string; eind: string };
type AfwezigheidType = "verlof" | "ziek" | "blokkade" | "overig";

type Props = {
  session: AppSession;
  monteur: { id: string; naam: string };
  werktijden: Werktijd[];
  afwezigheden: Afwezigheid[];
  onClose: () => void;
  onSaved: () => void;
  /** Lichte refresh van de hoofd-agenda zónder het paneel te sluiten. */
  onChanged?: () => void;
};

function timeNaarMinuut(value: string): number {
  const [u, m] = value.split(":").map((p) => Number(p));
  return (u || 0) * 60 + (m || 0);
}
function msNaarDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateInputNaarMs(value: string): number {
  const [j, m, d] = value.split("-").map((p) => Number(p));
  return new Date(j, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
}

export default function BeschikbaarheidPanel({
  session,
  monteur,
  werktijden,
  afwezigheden,
  onClose,
  onSaved,
  onChanged
}: Props) {
  const [rooster, setRooster] = useState<RoosterRij[]>(() =>
    WEEKDAG_LANG.map((_, weekdag) => {
      const bestaand = werktijden.find((w) => w.weekdag === weekdag);
      return {
        weekdag,
        actief: Boolean(bestaand),
        start: bestaand ? formatMinuut(bestaand.startMinuut) : "08:00",
        eind: bestaand ? formatMinuut(bestaand.eindMinuut) : "17:00"
      };
    })
  );
  const [lijst, setLijst] = useState<Afwezigheid[]>(afwezigheden);
  const [bezig, setBezig] = useState(false);

  const vandaag = msNaarDateInput(Date.now());
  const [afType, setAfType] = useState<AfwezigheidType>("verlof");
  const [afVanaf, setAfVanaf] = useState(vandaag);
  const [afTot, setAfTot] = useState(vandaag);
  const [afReden, setAfReden] = useState("");

  const periodeOngeldig = dateInputNaarMs(afTot) < dateInputNaarMs(afVanaf);

  // Een actieve roosterdag moet een eindtijd ná de starttijd hebben.
  const rijOngeldig = (r: RoosterRij) =>
    r.actief && timeNaarMinuut(r.start) >= timeNaarMinuut(r.eind);
  const roosterOngeldig = rooster.some(rijOngeldig);

  function client() {
    const c = createConvexHttpClient(session);
    if (!c) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
    }
    return c;
  }

  function setRij(weekdag: number, patch: Partial<RoosterRij>) {
    setRooster((r) => r.map((rij) => (rij.weekdag === weekdag ? { ...rij, ...patch } : rij)));
  }

  async function roosterOpslaan() {
    const c = client();
    if (!c) return;
    if (roosterOngeldig) return;
    const werktijdenInput = rooster
      .filter((r) => r.actief)
      .map((r) => ({
        weekdag: r.weekdag,
        startMinuut: timeNaarMinuut(r.start),
        eindMinuut: timeNaarMinuut(r.eind)
      }));
    setBezig(true);
    try {
      await c.mutation(api.portal.setMonteurWerktijden, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        userId: monteur.id as Id<"users">,
        werktijden: werktijdenInput
      });
      showToast({ title: "Rooster opgeslagen", description: monteur.naam, tone: "success" });
      onSaved();
    } catch (e) {
      showErrorToast(e, "Rooster opslaan mislukt", "Controleer de tijden.");
    } finally {
      setBezig(false);
    }
  }

  async function afwezigheidToevoegen() {
    const c = client();
    if (!c) return;
    if (periodeOngeldig) return;
    setBezig(true);
    try {
      const resultaat = await c.mutation(api.portal.addAfwezigheid, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        userId: monteur.id as Id<"users">,
        type: afType,
        vanafDatum: dateInputNaarMs(afVanaf),
        totDatum: dateInputNaarMs(afTot),
        heleDag: true,
        reden: afReden.trim() || undefined
      });
      setLijst((l) => [
        ...l,
        {
          id: resultaat.id,
          type: afType,
          vanafDatum: dateInputNaarMs(afVanaf),
          totDatum: dateInputNaarMs(afTot),
          heleDag: true,
          reden: afReden.trim() || undefined
        }
      ]);
      setAfReden("");
      // Botst de afwezigheid met al geboekte inmeetbezoeken, dan moet dat direct
      // opvallen: die klanten staan anders ingepland bij een monteur die er niet is.
      if (resultaat.conflicten.length > 0) {
        const eerste = resultaat.conflicten[0];
        const datumTekst = new Intl.DateTimeFormat("nl-NL", {
          day: "2-digit",
          month: "2-digit"
        }).format(new Date(eerste.inmeetdatum));
        showToast({
          title: `Let op: ${resultaat.conflicten.length} gepland(e) inmeetbezoek(en) in deze periode`,
          description: `O.a. ${eerste.klantNaam} op ${datumTekst}. Herplan deze bezoeken naar een andere monteur of datum.`,
          tone: "warning"
        });
      } else {
        showToast({ title: "Afwezigheid toegevoegd", tone: "success" });
      }
      onChanged?.();
    } catch (e) {
      showErrorToast(e, "Toevoegen mislukt", "Controleer de datums.");
    } finally {
      setBezig(false);
    }
  }

  async function afwezigheidVerwijderen(id: string) {
    const c = client();
    if (!c) return;
    try {
      await c.mutation(api.portal.removeAfwezigheid, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        afwezigheidId: id as Id<"monteurAfwezigheid">
      });
      setLijst((l) => l.filter((a) => a.id !== id));
      onChanged?.();
    } catch (e) {
      showErrorToast(e, "Verwijderen mislukt");
    }
  }

  return (
    <FormModal
      open
      title={`Beschikbaarheid — ${monteur.naam}`}
      description="Stel het weekrooster in en beheer afwezigheid (verlof, ziek, blokkades)."
      size="lg"
      onClose={onClose}
    >
      <h4 className="beschikbaarheid-kop">Weekrooster</h4>
      <div className="beschikbaarheid-rooster">
        <span className="kop">Dag</span>
        <span className="kop">Van</span>
        <span className="kop">Tot</span>
        {rooster.map((r) => (
          <FragmentRow
            key={r.weekdag}
            rij={r}
            ongeldig={rijOngeldig(r)}
            onToggle={(actief) => setRij(r.weekdag, { actief })}
            onStart={(start) => setRij(r.weekdag, { start })}
            onEind={(eind) => setRij(r.weekdag, { eind })}
          />
        ))}
      </div>
      <div className="beschikbaarheid-actie">
        <Button
          variant="primary"
          size="sm"
          isLoading={bezig}
          disabled={roosterOngeldig}
          leftIcon={<Save size={15} aria-hidden="true" />}
          onClick={roosterOpslaan}
        >
          Rooster opslaan
        </Button>
      </div>

      <h4 className="beschikbaarheid-kop beschikbaarheid-kop-ruim">Afwezigheid</h4>
      <div className="afwezigheid-lijst">
        {lijst.length === 0 ? <span className="agenda-leeg">Geen afwezigheid ingepland.</span> : null}
        {lijst.map((a) => (
          <div className="afwezigheid-rij" key={a.id}>
            <span>
              <Badge variant="warning">{AFWEZIGHEID_LABEL[a.type] ?? a.type}</Badge>{" "}
              {msNaarDateInput(a.vanafDatum)} – {msNaarDateInput(a.totDatum)}
              {a.reden ? ` · ${a.reden}` : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={15} aria-hidden="true" />}
              onClick={() => void afwezigheidVerwijderen(a.id)}
            >
              Verwijder
            </Button>
          </div>
        ))}
      </div>

      <div className="grid two-column beschikbaarheid-actie">
        <Field label="Type" htmlFor="af-type">
          <Select id="af-type" value={afType} onChange={(e) => setAfType(e.target.value as AfwezigheidType)}>
            <option value="verlof">Verlof</option>
            <option value="ziek">Ziek</option>
            <option value="blokkade">Blokkade</option>
            <option value="overig">Overig</option>
          </Select>
        </Field>
        <Field label="Reden (optioneel)" htmlFor="af-reden">
          <Input id="af-reden" value={afReden} onChange={(e) => setAfReden(e.target.value)} />
        </Field>
        <Field label="Van" htmlFor="af-vanaf">
          <Input id="af-vanaf" type="date" value={afVanaf} onChange={(e) => setAfVanaf(e.target.value)} />
        </Field>
        <Field
          label="Tot en met"
          htmlFor="af-tot"
          error={periodeOngeldig ? "Einddatum ligt vóór de startdatum." : undefined}
        >
          <Input
            id="af-tot"
            type="date"
            min={afVanaf}
            value={afTot}
            onChange={(e) => setAfTot(e.target.value)}
          />
        </Field>
      </div>
      <div className="beschikbaarheid-actie">
        <Button
          variant="secondary"
          size="sm"
          isLoading={bezig}
          disabled={periodeOngeldig}
          leftIcon={<Plus size={15} aria-hidden="true" />}
          onClick={afwezigheidToevoegen}
        >
          Afwezigheid toevoegen
        </Button>
      </div>
    </FormModal>
  );
}

function FragmentRow({
  rij,
  ongeldig,
  onToggle,
  onStart,
  onEind
}: {
  rij: RoosterRij;
  ongeldig: boolean;
  onToggle: (actief: boolean) => void;
  onStart: (v: string) => void;
  onEind: (v: string) => void;
}) {
  return (
    <>
      <label className="rooster-dag-label">
        <input
          type="checkbox"
          checked={rij.actief}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`${WEEKDAG_LANG[rij.weekdag]} ingeroosterd`}
        />
        {WEEKDAG_LANG[rij.weekdag]}
      </label>
      <Input
        type="time"
        value={rij.start}
        disabled={!rij.actief}
        aria-invalid={ongeldig || undefined}
        onChange={(e) => onStart(e.target.value)}
        aria-label={`${WEEKDAG_LANG[rij.weekdag]} starttijd`}
      />
      <Input
        type="time"
        value={rij.eind}
        disabled={!rij.actief}
        aria-invalid={ongeldig || undefined}
        onChange={(e) => onEind(e.target.value)}
        aria-label={`${WEEKDAG_LANG[rij.weekdag]} eindtijd`}
      />
      {ongeldig ? (
        <span className="rooster-rij-fout" role="alert">
          Eindtijd moet ná de starttijd liggen.
        </span>
      ) : null}
    </>
  );
}
