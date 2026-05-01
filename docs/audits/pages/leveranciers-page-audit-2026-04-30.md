# Leverancierspagina audit - 2026-04-30

## Samenvatting

De pagina `/portal/leveranciers` was technisch werkend en tenant-scoped, maar gaf te weinig waarde voor dagelijkse opvolging. De oude pagina was vooral een eenvoudige lijst met naam, status en e-mail. Na deze audit is de pagina opgewaardeerd naar een leveranciersoverzicht voor opvolging: status-samenvatting, zoek/filter, mobiele kaarten, Nederlandse statuslabels, rijker toevoegformulier en context over gekoppelde catalogus/importdata.

Er zijn geen wijzigingen gedaan aan importarchitectuur, cataloguslogica, prijslogica, btw-mapping, offerteberekening, auth of Convex schema.

## Gecontroleerde route en componenten

- `src/pages/portal/leveranciers/index.astro`
- `src/components/suppliers/SupplierWorkspace.tsx`
- `convex/portal.ts`
- `convex/suppliers.ts`
- `convex/catalog.ts`
- `convex/imports.ts`
- `convex/schema.ts`
- `src/lib/portalTypes.ts`
- `src/lib/i18n/statusLabels.ts`
- `src/components/ui/*`
- `src/styles/global.css`
- `tools/test_portal_routes.mjs`
- `tools/test_portal_a11y.mjs`

## Huidige datalogica

De leverancierspagina gebruikt `api.portal.listSuppliers` met `tenantSlug: session.tenantId`. In Convex wordt via `requireTenant` de tenant opgezocht en daarna worden leveranciers via de index `suppliers.by_tenant` geladen. De lijst wordt Nederlands gesorteerd op leveranciernaam.

Huidige gevalideerde stand:

| Teller | Waarde |
| --- | ---: |
| Leveranciers totaal | 27 |
| Productlijst ontvangen/download beschikbaar | 8 |
| Opgevraagd/opvolging nodig | 19 |
| Actieve catalogusproducten gekoppeld | 7.775 |
| Actieve importprofielen gekoppeld | 16 |
| Importbatches gekoppeld | 76 |
| Unieke bron-/prijslijstbestanden gekoppeld aan leveranciers | 17 |

Zichtbare ontvangen leveranciers:

- Ambiant
- Co-pro
- EVC
- Floorlife
- Headlam
- Interfloor
- Roots
- vtwonen

Zichtbare opvolgleveranciers:

- Busche
- Casadeco
- Casamance
- Caselio
- Dib
- Douwes Dekker
- Eco Line
- Flex Colours
- Forest
- Hebeta
- Lamelio
- Lifestyle
- Masureel
- Moduleo
- Nox
- PPC
- Qrail
- Uniluxe
- Vadain

## Gevonden issues

1. De pagina maakte niet binnen 5 seconden duidelijk welke leveranciers opvolging nodig hadden.
2. Er waren geen summarykaarten voor totaal, ontvangen, opgevraagd of gekoppelde catalogusproducten.
3. Er was geen zoek- of statusfilter.
4. De lijst gebruikte een legacy tabel zonder mobile-card pattern.
5. `productListStatus` werd via generieke statuslabels getoond, waardoor technische enumwaarden konden doorsijpelen.
6. Contactvelden uit het schema, zoals contactpersoon, telefoon, notities, laatste contact en verwacht op, werden niet benut.
7. De pagina toonde geen relatie met importprofielen, importbatches of catalogusproducten.
8. De route smoke/a11y tests controleerden `/portal/leveranciers` nog niet.

## Fixes direct gedaan

| Bestand | Wijziging | Reden | Business logic geraakt |
| --- | --- | --- | --- |
| `src/components/suppliers/SupplierWorkspace.tsx` | Herbouwd met design-system componenten, summarykaarten, zoek/filter, DataTable, mobile cards en rijker formulier | Pagina bruikbaar maken voor opvolging | Nee |
| `src/components/suppliers/SupplierWorkspace.tsx` | Kolom en mobile-card sectie `Prijslijstbestanden` toegevoegd | Zichtbaar maken welke aangeleverde bestanden per leverancier verwerkt zijn | Nee |
| `src/components/suppliers/SupplierWorkspace.tsx` | Handmatige productlijststatus-update per leverancier toegevoegd | Statusopvolging direct vanaf overzicht mogelijk maken | Alleen expliciete leverancierstatus-mutatie |
| `convex/portal.ts` | `listSuppliers` uitgebreid met tenant-scoped tellingen voor actieve producten, actieve importprofielen, importbatches en unieke bronbestanden | Leveranciers koppelen aan catalogus/importcontext zonder importlogica te wijzigen | Nee |
| `convex/portal.ts` | `createSupplier` uitgebreid met contactpersoon, telefoon, notities, laatste contact, verwacht op en status | Bestaande schemavelden bruikbaar maken | Nee |
| `convex/portal.ts` | `updateSupplierProductListStatus` toegevoegd met tenantcheck | Veilige statuswijziging via portal mogelijk maken | Alleen leverancierstatus |
| `src/lib/portalTypes.ts` | `ProductListStatus` type en extra supplier metrics toegevoegd | Typeveiligere UI | Nee |
| `src/lib/i18n/statusLabels.ts` | `formatProductListStatus` toegevoegd | Geen technische enumwaarden zichtbaar | Nee |
| `src/pages/portal/leveranciers/index.astro` | PageHeader-copy aangescherpt | Duidelijker doel van pagina | Nee |
| `tools/test_portal_routes.mjs` | `/portal/leveranciers` toegevoegd | Route regressie bewaken | Nee |
| `tools/test_portal_a11y.mjs` | `/portal/leveranciers` toegevoegd | A11y smoke regressie bewaken | Nee |

