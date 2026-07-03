/**
 * Canonieke "volgende stap"-bepaling voor een dossier.
 *
 * Eén bron-van-waarheid voor "wat is nu de logische vervolgactie" op een project,
 * zodat het kantoor-dossier, het dashboard en de buitendienst dezelfde stap tonen
 * i.p.v. ieder een eigen variant (de oorzaak van het "losse eilanden"-gevoel).
 *
 * Pure functie zonder Convex-runtime-afhankelijkheden: de query berekent 'm
 * server-side en stuurt 'm mee, en de frontend importeert alleen het type.
 *
 * De `kind` zegt WAT de volgende stap is; de cockpit beslist HOE die wordt
 * uitgevoerd (link volgen óf een bestaande handler aanroepen). `href` is gevuld
 * voor stappen die navigeren; bij de overige stappen bedient de cockpit de actie.
 */

export type ProjectNextStepKind =
  | "start_measurement"
  | "open_quote"
  | "accept_quote"
  | "create_order"
  | "create_invoice"
  | "open_invoice"
  | "close_project"
  | "make_quote"
  | "none";

export type ProjectNextStep = {
  /** Waar sta je (korte fase-aanduiding). */
  phaseLabel: string;
  /** Wat nu (titel van de eerstvolgende actie). */
  actionLabel: string;
  /** Korte toelichting onder de actie. */
  hint: string;
  /** Welke actie de cockpit moet uitvoeren. */
  kind: ProjectNextStepKind;
  /** Directe link als de stap navigeert; anders null (cockpit bedient de actie). */
  href: string | null;
  tone: "warning" | "info" | "success" | "neutral";
  /** Gestopt dossier (geannuleerd/afgewezen): geen voortgang. */
  isStopped: boolean;
};

type ProjectNextStepInput = {
  status: string;
  projectId: string;
  latestQuoteId: string | null;
  invoiceId: string | null;
  /** Directe-verkoop-dossier: inmeten overslaan, meteen richting offerte. */
  directeVerkoop?: boolean;
  /**
   * Status van de laatste inmeting. Nodig om binnen 'measurement_planned' het
   * overdrachtsmoment te zien: is de inmeting al afgerond, dan is de volgende stap
   * niet langer "Inmeting uitvoeren" (buitendienst) maar "Offerte maken" (winkel).
   */
  measurementStatus?: string | null;
};

/** De inmeting is klaar voor de winkel (gemeten, gecontroleerd of al verwerkt). */
export function isMeasurementCompleted(measurementStatus?: string | null): boolean {
  return (
    measurementStatus === "measured" ||
    measurementStatus === "reviewed" ||
    measurementStatus === "converted_to_quote"
  );
}

