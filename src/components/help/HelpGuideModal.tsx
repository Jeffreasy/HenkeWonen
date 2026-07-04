import { ChevronDown, Flag, Paperclip, Receipt, ShieldCheck, Store, Tablet, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Compacte, ingebouwde versie van de werkgids: per onderwerp een kort
 * stappenlijstje in gewone taal. Alle kbd-teksten zijn letterlijke knop- en
 * schermteksten uit de app — nieuwe labels eerst verifiëren in de code.
 */

export type HelpGuideMode = "winkel" | "buitendienst";

type HelpTopic = {
  id: string;
  icon: ReactNode;
  title: string;
  body: ReactNode;
};

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

const TOPIC_KLEUREN: HelpTopic = {
  id: "kleuren",
  icon: <Flag size={17} aria-hidden="true" />,
  title: "De drie kleuren — wat heeft haast?",
  body: (
    <>
      <p>De gekleurde balk links op kaarten is overal hetzelfde: op het dashboard én op de tablet.</p>
      <ul className="help-guide-colors">
        <li>
          <span className="help-guide-dot help-guide-dot-rood" aria-hidden="true" />
          <span><b>Rood</b> — vandaag of morgen, of een probleem. Nú oppakken.</span>
        </li>
        <li>
          <span className="help-guide-dot help-guide-dot-oranje" aria-hidden="true" />
          <span><b>Oranje</b> — deze week, of er moet nog een datum worden geprikt.</span>
        </li>
        <li>
          <span className="help-guide-dot help-guide-dot-groen" aria-hidden="true" />
          <span><b>Groen</b> — klaar of nog ver weg. Hier hoef je niets mee.</span>
        </li>
      </ul>
    </>
  )
};

const TOPIC_WINKEL_FLOW: HelpTopic = {
  id: "winkel-flow",
  icon: <Store size={17} aria-hidden="true" />,
  title: "Van klant tot offerte (winkel)",
  body: (
    <ol className="help-guide-steps">
      <li>Ga naar <Kbd>Klanten</Kbd> en klik op <Kbd>Nieuwe klant</Kbd>. Naam, adres en telefoonnummer zijn genoeg.</li>
      <li>Plan het inmeetbezoek in: kies monteur en dag (inmeten kan op dinsdag, woensdag of donderdag). Het systeem bewaakt zelf of er nog plek is. Klik op <Kbd>Inplannen</Kbd>.</li>
      <li>Na het bezoek staan de maten al in het tabblad <Kbd>Inmeting</Kbd> — niets overtypen.</li>
      <li>Maak de offerte met <Kbd>Inmeting overnemen</Kbd>, voeg prijzen toe en klik op <Kbd>Markeer verzonden</Kbd>. Later zet je 'm op <Kbd>Akkoord</Kbd> of <Kbd>Afwijzen</Kbd>.</li>
    </ol>
  )
};

const TOPIC_NA_AKKOORD: HelpTopic = {
  id: "na-akkoord",
  icon: <Receipt size={17} aria-hidden="true" />,
  title: "Na het akkoord: bestelling & factuur",
  body: (
    <ol className="help-guide-steps">
      <li>Maak vanuit de akkoord-offerte de leveranciersbestellingen met <Kbd>Bestellingen genereren</Kbd> (tabblad <Kbd>Bestellingen</Kbd>).</li>
      <li>Maak daarna de factuur in hetzelfde dossier. Een lege of € 0-factuur versturen blokkeert het systeem vanzelf.</li>
      <li>Versturen naar de klant: klik op <Kbd>Klantversie printen</Kbd> en kies “Opslaan als PDF”. Die PDF mail of app je zelf — automatisch e-mailen volgt zodra het domein klaar is.</li>
    </ol>
  )
};

const TOPIC_TABLET: HelpTopic = {
  id: "tablet",
  icon: <Tablet size={17} aria-hidden="true" />,
  title: "Op de tablet (monteur)",
  body: (
    <ol className="help-guide-steps">
      <li>Onder <Kbd>Vandaag</Kbd> staat je route. Rood pak je als eerste.</li>
      <li>Op de klantkaart: <Kbd>Bellen</Kbd> belt direct, <Kbd>Route</Kbd> opent de kaart.</li>
      <li>Tik op <Kbd>Inmeten</Kbd>, dan per kamer op <Kbd>Nieuwe ruimte</Kbd>. Vul lengte en breedte in — de tablet rekent m², rollen en banen zelf uit, inclusief snijverlies.</li>
      <li>Noemt de tablet een richtprijs? Zeg er altijd bij: “Kantoor stuurt u de exacte prijs.”</li>
      <li>Klaar? Tik per regel op <Kbd>Naar offerte</Kbd> — de winkel kan meteen verder, bellen hoeft niet.</li>
    </ol>
  )
};

const TOPIC_DOSSIERSTUKKEN: HelpTopic = {
  id: "dossierstukken",
  icon: <Paperclip size={17} aria-hidden="true" />,
  title: "Dossierstukken & foto's",
  body: (
    <>
      <p>
        Onder <Kbd>Dossierstukken</Kbd> op de klantkaart bewaar je plattegronden, foto's en oude
        offertes. De monteur ziet ze op de tablet en kan er met <Kbd>Foto toevoegen</Kbd> zelf een
        foto van de situatie bij zetten.
      </p>
      <p>Alles is alleen zichtbaar voor ingelogde medewerkers — er bestaan geen open linkjes.</p>
    </>
  )
};

const TOPIC_PRIVACY: HelpTopic = {
  id: "privacy",
  icon: <ShieldCheck size={17} aria-hidden="true" />,
  title: "Privacy (AVG)",
  body: (
    <>
      <p>
        Vraagt een klant “wis mijn gegevens”? De beheerder opent de klantkaart en gebruikt{" "}
        <Kbd>Klant verwijderen</Kbd> — met de naam van de klant als extra bevestiging.
      </p>
      <p>
        Alle dossierstukken, inmetingen, offertes en projecten worden dan definitief verwijderd.
        Facturen bewaren we wettelijk 7 jaar; de klantnaam daarop wordt geanonimiseerd.
      </p>
    </>
  )
};

const WINKEL_TOPICS: HelpTopic[] = [
  TOPIC_KLEUREN,
  TOPIC_WINKEL_FLOW,
  TOPIC_NA_AKKOORD,
  TOPIC_DOSSIERSTUKKEN,
  TOPIC_TABLET,
  TOPIC_PRIVACY
];

const BUITENDIENST_TOPICS: HelpTopic[] = [
  TOPIC_TABLET,
  TOPIC_KLEUREN,
  TOPIC_DOSSIERSTUKKEN
];

/** Welk onderwerp standaard openklapt, op basis van de huidige pagina. */
export function defaultTopicId(mode: HelpGuideMode, pathname: string): string {
  if (mode === "buitendienst") {
    return "tablet";
  }
  if (pathname.startsWith("/portal/offertes")) {
    return "winkel-flow";
  }
  if (pathname.startsWith("/portal/facturen")) {
    return "na-akkoord";
  }
  if (pathname.startsWith("/portal/buitendienst")) {
    return "tablet";
  }
  if (
    pathname.startsWith("/portal/dossiers") ||
    pathname.startsWith("/portal/klanten") ||
    pathname.startsWith("/portal/agenda")
  ) {
    return "winkel-flow";
  }
  return "kleuren";
}

type HelpGuideModalProps = {
  mode: HelpGuideMode;
  open: boolean;
  pathname: string;
  onClose: () => void;
};

export function HelpGuideModal({ mode, open, pathname, onClose }: HelpGuideModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const topics = mode === "buitendienst" ? BUITENDIENST_TOPICS : WINKEL_TOPICS;
  const openTopicId = defaultTopicId(mode, pathname);

  return (
    <div
      className="shortcut-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Uitleg en hulp"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="shortcut-help-modal help-guide-modal">
        <div className="shortcut-help-header">
          <h2>Zo werkt het — in het kort</h2>
          <button type="button" className="icon-btn" aria-label="Sluiten" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="shortcut-help-body">
          <p className="help-guide-intro">
            De belangrijkste stappen in gewone taal. Alle knopteksten hieronder zien er precies zo
            uit in het systeem.
          </p>
          <div className="help-guide-topics">
            {topics.map((topic) => (
              <details
                className="help-guide-topic"
                key={topic.id}
                {...(topic.id === openTopicId ? { open: true } : {})}
              >
                <summary>
                  <span className="help-guide-topic-icon">{topic.icon}</span>
                  <span>{topic.title}</span>
                  <ChevronDown size={16} className="help-guide-chevron" aria-hidden="true" />
                </summary>
                <div className="help-guide-topic-body">{topic.body}</div>
              </details>
            ))}
          </div>
        </div>

        <div className="shortcut-help-footer">
          <p>
            Twijfel je ergens over? Bel even de winkel — en druk op <kbd className="kbd">?</kbd>{" "}
            voor de toetscombinaties.
          </p>
        </div>
      </div>
    </div>
  );
}