## Styling en UX

De pagina gebruikt nu:

- `PageHeader`
- `SectionHeader`
- `StatCard`
- `Card`
- `FilterBar`
- `SearchInput`
- `DataTable`
- `StatusBadge`
- `Field`, `Input`, `Select`, `Textarea`
- mobile-card rendering op smalle schermen

Het overzicht toont nu per leverancier:

- leveranciernaam
- productlijststatus
- contactgegevens
- laatste contactdatum
- verwachte datum
- aantal actieve producten
- aantal actieve importprofielen
- aantal importbatches
- unieke bron-/prijslijstbestanden
- laatste importstatus
- status-updateactie

## Bronbestanden

De lokale dataset bevat 21 Excelbestanden onder `DATA\Leveranciers\HenkeWonen`, waarvan 4 exacte kopieën door de importpreview als duplicaat worden overgeslagen. In Convex zijn daardoor 17 unieke bron-/prijslijstbestanden gekoppeld aan leveranciers.

Voorbeelden die nu zichtbaar zijn op de leverancierspagina:

- Ambiant: `Prijslijst Ambiant Tapijt 2025-04.xlsx`, `Prijslijst Ambiant Vinyl 07-2024.xlsx`
- Co-pro: `Co-pro Entreematten 2025.xlsx`, `Co-pro prijslijst lijm kit en egaline 2025-04.xlsx`, `Co-pro prijslijst Plinten 2025-07.xlsx`
- EVC: `Prijslijst EVC 2025 click en dryback apart.xlsx`
- Floorlife: o.a. PVC, traprenovatie, wandpanelen, douchepanelen/tegels en palletcollectie
- Headlam: `Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx`
- Interfloor: `henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls`
- Roots: `Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx`
- vtwonen: PVC en karpetten

## Nederlandse copy

Technische termen zoals `received`, `requested`, `manual_only` en `download_available` zijn vervangen door:

- Onbekend
- Opgevraagd
- Ontvangen
- Download beschikbaar
- Niet beschikbaar
- Alleen handmatig

Aria-labels zijn Nederlands, onder andere:

- `Zoeken in leveranciers`
- `Filter op productlijststatus`
- `Productlijststatus bijwerken voor ...`

## Responsive en mobile

Mobiele controle via de in-app browser liet zien:

- summarykaarten stapelen netjes
- formulier past binnen de viewport
- DataTable schakelt naar kaarten
- leveranciersnamen, statussen en notities wrappen binnen de kaart
- geen zichtbare horizontale overflow

## Accessibility

Controlepunten:

- pagina heeft h1 via `PageHeader`
- formuliervelden hebben labels
- status wordt tekstueel getoond, niet alleen met kleur
- DataTable heeft `ariaLabel`
- mobiele kaarten hebben list/listitem semantiek via bestaande `DataTable`
- buttons en selects hebben toegankelijke namen
- `/portal/leveranciers` is toegevoegd aan route/a11y smoke tests

## Relatie met importprofielen en catalogus

De pagina toont nu tellingen voor actieve producten, actieve importprofielen en importbatches per leverancier. Er is bewust geen diepe importprofielbewerking of catalogusfiltering ingebouwd. Dat blijft bij `/portal/import-profielen` en `/portal/catalogus`.

Vervolgadvies:

- Maak later links naar `/portal/import-profielen` en `/portal/catalogus` met leverancierfilter zodra die routes queryparameters ondersteunen.
- Voeg later een leveranciersdetailpagina toe voor contacthistorie, bestanden en opvolgacties.
- Voeg later volledige bewerkflow toe voor contactgegevens, notities en datums van bestaande leveranciers.

## Guardrailcontrole

- Geen importarchitectuur gewijzigd.
- Geen cataloguslogica gewijzigd.
- Geen prijslogica gewijzigd.
- Geen btw-mapping gewijzigd.
- Geen offerteberekening gewijzigd.
- Geen auth gewijzigd.
- Geen Convex schema gewijzigd.
- Geen delete-flow toegevoegd.
- Geen automatische statuswijzigingen toegevoegd.
- Alle nieuwe query/mutation-paden zijn tenant-scoped.

## Verificatie

Uitgevoerd:

- `npx convex dev --once --tail-logs disable --env-file .env.local` OK
- `npm run check` OK
- `npm run build` OK
- `npm run test:portal` OK
- `npm run test:a11y` OK
- `npm run catalog:preview` OK

Bekende buildmelding:

- De bestaande Vercel-waarschuwing blijft staan: lokale Node.js 25 wordt niet ondersteund door Vercel Serverless Functions; Vercel gebruikt Node.js 24 runtime.

## Resterende adviezen

1. Voeg een leveranciersdetailpagina toe zodra er meer contacthistorie of documentopvolging nodig is.
2. Maak statuswijzigingen later uitbreidbaar met `lastContactAt` en `expectedAt` update vanuit de rij.
3. Voeg directe links naar importprofielen/catalogus toe zodra die pagina’s leverancierfilters via querystring ondersteunen.
4. Overweeg een aparte “opvolging nodig”-view voor leveranciers met `unknown` of `requested`.