export function computeProjectNextStep(input: ProjectNextStepInput): ProjectNextStep {
  const { status, projectId, latestQuoteId, invoiceId, directeVerkoop, measurementStatus } = input;
  const quoteHref = latestQuoteId ? `/portal/offertes/${latestQuoteId}` : null;
  const newQuoteHref = `/portal/offertes?open=nieuw&project=${projectId}`;
  const invoiceHref = invoiceId ? `/portal/facturen/${invoiceId}` : null;

  switch (status) {
    case "lead":
      // Directe verkoop slaat inmeten over: stuur meteen naar de offerte (catalogus)
      // i.p.v. "Inmeting starten" — anders is de banner tegenstrijdig met de intent.
      if (directeVerkoop) {
        return {
          phaseLabel: "Directe verkoop",
          actionLabel: "Offerte maken",
          hint: "Klant koopt een product zonder inmeten — maak de offerte met de catalogus.",
          kind: "make_quote",
          href: newQuoteHref,
          tone: "warning",
          isStopped: false
        };
      }
      return {
        phaseLabel: "Aanvraag",
        actionLabel: "Inmeting starten",
        hint: "Plan of start de inmeting voor deze aanvraag.",
        kind: "start_measurement",
        href: null,
        tone: "warning",
        isStopped: false
      };
    case "measurement_planned":
      // Overdracht buitendienst → winkel: is de inmeting afgerond, dan is de bal weer
      // bij de winkel. Voorheen bleef hier "Inmeting uitvoeren" staan en zag de winkel
      // alleen via de Inmeting-tab dat er al gemeten was.
      if (isMeasurementCompleted(measurementStatus)) {
        return {
          phaseLabel: "Inmeting afgerond",
          actionLabel: "Offerte maken",
          hint: "De inmeting is afgerond — maak de offerte met de klaargezette meetregels.",
          kind: "make_quote",
          href: newQuoteHref,
          tone: "warning",
          isStopped: false
        };
      }
      return {
        phaseLabel: "Inmeting gepland",
        actionLabel: "Inmeting uitvoeren",
        hint: "Voer de inmeting uit en zet de regels klaar voor de offerte.",
        kind: "start_measurement",
        href: null,
        tone: "info",
        isStopped: false
      };
    case "quote_draft":
      return {
        phaseLabel: "Offerteconcept",
        actionLabel: "Offerte afmaken",
        hint: "Maak de offerte af en verstuur 'm naar de klant.",
        kind: "open_quote",
        href: quoteHref ?? newQuoteHref,
        tone: "warning",
        isStopped: false
      };
    case "quote_sent":
      return {
        phaseLabel: "Offerte verzonden",
        actionLabel: "Akkoord verwerken",
        hint: "Zet het dossier op akkoord zodra de klant akkoord geeft.",
        kind: "accept_quote",
        href: null,
        tone: "info",
        isStopped: false
      };
    case "quote_accepted":
      return {
        phaseLabel: "Offerte akkoord",
        actionLabel: "Bestelling vastleggen",
        hint: "Leg de leveranciersbestelling vast om door te gaan.",
        kind: "create_order",
        href: null,
        tone: "info",
        isStopped: false
      };
    case "ordering":
    case "execution_planned":
    case "in_progress":
      return {
        phaseLabel: "Bestellen",
        actionLabel: "Factuur aanmaken",
        hint: "Maak de factuur aan zodra het werk is uitgevoerd.",
        kind: "create_invoice",
        href: null,
        tone: "info",
        isStopped: false
      };
    case "invoiced":
      // Normaal is er een factuur om naartoe te linken. Mocht het dossier 'invoiced'
      // staan zónder factuur (bv. via een losse statuswijziging), degradeer dan naar
      // de handler-actie "Factuur aanmaken" i.p.v. een dode link zonder bestemming.
      return invoiceHref
        ? {
            phaseLabel: "Gefactureerd",
            actionLabel: "Betaling registreren",
            hint: "Registreer de betaling op de gekoppelde factuur.",
            kind: "open_invoice",
            href: invoiceHref,
            tone: "info",
            isStopped: false
          }
        : {
            phaseLabel: "Gefactureerd",
            actionLabel: "Factuur aanmaken",
            hint: "Er is nog geen factuur gekoppeld; maak de factuur aan.",
            kind: "create_invoice",
            href: null,
            tone: "info",
            isStopped: false
          };
    case "paid":
      return {
        phaseLabel: "Betaald",
        actionLabel: "Dossier afsluiten",
        hint: "Sluit het dossier af; de opvolging is klaar.",
        kind: "close_project",
        href: null,
        tone: "success",
        isStopped: false
      };
    case "closed":
      return {
        phaseLabel: "Gesloten",
        actionLabel: "Dossier afgerond",
        hint: "Dit dossier is volledig afgerond.",
        kind: "none",
        href: null,
        tone: "neutral",
        isStopped: false
      };
    case "quote_rejected":
      return {
        phaseLabel: "Offerte afgewezen",
        actionLabel: "Nieuwe offerte maken",
        hint: "De offerte is afgewezen — maak eventueel een nieuwe.",
        kind: "make_quote",
        href: newQuoteHref,
        tone: "warning",
        isStopped: true
      };
    case "cancelled":
      return {
        phaseLabel: "Geannuleerd",
        actionLabel: "Dossier geannuleerd",
        hint: "Dit dossier is geannuleerd.",
        kind: "none",
        href: null,
        tone: "neutral",
        isStopped: true
      };
    default:
      return {
        phaseLabel: status,
        actionLabel: "Volgende stap",
        hint: "",
        kind: "none",
        href: null,
        tone: "neutral",
        isStopped: false
      };
  }
}

/**
 * Dashboard-werklijst-meta per projectstatus: de "opvolgen"-framing van het
 * dashboard (een lijst van dossiers die aandacht nodig hebben) — bewust anders dan
 * de imperatieve {@link computeProjectNextStep}-actie op de cockpit, maar híer
 * gecentraliseerd zodat alle status-afhankelijke copy uit één bestand komt en niet
 * meer per scherm uiteen kan lopen.
 *
 * Geeft `null` voor statussen die geen werklijst-item zijn (afgerond/gestopt/
 * gefactureerd/betaald). `rank` = sorteervolgorde (lager = urgenter).
 */
export type ProjectWorklistMeta = {
  title: string;
  badge: string;
  tone: "warning" | "info" | "success";
  rank: number;
};

export function projectWorklistItem(
  status: string,
  opts?: { measurementCompleted?: boolean }
): ProjectWorklistMeta | null {
  switch (status) {
    case "lead":
      return { title: "Nieuwe aanvraag opvolgen", badge: "Aanvraag", tone: "warning", rank: 1 };
    case "quote_draft":
      return { title: "Offerte afmaken", badge: "Concept", tone: "warning", rank: 1 };
    case "quote_sent":
      return { title: "Offerte opvolgen", badge: "Verzonden", tone: "info", rank: 2 };
    case "measurement_planned":
      // Afgeronde inmeting = overdracht terug naar de winkel: de werklijst moet dan
      // "offerte maken" zeggen i.p.v. te blijven hangen op "Inmeting voorbereiden".
      if (opts?.measurementCompleted) {
        return { title: "Inmeting afgerond — offerte maken", badge: "Ingemeten", tone: "warning", rank: 1 };
      }
      return { title: "Inmeting voorbereiden", badge: "Inmeting", tone: "info", rank: 2 };
    case "quote_accepted":
      return { title: "Akkoord opvolgen", badge: "Akkoord", tone: "info", rank: 2 };
    case "ordering":
    case "execution_planned":
    case "in_progress":
      return { title: "Bestelling opvolgen", badge: "Bestellen", tone: "success", rank: 2 };
    default:
      return null;
  }
}
