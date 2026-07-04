import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "../../../lib/useScrollLock";

type BaseDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Toegankelijke naam; laat weg wanneer ariaLabelledBy wordt gebruikt. */
  ariaLabel?: string;
  /** id van het element dat de dialoog benoemt (bv. de modal-titel). */
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /** Extra klasse(n) voor het binnenpaneel-formaat, bv. "shortcut-help-modal". */
  className?: string;
  id?: string;
  /** Blokkeer sluiten via Escape/backdrop (bv. terwijl een actie loopt). */
  closeDisabled?: boolean;
  children: ReactNode;
};

/**
 * Gedeelde modal-basis op het native <dialog>-element.
 *
 * showModal() plaatst de dialoog in de browser-top-layer. Dat lost twee dingen
 * tegelijk op: de focus blijft gevangen in de dialoog (WCAG), en de dialoog
 * ontsnapt aan "containing blocks" van voorouders — de topbar heeft een
 * backdrop-filter, waardoor een gewone position:fixed-overlay dáárin opgesloten
 * raakt in plaats van over de hele pagina te liggen.
 *
 * Escape wordt volledig door de browser afgehandeld (cancel-event op de
 * bovenste dialoog in de top-layer); registreer dus géén globale
 * Escape-sneltoets die keydown preventDefault't, anders vuurt cancel nooit.
 *
 * Het <dialog>-element zelf is onzichtbaar (geen rand/achtergrond/padding) en
 * krimpt om de inhoud heen; een mousedown die op het element zelf landt is
 * daardoor altijd een druk op de ::backdrop → sluiten. Mousedown (niet click)
 * voorkomt dat tekst selecteren dat buiten het paneel eindigt de dialoog sluit.
 *
 * De dialoog wordt via een portal naar <body> gerenderd. Dat is nodig omdat
 * Chromium een <dialog> die via showModal() de top-layer in wil NIET rendert
 * wanneer hij binnen een gesloten-of-open <details> staat (o.a. onze
 * CollapsiblePanel) — en het voorkomt meteen andere ancestor-valkuilen
 * (overflow-clipping, inert-subtrees). React-events blijven via de React-tree
 * bubbelen, dus onClose/onSelect werken ongewijzigd.
 */
export function BaseDialog({
  open,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  id,
  closeDisabled = false,
  children
}: BaseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Portal pas na mount: op de server bestaat document.body niet, en een
  // gesloten dialoog hoeft server-side niets te renderen. Het <dialog> bestaat
  // dus pas ná deze eerste mount-cyclus (zie de mounted-dep op het open-effect).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Actuele waarden voor native-event-handlers (die kunnen vuren tussen
  // render en effect in, bv. bij een geforceerde close-request).
  const openRef = useRef(open);
  const closeDisabledRef = useRef(closeDisabled);
  openRef.current = open;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focust standaard het eerste focusbare element (vaak de
      // sluitknop). Laat een opt-in [data-autofocus]-element (bv. een zoekveld)
      // dat direct overrulen — deterministisch, in dezelfde tick.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // `mounted` staat bewust in de deps: door de portal-mount-guard bestaat het
    // <dialog> pas ná de eerste render. Zonder deze dep zou een modal die al
    // mét open=true mount (bv. {cond && <Modal open .../>}) nooit showModal()
    // krijgen en onzichtbaar blijven.
  }, [open, mounted]);

  // Focus-vangnet: dialog.close() herstelt de focus zelf, maar wordt de
  // component ge-unmount terwijl de dialoog open is (parent verdwijnt,
  // view-transition), dan draait close() nooit. Bewaar daarom het element dat
  // vóór openen focus had en herstel het in de cleanup.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (previouslyFocused?.isConnected && document.activeElement === document.body) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // Pagina-scroll bevriezen zolang de dialoog open is (gedeeld + refcounted,
  // zodat gestapelde dialogen elkaars restore niet verstoren).
  useScrollLock(open);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={className ? `app-dialog ${className}` : "app-dialog"}
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onCancel={(event) => {
        // Escape: laat React de status bepalen, zodat state en DOM gelijk lopen.
        event.preventDefault();
        if (!closeDisabledRef.current) {
          onClose();
        }
      }}
      onClose={() => {
        // De browser kan een dialoog geforceerd sluiten zonder (annuleerbaar)
        // cancel-event — bv. een tweede Escape onder het close-request-model.
        if (!openRef.current) {
          return;
        }
        if (closeDisabledRef.current) {
          // Sluiten is nu geblokkeerd (actie loopt): heropen zodat DOM en
          // React-state gelijk blijven en de gebruiker de dialoog blijft zien.
          requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            if (openRef.current && dialog && !dialog.open) {
              dialog.showModal();
            }
          });
          return;
        }
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
    >
      {open ? children : null}
    </dialog>,
    document.body
  );
}
