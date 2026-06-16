# UI/UX-verbeterplan — Henke Wonen portal

_Opgesteld: 2026-06-16. Gebaseerd op een grondig code-onderzoek (5 parallelle audits: design-systeem/CSS, componentbibliotheek, scherm-UX, toegankelijkheid/responsive, interactie/feedback) plus visuele inspectie van de draaiende app (dashboard, offertes, QuoteBuilder, catalogus, facturen, buitendienst-mobiel) in light én dark mode._

> **Belangrijk:** elke audit-bevinding is in de broncode geverifieerd vóór uitvoering. Meerdere agent-claims bleken onjuist — die zijn hieronder gemarkeerd en zijn **niet** doorgevoerd.

## Tech-stack

Astro 6 (SSR) · React 19 · Convex · Tailwind 4 · Lucide. Styling via 17 genummerde CSS-layers (`src/styles/layers/`) met een volwaardig design-token-systeem (light + warme dark mode). Eigen UI-componentbibliotheek in `src/components/ui/`.

## Wat al sterk was (niet aangeraakt)

- Volwaardig token-systeem met light/dark; consistente spacing-, radius-, shadow- en typeschalen.
- Modals (`FormModal`, `ConfirmDialog`) hebben **wél** complete focus-trap, initiële focus en focus-herstel — twee agents beweerden het tegendeel; onjuist gebleken.
- `prefers-reduced-motion` wordt gerespecteerd; toetsenbord-shortcuts (`?`, `Ctrl+K`, `G+…`).
- Buitendienst-mobiel is echt touch-geoptimaliseerd (kleur + tekst statussen, grote targets, onderbalk).
- `MeasurementPanel` heeft nette foutafhandeling (`console.error` + `setError` + success-toasts) — de "lege catch"-claim was onjuist.
- `ShortcutHelpModal` is in gebruik via directe import in `KeyboardShortcutController` — geen dode code.

## Doorgevoerde wijzigingen

### Fase 0 — Zichtbare correctheidsbugs
| # | Wijziging | Bestand |
| --- | --- | --- |
| 0.1 | Dashboard toonde `€ NaN` + lege offertenummer/titel in "Opvolgen". Frontend-type las Engelse velden (`quoteNumber`/`title`/`totalIncVat`), backend levert NL-velden na de migratie. Type + reads uitgelijnd op `offertenummer`/`titel`/`totaalInclBtw`/`gewijzigdOp`. | `src/components/dashboard/DashboardQuoteFollowUps.tsx` |
| 0.2 | Dubbele titel in "Klant of lead toevoegen"-modal (FormModal-header + eigen SectionHeader). Ingebedde `SectionHeader` verwijderd. | `src/components/customers/CustomerForm.tsx` |
| 0.3 | Zwevende Actie-FAB overlapte de laatste tabelrij op desktop. Onderpadding `.portal-main` → `96px` (gelijk aan mobiel). | `src/styles/layers/02-portal-layout.css` |

### Fase 1 — Toegankelijkheid (WCAG)
| # | Wijziging | Bestand |
| --- | --- | --- |
| 1.1 | Skip-link "Naar inhoud" toegevoegd (thema-veilige kleurinversie); `main` kreeg `id="hoofdinhoud"`. | `PortalLayout.astro`, `FieldLayout.astro`, `03-utilities.css` |
| 1.2 | Focus-outline was `rgba(154,95,27,0.34)` (te subtiel). Nieuw `--focus-ring`-token per thema; toegepast op globale regel + FAB. | `01-tokens.css`, `07-overlays.css` |
| 1.3 | `--color-text-subtle` `#8a7966` (~3.46:1, AA-fail) → `#75634d` (~4.7:1 op surface). Disabled-opaciteit `0.58` → `0.62`. | `01-tokens.css` |

