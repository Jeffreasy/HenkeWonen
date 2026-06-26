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
};

export function computeProjectNextStep(input: ProjectNextStepInput): ProjectNextStep {
  const { status, projectId, latestQuoteId, invoiceId } = input;
  const quoteHref = latestQuoteId ? `/portal/offertes/${latestQuoteId}` : null;
  const newQuoteHref = `/portal/offertes?open=nieuw&project=${projectId}`;
  const invoiceHref = invoiceId ? `/portal/facturen/${invoiceId}` : null;

  switch (status) {
    case "lead":
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
        phaseLabel: "Bestellen / uitvoering",
        actionLabel: "Factuur aanmaken",
        hint: "Maak de factuur aan zodra het werk is uitgevoerd.",
        kind: "create_invoice",
        href: null,
        tone: "info",
        isStopped: false
      };
    case "invoiced":
      return {
        phaseLabel: "Gefactureerd",
        actionLabel: "Betaling registreren",
        hint: "Registreer de betaling op de gekoppelde factuur.",
        kind: "open_invoice",
        href: invoiceHref,
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
