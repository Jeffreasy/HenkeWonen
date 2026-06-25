import type { MouseEvent } from "react";

/**
 * Gedeelde print-naar-PDF-helper voor klantdocumenten (offerte én factuur).
 *
 * Beide documentvoorbeelden delen dezelfde `.quote-document-*`-opmaak en de
 * print-CSS in `styles/layers/18-print.css` (gekoppeld aan `body.quote-print-active`
 * en `.quote-print-root`). Deze helper kloont het zichtbare voorbeeld, str/ipt de
 * schermelementen (`.no-print`, `.quote-document-actions`) en laat de browser de
 * geïsoleerde kopie printen.
 */

const PRINT_ROOT_ID = "quote-print-root";
const PRINT_ACTIVE_CLASS = "quote-print-active";
const DOCUMENT_SELECTOR = ".quote-document-preview";

function removePrintRoot() {
  window.document.getElementById(PRINT_ROOT_ID)?.remove();
  window.document.body.classList.remove(PRINT_ACTIVE_CLASS);
}

/**
 * Print het dichtstbijzijnde documentvoorbeeld boven de aangeklikte knop.
 * Gebruik dit als `onClick` van een printknop binnen het voorbeeld.
 */
export function printDocumentFromButton(event: MouseEvent<HTMLButtonElement>) {
  if (typeof window === "undefined") {
    return;
  }

  const source = event.currentTarget.closest(DOCUMENT_SELECTOR);

  if (!source) {
    return;
  }

  removePrintRoot();

  const printRoot = window.document.createElement("div");
  const printablePreview = source.cloneNode(true) as HTMLElement;
  const previousTitle = window.document.title;
  const printTitle = source.getAttribute("data-print-title") ?? previousTitle;

  printRoot.id = PRINT_ROOT_ID;
  printRoot.className = "quote-print-root";
  printablePreview
    .querySelectorAll(".no-print, .quote-document-actions")
    .forEach((element) => element.remove());
  printRoot.appendChild(printablePreview);

  window.document.body.appendChild(printRoot);
  window.document.body.classList.add(PRINT_ACTIVE_CLASS);
  window.document.title = printTitle;
  window.addEventListener(
    "afterprint",
    () => {
      window.document.title = previousTitle;
      removePrintRoot();
    },
    { once: true }
  );
  window.requestAnimationFrame(() => window.print());
}