### Fase 2 — Feedback & waargenomen snelheid
| # | Wijziging | Bestand |
| --- | --- | --- |
| 2.1 | Hardcoded "…laden"-tekst in dashboard-panels vervangen door skeleton-placeholders + `aria-busy`. | `DashboardWorkOverview.tsx`, `DashboardQuoteFollowUps.tsx`, `DashboardRecentProjects.tsx` |
| 2.2 | Offerteregel-mutaties hadden geen feedback/foutafhandeling. Error-toasts op alle mutaties (toevoegen/wijzigen/verwijderen/voorwaarden/status/factuur) + success-toasts op de discrete acties; re-throw netjes opgevangen in QuoteBuilder. | `QuoteWorkspace.tsx`, `QuoteBuilder.tsx` |
| 2.3 | EmptyState-flikkering: tijdens laden van een offerte toonde de detailzone misleidend "Geen offerte geselecteerd" → nu `LoadingState`. | `QuoteWorkspace.tsx` |

### Fase 3 — Consistentie & polish
| # | Wijziging | Bestand |
| --- | --- | --- |
| 3.1 | Catalogus: rode `danger`-"Archiveren"-knop op élke rij → `ghost` (de destructieve `ConfirmDialog` blijft de veiligheidsklep). | `ProductListTable.tsx` |
| 3.3 | `.card:hover` border `#c5b69f` (nauwelijks zichtbaar in light, vreemd in dark) → `var(--line-strong)` (thema-correct). | `04-features-field.css` |

## Bewust niet doorgevoerd (met reden)

