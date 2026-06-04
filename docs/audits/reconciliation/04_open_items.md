# Catalog Source Audit Open Items

## Category 1 - PARTIAL Files

These files show `coverage: missing` because the reconciliation script cannot match their articleNumber format to Convex. This is not a data error; it is likely a parser gap or a non-standard articleNumber column in these files. Each item needs a dedicated reconciliation pass in a future session.

- PARTIAL-01: Headlam gordijnen - 8205 vat_open, coverage unknown
- PARTIAL-02: Roots 2026 - 146 vat_open, coverage unknown
- PARTIAL-03: Ambiant Tapijt - 270 vat_open, coverage unknown
- PARTIAL-04: Ambiant Vinyl - 138 vat_open, coverage unknown

## Category 2 - VAT Open

VAT-01: 17 import profiles with `vatMode=unknown`.

Largest groups:

- Headlam: 8205
- Floorlife PVC: 786x2
- Co-pro Plinten: 469
- Co-pro Entreematten: 420
- Interfloor: 988
- Roots: 146

Resolution: use the `vatMappingReview` UI in `catalogReview.ts` and set inclusive/exclusive per price column. Do not resolve this via code.

Owner: Jeffrey / client.

## Category 3 - Skipped Files

- SKIP-01: Henke Wonen Jeffrey.xlsx - internal file, no import needed

Production import status remains `BLOCKED` until `vatMappingReview` is completed. This is correct and expected.
