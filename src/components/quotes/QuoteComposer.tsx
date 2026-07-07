import { Ruler, ShoppingCart, Wrench } from "lucide-react";
import { useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type {
  MeasurementProductGroup,
  PortalRoom,
  QuoteTemplateLine
} from "../../lib/portalTypes";
import MeasurementLinePicker from "./MeasurementLinePicker";
import QuoteLineEditor from "./QuoteLineEditor";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

type ComposerMethod = "catalog" | "manual" | "measurement";

type QuoteComposerProps = {
  mode: "full" | "field";
  session: AppSession;
  sortOrder: number;
  templateLines: QuoteTemplateLine[];
  projectRooms: PortalRoom[];
  productGroupHint: MeasurementProductGroup | null;
  quoteId: string;
  projectId: string;
  tenantSlug: string;
  onAddLine: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  onMeasurementLinesImported?: () => Promise<void> | void;
  /**
   * Toon de "Inmeting overnemen"-kaart. Uit in de buitendienst, waar de inmeet-picker
   * al prominent los boven de composer staat (primaire actie op locatie).
   */
  showMeasurement?: boolean;
};

const METHODS: Array<{
  key: ComposerMethod;
  icon: typeof ShoppingCart;
  title: string;
  description: string;
}> = [
  {
    key: "catalog",
    icon: ShoppingCart,
    title: "Catalogusproduct",
    description: "Prijs, eenheid en btw automatisch."
  },
  {
    key: "manual",
    icon: Wrench,
    title: "Werkzaamheid of handmatig",
    description: "Werkzaamheid, materiaal, korting of tekst."
  },
  {
    key: "measurement",
    icon: Ruler,
    title: "Inmeting overnemen",
    description: "Neem klaargezette meetregels over."
  }
];

/**
 * Geleide "Offertepost toevoegen": kies eerst hoe je toevoegt (catalogusproduct,
 * werkzaamheid/handmatig, of inmeting overnemen), daarna verschijnt alléén die flow.
 * Vervangt de vroegere twee-koloms dump (formulier + inmeetkaart tegelijk zichtbaar).
 */
export default function QuoteComposer({
  mode,
  session,
  sortOrder,
  templateLines,
  projectRooms,
  productGroupHint,
  quoteId,
  projectId,
  tenantSlug,
  onAddLine,
  onMeasurementLinesImported,
  showMeasurement = true
}: QuoteComposerProps) {
  const [method, setMethod] = useState<ComposerMethod>("catalog");

  // Standaardregels horen bij de handmatige flow; productregels kies je via de catalogus.
  const manualTemplateLines = templateLines.filter((line) => line.regelType !== "product");
  const methods = METHODS.filter((entry) => showMeasurement || entry.key !== "measurement");

  return (
    <div className="quote-composer">
      <div
        className="quote-composer-methods"
        role="group"
        aria-label="Manier om een offertepost toe te voegen"
      >
        {methods.map(({ key, icon: Icon, title, description }) => (
          <button
            key={key}
            type="button"
            className={`quote-composer-method${method === key ? " is-selected" : ""}`}
            aria-pressed={method === key}
            onClick={() => setMethod(key)}
          >
            <Icon size={22} aria-hidden="true" className="quote-composer-method-icon" />
            <span className="quote-composer-method-title">{title}</span>
            <span className="quote-composer-method-desc">{description}</span>
          </button>
        ))}
      </div>

      <div className="quote-composer-flow">
        {method === "catalog" ? (
          <QuoteLineEditor
            key="composer-catalog"
            mode={mode}
            surface="plain"
            hideHeader
            scope="product"
            sortOrder={sortOrder}
            session={session}
            projectRooms={projectRooms}
            productGroupHint={productGroupHint}
            onAdd={onAddLine}
            draftScopeId={`${quoteId}:product`}
          />
        ) : method === "manual" ? (
          <QuoteLineEditor
            key="composer-manual"
            mode={mode}
            surface="plain"
            hideHeader
            scope="manual"
            sortOrder={sortOrder}
            templateLines={manualTemplateLines}
            session={session}
            projectRooms={projectRooms}
            productGroupHint={productGroupHint}
            onAdd={onAddLine}
            draftScopeId={`${quoteId}:manual`}
          />
        ) : (
          <MeasurementLinePicker
            mode={mode}
            tenantSlug={tenantSlug}
            quoteId={quoteId}
            projectId={projectId}
            session={session}
            startSortOrder={sortOrder}
            onImported={onMeasurementLinesImported}
          />
        )}
      </div>
    </div>
  );
}