- **Statusbadges "uniformeren"** — alle badges gebruiken al hetzelfde `Badge`-component; geen echte inconsistentie. Een restyle zou tegen de guardrail "geen redesign zonder onderbouwing" ingaan.
- **QuoteBuilder status-acties beperken** — de huidige-status-knop wordt al ge-`disabled` (regel 689); dit is bewust ontwerp (toont volledige set met huidige status inactief), geen bug.
- **`ShortcutHelpModal` exporteren in `index.ts`** — niet nodig; wordt direct geïmporteerd en werkt.
- **`tone` → `variant` rename (StatCard/Checklist)** — ~25+ call-sites, puur interne API-cosmetica zonder gebruikersimpact en met regressierisico. Uitgesteld als optionele opschoning.
- **Toast-kleuren tokeniseren** — toasts zijn bewust donkere "snackbars" (identiek en correct in beide thema's); tokeniseren zou het ontwerp veranderen.
- **Field nav-pill tokeniseren** — de field-sidebar is altijd donker; de lichtgroene actief-pill werkt in beide thema's. Theme-responsive tokens zouden de dark-mode juist verslechteren.

## Grotere opschoning — uitgevoerd (2026-06-16)

### Barrel re-export-bestanden → verwijderd
- 27 pure 1-regel re-export-barrels in `src/components/ui/` verwijderd. De ~382 imports in 83 bestanden zijn herricht naar de submap-paden (bv. `../ui/Button` → `../ui/forms/Button`), consistent met de reeds bestaande submap-imports (`FormModal`, `Skeleton`, `ToastContainer`).
- Behouden: de 3 échte implementaties `PaginationControls.tsx`, `Tabs.tsx`, `ThemeToggle.tsx`.
- Verificatie: `astro check` 0 errors, `vitest` 197/197 tests groen, geen console-fouten.

### Legacy CSS-layer (`05-legacy-ui.css`) → gedeeltelijk opgeruimd
- Verwijderd (bewijsbaar dood, zelfstandige blokken): `.table`/`.table th,td`, `.quote-lines`, `.quote-line`, `.total-row` — ~45 regels (222 → ~177).
- **Bewust behouden** omdat ze nog actief in gebruik zijn: `.field`/`.input` (ProductSearch), `.button`-familie (ProductionReadiness, CustomerList, ImportBatchesTable), `.badge`-familie (DossierActions, ImportWarnings), `.tabs`/`.tab` (imports + data-issues), `.empty-state` (meerdere), `.form-action-cell` (QuoteLineEditor), `.icon-button` (verweven met live `.button`-blokken).
- **Volledige afbouw vereist een component-migratie** (genoemde schermen overzetten op de `ui-*`-componenten) — dat is feature-rakend werk met eigen regressierisico, een aparte vervolgstap.

## Volledige audit + follow-ups (2026-06-16)

Na de wijzigingen is een brede audit uitgevoerd (regressie/correctheid, a11y, codekwaliteit, beveiliging). Eindoordeel: GO — geen kritieke/hoge bevindingen. Beveiliging schoon (solide tenant-isolatie + rol-checks; veilige dev-auth-default). Meerdere agent-claims weerlegd na verificatie (focus-outline-fail, contrast 2,97:1, `--color-danger` bestaat niet, ProductList/ImportPreview "zonder foutafhandeling" — allemaal onjuist).

**Doorgevoerd n.a.v. de audit:**
- 4 suppliers-bestanden gemigreerd van index-barrel `../ui` naar submap-paden → imports nu 100% consistent; index-barrel nergens meer gebruikt door app-code.
- Verweesde `.quote-line`-regel uit `16-responsive.css` verwijderd.
- **FieldProjectWorkspace** (buitendienst): de 5 offerteregel-mutaties hadden geen foutafhandeling (het echte "field-mode ziet niets"-gat) → toast-feedback + re-throw toegevoegd, consistent met QuoteWorkspace.
- **ProductList**: success-toasts toegevoegd (opslaan/archiveren/herstellen); foutafhandeling was er al via `setError`.
- `dateText` gecentraliseerd: de identieke kopieën in `measurementUtils` en `supplierUtils` delegeren nu naar `lib/dates.ts#formatDate`.
- Geverifieerd correct (geen wijziging): ImportPreview-mutaties, AddSupplierForm silent-catch (parent toont toast + re-throw).

Verificatie: `astro check` 0 errors/0 warnings · `vitest` 197/197.

## Button-pass: tussenruimte genormaliseerd (2026-06-16)

Specifieke review van alle knoppen en hun onderlinge ruimte. De `Button`/`IconButton`-componenten zelf zijn consistent (varianten/maten, touch-targets). De **gap tussen knoppen in groepen** was echter inconsistent:
- De meeste containers gebruikten al `var(--space-2)` (8px): `*-header-actions`, `confirm-dialog-actions`, `filter-bar-actions`, `field-*-actions`, `mobile-card-actions`, `pagination-actions`, `vat-/import-gate-actions`.
- **Afwijkend en genormaliseerd → `var(--space-2)`:** `.toolbar` (was `10px` hardcoded — raakt offerte-regel-acties, status-acties én catalogus-rij-acties) en `.project-overview-/primary-/action-row` (was `6px` hardcoded).
- Gevolg: zelfs binnen de offertebouwer verschilden status-acties (8px) en regel-acties (10px); nu beide 8px. Visueel geverifieerd (catalogus, offertebouwer): alle button-rijen nu 8px.
- Bewust ongemoeid: icoon-tekst-gap *binnen* een knop (`.ui-button` 6px), preset-chips (`.field-room-presets-grid` 6px, compact chip-patroon), topbar-acties (`--space-3` = 12px, distinct top-level context).
- Catalogus-acties-kolom: "Bewerken"/"Archiveren" stapelden verticaal in de smalle kolom. Opgelost door de actie-cel niet te laten wrappen (nieuwe `cellClassName`-optie op `DataTableColumn` + `.data-table-actions-cell .toolbar { flex-wrap: nowrap }`) en de iconen uit de desktop-tabelknoppen te halen (mobiele kaarten houden icoon+tekst). Resultaat: knoppen naast elkaar, gelijke rijhoogtes, geen horizontale scroll (geverifieerd: 0px).
- Offerte-statusknoppen herontworpen: de huidige-status-knop wordt nu **verborgen** i.p.v. als modderig disabled blok getoond (de StatusBadge toont de status al), en "Annuleren" is van `danger` naar `secondary` gezet. Gevolg: geen "muur van rood" meer — per status nog één duidelijke danger-actie ("Afwijzen") + één primary ("Akkoord" of "Factuur aanmaken"), rest secondary.

## Resterend (toekomstig)

- Component-migratie om de rest van `05-legacy-ui.css` af te bouwen (`.field`/`.button`/`.badge`/`.tabs`/`.empty-state` nog live).
- Eventueel contrast op de donkerste achtergrond (`--color-bg`) verder finetunen — daar zit álle secundaire tekst (muted én subtle) rond ~4,1–4,4:1; vereist een palet-keuze.
- Optioneel: `tone` → `variant` uniformeren (StatCard/Checklist).
- Optioneel: `npm audit` in CI; `.env.production`-secret als live secret behandelen (gitignored, niet in historie).
