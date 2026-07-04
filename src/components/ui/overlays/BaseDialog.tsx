import { useEffect, useRef, type ReactNode } from "react";

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
 * Het <dialog>-element zelf is onzichtbaar (geen rand/achtergrond/padding) en
 * krimpt om de inhoud heen; een mousedown die op het element zelf landt is
 * daardoor altijd een druk op de ::backdrop → sluiten. Mousedown (niet click)
 * voorkomt dat tekst selecteren dat buiten het paneel eindigt de dialoog sluit.
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Pagina-scroll bevriezen zolang de dialoog open is.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={className ? `app-dialog ${className}` : "app-dialog"}
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onCancel={(event) => {
        // Escape: laat React de status bepalen, zodat state en DOM gelijk lopen.
        // NB: in de portal onderschept KeyboardShortcutController Escape met
        // preventDefault en klikt die op [data-modal-close]; dit pad dekt de
        // omgevingen zonder die controller (buitendienst).
        event.preventDefault();
        if (!closeDisabled) {
          onClose();
        }
      }}
      onClose={() => {
        // Vangnet: sluit de dialoog buiten React om (bv. door de browser),
        // dan loopt de React-status hier weer gelijk.
        if (open) {
          onClose();
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
