import { AlertTriangle, CalendarClock, CalendarOff, CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AFWEZIGHEID_LABEL,
  OMVANG_LABEL,
  formatMinuut,
  omvangUnits,
  type InmeetBeschikbaarheid,
  type Omvang
} from "../../lib/agenda";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { FormModal } from "../ui/overlays/FormModal";
import { fromDateInputValue } from "./measurement/measurementUtils";

export type TeamMember = {
  id: string;
  naam: string;
  email: string;
  role: string;
};

type PlanMeasurementModalProps = {
  open: boolean;
  session: AppSession;
  teamMembers: TeamMember[];
  defaultDate: string;
  defaultMeasuredBy: string;
  /** Bestaande klusgrootte van het dossier — zodat herplannen niet terugvalt naar "klein". */
  defaultOmvang?: Omvang;
  /** Het dossier dat nu gepland wordt — z'n eigen bezoek telt niet mee in de capaciteit. */
  excludeProjectId?: string;
  isSaving: boolean;
  onSubmit: (data: { date: string; measuredBy: string; omvang: Omvang }) => void;
  onClose: () => void;
};

export function PlanMeasurementModal({
  open,
  session,
  teamMembers,
  defaultDate,
  defaultMeasuredBy,
  defaultOmvang = "klein",
  excludeProjectId,
  isSaving,
  onSubmit,
  onClose
}: PlanMeasurementModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [measuredBy, setMeasuredBy] = useState(defaultMeasuredBy);
  const [omvang, setOmvang] = useState<Omvang>(defaultOmvang);
  const [hint, setHint] = useState<InmeetBeschikbaarheid | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const wasOpenRef = useRef(false);

  // Seed de defaults alléén op de open-transitie (false→true). Niet bij elke
  // wijziging van defaultDate/defaultMeasuredBy/defaultOmvang — die kunnen async
  // binnenkomen (teamleden/dossier laden ná het openen) en zouden anders de door
  // de gebruiker gekozen datum/monteur/omvang overschrijven.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDate(defaultDate);
      setMeasuredBy(defaultMeasuredBy);
      setOmvang(defaultOmvang);
    }
    wasOpenRef.current = open;
  }, [open, defaultDate, defaultMeasuredBy, defaultOmvang]);

  // Behoud een bestaande (vrije-tekst) monteurnaam die niet in de teamlijst
  // staat, zodat we 'm niet stilletjes wegvagen.
  const knownNames = new Set(teamMembers.map((member) => member.naam));
  const monteurId = teamMembers.find((member) => member.naam === measuredBy)?.id ?? null;

  // Live beschikbaarheid: is het een inmeetdag, is de monteur vrij en past de klus?
  useEffect(() => {
    if (!open || !date || !monteurId) {
      setHint(null);
      return;
    }
    const datumMs = fromDateInputValue(date);
    if (!datumMs) {
      setHint(null);
      return;
    }
    const client = createConvexHttpClient(session);
    if (!client) {
      setHint(null);
      return;
    }
    let cancelled = false;
    setHintLoading(true);
    client
      .query(api.portal.inmeetBeschikbaarheid, {
        tenantSlug: session.tenantId,
        userId: monteurId as Id<"users">,
        datum: datumMs,
        excludeProjectId: excludeProjectId ? (excludeProjectId as Id<"projects">) : undefined
      })
      .then((res) => {
        if (!cancelled) {
          setHint(res as InmeetBeschikbaarheid);
        }
      })
      .catch((hintError) => {
        console.error(hintError);
        if (!cancelled) {
          setHint(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHintLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, monteurId, session, excludeProjectId]);

  function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!date) {
      return;
    }
    onSubmit({ date, measuredBy, omvang });
  }

  function renderHint() {
    if (!measuredBy || !date) {
      return null;
    }
    if (hintLoading) {
      return <p className="inmeet-hint laden">Beschikbaarheid laden…</p>;
    }
    if (!hint) {
      return null;
    }
    const venster = `${formatMinuut(hint.venster.startMinuut)}–${formatMinuut(hint.venster.eindMinuut)}`;

    if (!hint.isInmeetdag) {
      return (
        <p className="inmeet-hint waarschuwing">
          <AlertTriangle size={15} aria-hidden="true" />
          Geen inmeetdag. Inmeten kan op di/wo/do tussen {venster}.
        </p>
      );
    }
    if (hint.afwezig) {
      const label = AFWEZIGHEID_LABEL[hint.afwezig.type] ?? hint.afwezig.type;
      return (
        <p className="inmeet-hint waarschuwing">
          <CalendarOff size={15} aria-hidden="true" />
          {hint.monteur.naam} is die dag afwezig ({label}
          {hint.afwezig.reden ? `: ${hint.afwezig.reden}` : ""}).
        </p>
      );
    }
    const past = omvangUnits(omvang) <= hint.vrijeCapaciteit;
    const ruimte =
      hint.vrijeCapaciteit >= 2
        ? "de dag is nog helemaal vrij"
        : hint.vrijeCapaciteit === 1
          ? "nog 1 plek vrij die dag"
          : "de dag is vol";
    return (
      <p className={`inmeet-hint ${past ? "ok" : "waarschuwing"}`}>
        {past ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <AlertTriangle size={15} aria-hidden="true" />
        )}
        Inmeten {venster} · {ruimte}
        {past ? "" : omvang === "volledig" ? " — een volledige woning past hier niet meer." : " — geen plek meer."}
      </p>
    );
  }

  return (
    <FormModal
      open={open}
      title="Inmeetbezoek inplannen"
      description="Kies een datum en wijs een monteur toe. Het bezoek verschijnt in de buitendienst-planning (Inmeten, en op de dag zelf onder Vandaag)."
      size="sm"
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <Field htmlFor="plan-measurement-date" label="Inmeetdatum" required>
          <Input
            id="plan-measurement-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
        <Field
          htmlFor="plan-measurement-monteur"
          label="Monteur"
          description="Wie voert de inmeting uit? Verschijnt op de buitendienst-kaart."
        >
          <Select
            id="plan-measurement-monteur"
            value={measuredBy}
            onChange={(event) => setMeasuredBy(event.target.value)}
          >
            <option value="">Nog niet toegewezen</option>
            {measuredBy && !knownNames.has(measuredBy) ? (
              <option value={measuredBy}>{measuredBy}</option>
            ) : null}
            {teamMembers.map((member) => (
              <option key={member.id} value={member.naam}>
                {member.naam}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          htmlFor="plan-measurement-omvang"
          label="Omvang van de klus"
          description="Klein klusje? Dan passen er twee op een dag. Een volledige woning vult de hele inmeetdag."
        >
          <Select
            id="plan-measurement-omvang"
            value={omvang}
            onChange={(event) => setOmvang(event.target.value as Omvang)}
          >
            <option value="klein">{OMVANG_LABEL.klein}</option>
            <option value="volledig">{OMVANG_LABEL.volledig}</option>
          </Select>
        </Field>
        {renderHint()}
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<CalendarClock size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Inplannen
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
      </form>
    </FormModal>
  );
}
