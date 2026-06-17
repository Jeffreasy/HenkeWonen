// Pure helpers voor de monteur-agenda. weekdag: 0 = maandag … 6 = zondag.
// Geen Convex-/React-afhankelijkheden zodat dit los testbaar blijft.

export const DAG_MS = 24 * 60 * 60 * 1000;

export const WEEKDAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;
export const WEEKDAG_LANG = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag"
] as const;

export const AFWEZIGHEID_LABEL: Record<string, string> = {
  verlof: "Verlof",
  ziek: "Ziek",
  blokkade: "Blokkade",
  overig: "Overig"
};

// ── Inmeet-regels (Henke Wonen) ───────────────────────────────────────────────
// De autoriteit voor de regels (inmeetdagen di/wo/do, venster 16:30–17:30,
// capaciteit 2 met klein=1/volledig=2) ligt server-side in convex/beheer/agenda.ts;
// de frontend leest die waarden uit het antwoord van `inmeetBeschikbaarheid`.
export type Omvang = "klein" | "volledig";
export const OMVANG_LABEL: Record<Omvang, string> = {
  klein: "Klein klusje (1-2 ramen / 1 ruimte)",
  volledig: "Volledige woning (ramen, vloeren, …)"
};

/** Capaciteit die een klusgrootte inneemt: volledige woning = 2, klein = 1. */
export function omvangUnits(omvang: Omvang): number {
  return omvang === "volledig" ? 2 : 1;
}

/** Spiegelt het resultaat van de Convex-query `inmeetBeschikbaarheid`. */
export type InmeetBeschikbaarheid = {
  monteur: { id: string; naam: string };
  weekdag: number;
  isInmeetdag: boolean;
  venster: { startMinuut: number; eindMinuut: number };
  maxCapaciteit: number;
  gebruikteCapaciteit: number;
  vrijeCapaciteit: number;
  afwezig: { type: string; reden: string | null } | null;
  bezoeken: {
    inmetingId: string;
    projectId: string;
    projectTitel: string;
    klantNaam: string;
    omvang: string | null;
  }[];
};

/** Minuten sinds middernacht → "HH:MM". */
export function formatMinuut(minuut: number): string {
  const u = Math.floor(minuut / 60);
  const m = minuut % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** weekdag-index (0 = maandag … 6 = zondag) van een tijdstip. */
export function weekdagVan(ms: number): number {
  const js = new Date(ms).getDay(); // 0 = zondag … 6 = zaterdag
  return (js + 6) % 7;
}

/** Maandag 00:00 (lokaal) van de week waarin `ms` valt. */
export function startVanWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekdagVan(d.getTime()));
  return d.getTime();
}

/** De 7 dag-starttijdstippen (ma..zo) vanaf een weekstart. */
export function weekDagen(weekStart: number): number[] {
  const dagen: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    dagen.push(d.getTime());
  }
  return dagen;
}

export type Werktijd = { weekdag: number; startMinuut: number; eindMinuut: number };
export type Afwezigheid = {
  id: string;
  type: string;
  vanafDatum: number;
  totDatum: number;
  heleDag: boolean;
  startMinuut?: number;
  eindMinuut?: number;
  reden?: string;
};
export type Bezoek = {
  inmetingId: string;
  projectId: string;
  projectTitel: string;
  klantNaam: string;
  inmeetdatum: number | null;
  gemetenDoor: string | null;
  status: string;
};

export type DagStatus = {
  dagMs: number;
  weekdag: number;
  werktijd?: Werktijd;
  afwezig: Afwezigheid[];
  bezoeken: Bezoek[];
  /** true als de monteur die dag is ingeroosterd, niet (hele dag) afwezig en geen bezoek heeft. */
  bereikbaar: boolean;
};

function valtOpDag(dagMs: number, vanaf: number, tot: number): boolean {
  // Overlap van [vanaf, tot] (afwezigheid, inclusief totDatum) met de dag [dagMs, dagMs+DAG_MS).
  return vanaf < dagMs + DAG_MS && tot >= dagMs;
}

/** Bepaalt per dag de status van één monteur uit werktijden, afwezigheid en bezoeken. */
export function dagStatusVoorMonteur(
  dagMs: number,
  werktijden: Werktijd[],
  afwezigheden: Afwezigheid[],
  bezoeken: Bezoek[]
): DagStatus {
  const weekdag = weekdagVan(dagMs);
  const werktijd = werktijden.find((w) => w.weekdag === weekdag);
  const afwezig = afwezigheden.filter((a) => valtOpDag(dagMs, a.vanafDatum, a.totDatum));
  const dagBezoeken = bezoeken.filter(
    (b) => b.inmeetdatum != null && valtOpDag(dagMs, b.inmeetdatum, b.inmeetdatum)
  );
  const heleDagAfwezig = afwezig.some((a) => a.heleDag);
  const bereikbaar = Boolean(werktijd) && !heleDagAfwezig && dagBezoeken.length === 0;

  return { dagMs, weekdag, werktijd, afwezig, bezoeken: dagBezoeken, bereikbaar };
}
