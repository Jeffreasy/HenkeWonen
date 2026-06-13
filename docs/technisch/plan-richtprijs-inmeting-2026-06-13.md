# Plan: richtprijs bij inmeting (product kiezen → direct prijs zien)

Datum: 2026-06-13 · Status: **geïmplementeerd** (fase 0 t/m 4 uitgevoerd op 2026-06-13)

> **Besluit klant (2026-06-13):** alle leverancierslijsten zijn **exclusief btw**.
> Op basis daarvan is fase 0 uitgevoerd op de dev-omgeving:
> - 31.860 prijsregels met vatMode `unknown`/`inclusive` → `exclusive` gezet
>   (o.a. Texdecor "Prix de vente …" 16.833, Headlam "Consumer Price" 8.205, ZTAHL "Prijs" 545);
> - 14.066 pseudo-prijsregels verwijderd ("Code prix CAD CAL" 3.879, "Qté multiple d'achat" 10.149, "Unité de vente" 38);
> - resterend: 74.225 prijsregels, 0 × unknown/inclusive (geverifieerd via tweede dry-run).
>
> **Verificatiepunt voor de klant:** drie clusters spraken de blanket-bewering tegen en zijn
> conform het besluit tóch op exclusief gezet — de Roots/Unilin-kolom die letterlijk
> "incl. BTW" heet, de ZTAHL-verkooplijst en de Texdecor publieksprijzen. Blijkt een
> van deze toch inclusief, dan is terugdraaien één commando:
> `node tools/repair_price_data.mjs --rules-file=<json> --apply` met een regel
> `{ "fromModes": ["exclusive"], "toMode": "inclusive", "sourceColumnNames": ["…"] }`.

## 1. Doel

De buitendienst meet een ruimte op, kiest een product uit de catalogus en ziet **direct een richtprijs incl. btw** (hoeveelheid incl. snijverlies × verkoopprijs). De bestaande spelregel blijft overeind: de **offerte** blijft de plek waar prijs, product en btw definitief worden gecontroleerd — de richtprijs is indicatief en wordt zo gelabeld.

Gevraagde flexibiliteit: standaard incl. btw tonen, maar excl. moet ook kunnen (zie §5, weergave-instelling).

## 2. Hoe de prijsdata werkelijk in elkaar zit (geverifieerd op live dev, 2026-06-13)

Geverifieerd via volledige snapshot-export van dev-deployment `kindly-greyhound-592` plus verse btw-mapping-export (`docs/release-readiness/vat-mapping/vat-mapping-current-state-2026-06-12.{md,json}`).

### 2.1 De maten-hypothese klopt níet

De 88.291 prijsregels bij 25.045 producten (~3,5 per product) zijn **geen maten**, maar overwegend **meerdere prijstypes per product** uit dezelfde leverancierslijst:

| priceType | aantal (live dev) | betekenis | klantgericht? |
|---|---|---|---|
| `purchase` | 54.701 | inkoopprijs | ❌ nooit tonen |
| `advice_retail` | 27.750 | adviesverkoopprijs / consumer price | ✅ basis richtprijs |
| `manual` | 3.917 | onbepaald (grotendeels Texdecor "Code prix"-pseudoprijzen) | ❌ |
| `commission` | 737 | commissieprijs (intern) | ❌ |
| `pallet` | 566 | palletstaffel (inkoopcontext) | ❌ |
| `cut_length` / `roll` | 235 / 235 | coupage-/rolprijs — verkoop-of-inkoop **formeel onbeslist** | ❌ tot besluit |
| `net_purchase` | 121 | netto inkoop | ❌ |
| `step` / `package` | 15 / 14 | trede-/verpakkingsprijs — idem onbeslist | ❌ tot besluit |
| `retail` / `trailer` | 0 / 0 | bestaan in schema, niet in data | (toekomstvast meenemen) |

**Maten** zitten vrijwel altijd in aparte productregels (eigen artikelnummer/EAN, bv. Headlam "DAHLIA 140CM") of in productvelden (`widthMm`/`lengthMm`/`thicknessMm`, `convex/schema.ts:399-402`). Uitzonderingen: Co-pro plintlengtes en entreemat-rolbreedtes zitten in prijskolomnamen, en FlexColours-raamdecoratie is een echte breedte×hoogte-prijsmatrix die **bewust niet geïmporteerd is** (geen richtprijs mogelijk voor raamdecoratie).

Goed nieuws: slechts **2 van de 25.045 producten** hebben prijzen maar géén adviesprijsregel. Dekking van `advice_retail` is dus vrijwel volledig.

### 2.2 KRITIEKE BEVINDING: de btw-stand van de data is niet betrouwbaar

Dit is de harde blocker vóór elke richtprijsweergave:

- Van de 27.750 adviesprijsregels staat **17.452 op `inclusive`, 8.999 op `unknown`** (o.a. héél Headlam-gordijnen: 8.205; Floorlife/EVC/vtwonen-PVC: 414) **en 1.299 op `exclusive`** (o.a. Interfloor: 988).
- De live profielmappings staan op **56 van 57 kolommen `exclusive`** — inclusief de kolom die letterlijk "Adviesverkoopprijs incl. BTW. per verpakking" heet, en tegen de seed in (`convex/seed/core.ts:743` had die op `inclusive`). Dit wijst op een bulk-reviewfout, niet op een bewust besluit.
- Het klantdoc van 06-10 ("advies = inclusief") spreekt de dev-stand dus tegen; de productie-stand is vanaf deze machine niet verifieerbaar.
- Wie nu naïef `amount × 1,21` rekent, telt voor 17.452 regels **dubbel btw**; wie `amount` als inclusief behandelt zit er voor de exclusieve sets naast.
- Daarnaast zijn ~14.028 regels pseudo-prijzen (Texdecor "Qté multiple d'achat" €25-bestelveelvoud: 10.149; "Code prix": 3.879) — de stripfunctie in `tools/upload_catalog_batch_import.mjs:120-128` bestond nog niet bij de import-run.
- `vatRate` staat overal op 21; 9% komt nergens voor.

Belangrijk: het corrigeren van de **profielmappings** repareert de bestaande 88.291 **rijen** niet — die dragen de vatMode van het importmoment. Er is een bulk-reparatie of her-import nodig (fase 0).

### 2.3 Eenheden-realiteit per productgroep

Meeteenheid vs. beschikbare advies-prijseenheden (live):

| Meetgroep | meet-unit | advies-units beschikbaar | conclusie |
|---|---|---|---|
| Vloeren | m² | m² schaars (~760); veel via `pack` (Roots/Lay Red/Moods) | pak→m² conversie nodig via `packageContentM2` (dekking 59/79 PVC-pakregels) |
| Plinten | m¹ | m¹ ruim (17.166 advies-regels totaal in m¹) | direct bruikbaar |
| Behang | rol | `roll` slechts 143; Texdecor-behang (6.991 advies-regels) staat in categorie **"Overig"** met unit **"custom"** | categoriefix of mappingverbreding nodig (§7 vraag 11) |
| Gordijnen | m¹ | Headlam Consumer Price m¹ — maar 8.205× vatMode `unknown` | werkt pas na btw-reparatie |
| Trap | trede/stuk | `step` 15, piece beperkt | beperkte dekking |
| Raamdecoratie | — | FlexColours niet geïmporteerd | geen richtprijs (expliciet melden in UI) |

Géén m¹↔m² conversie doen (vereist onbevestigde rolbreedte-aannames). Enige toegestane conversie: pak→m² waar `packageContentM2` gevuld is.

## 3. De prijskeuzeregel (deterministisch)

Nieuwe, aparte Convex-query `convex/catalog/pricing.ts → getIndicativePrice` (géén hergebruik van `pricePriority` uit `catalog/core.ts:120-128` — die valt terug op inkoopprijzen en negeert vatMode). Gegeven `productId` + meeteenheid:

1. **Verzamel** alle `productPrices` via index `by_product`.
2. **Whitelist priceType**: alléén `advice_retail` en `retail`. Nooit fallback naar andere types — bij 0 kandidaten liever geen richtprijs dan een inkoopprijs bij de klant op tafel.
3. **Geldigheid**: verwerp `validFrom > now` (nu een no-op: 1.258 regels met validFrom, 0 toekomstig; wel toekomstvast). `validUntil` wordt nergens gezet → negeren zolang leeg.
4. **vatMode-normalisatie** (kern):
   - `exclusive` → incl-bedrag = `calculateIncVat(amount, vatRate)` (`src/lib/money.ts:9-11`; serverside equivalent in de query);
   - `inclusive` → incl-bedrag = `amount`;
   - `unknown` → **regel verwerpen** (geen richtprijs). Aanname "unknown = inclusief" mag alleen ná businessbesluit en dan als **datareparatie**, niet als leesregel.
5. **priceUnit-match** op de meeteenheid: `m2→[m2]`, `m1|meter→[m1,meter]`, `roll→[roll]`, `piece|stuk→[piece]`, `pak→[pack,package]`, `trede→[step]`. Eén conversie toegestaan: meet-unit m² + priceUnit pack/package + `packageContentM2` gevuld → prijs per m² = incl-bedrag ÷ `packageContentM2` (markeer `conversionApplied`).
6. **Tie-break** bij >1 kandidaat (reëel: 2.653 producten hebben >1 advies-regel, o.a. door de dubbel geïmporteerde Floorlife-lijst onder twee bestandsnamen): (a) hoogste `validFrom` (ontbrekend = laagste), (b) nieuwste `updatedAt`, (c) hoogste `_creationTime`, dan `_id`-stringvergelijking als stabiele scheidsrechter.
7. **0 kandidaten** → `null`; UI toont "Richtprijs nog niet beschikbaar" (productkeuze blijft mogelijk en wordt opgeslagen).
8. **Respons** (alleen afgeleide velden, nooit ruwe inkoopdata): `{ unitPriceIncVat, unitPriceExVat, vatRate, priceType, priceUnit, vatModeUsed, validFrom?, conversionApplied? }`.
9. **Autorisatie & filters**: rollen `["user","editor","admin"]` (viewer = openstaande vraag §7.8); pilot-guard via `pilotHiddenReason` (`convex/catalog/pilot.ts:18-28`).

Richtprijs in de UI = `roundMoney(quantity × unitPriceIncVat)`, geformatteerd met `formatEuro`, altijd gelabeld **"Richtprijs incl. btw — indicatief"**.

## 4. Fasering

### Fase 0 — btw- en datareparatie (BLOCKER, vereist klantbesluiten)

Zonder deze fase toont de feature voor ~32% van de adviesprijzen niets (o.a. alle Headlam-gordijnen) en rekent hij voor exclusieve sets verkeerd.

1. Klant bevestigt per advieskolom incl./excl. (beslistabel: `docs/release-readiness/vat-mapping/vat-mapping-human-decision-table-2026-06-12.md`). Vooral: was de dev-bulkstand (alles exclusive) bewust of een fout?
2. Profielmappings corrigeren via de bestaande VAT-workbench in de portal.
3. **Bestaande rijen repareren**: migratie-mutatie (admin/tooling-gated) die `vatMode` patcht per (`sourceFileName`, `sourceColumnName`) volgens de bevestigde besluiten. Alternatief: dev her-importeren (`catalog:reset` + import) — beproefd maar zwaarder.
4. Pseudo-prijzen opschonen: verwijder regels met sourceColumn "Code prix*" (3.879) en "Qté multiple d'achat" (10.149) — strip-logica bestaat al in het uploadscript, nu ook als cleanup op bestaande data.
5. Floorlife-duplicaatlijst (zelfde prijzen onder 2 bestandsnamen, 2×426 regels) archiveren/ontdubbelen.
6. Optioneel: Texdecor-behang van categorie "Overig" naar "Behang" (of mapping verbreden, §7.11).

### Fase 1 — backend

1. `convex/schema.ts` `measurementLines`: toevoegen `productId: v.optional(v.id("products"))` + prijssnapshot `indicativeUnitPriceExVat?`, `indicativeVatRate?`, `indicativePriceUnit?`, `indicativeCapturedAt?` (snapshot = reproduceerbaar + geen joins in tabellen; zie §5).
2. `convex/projecten/measurements.ts`: `addMeasurementLine` (regel 490-549) en `updateMeasurementLine` (586-645) uitbreiden met deze velden; productvalidatie analoog aan `validateQuoteLineProduct` (`convex/portalUtils.ts:807-830`, incl. pilot-block).
3. Nieuwe query `convex/catalog/pricing.ts → getIndicativePrice` volgens §3. Prijskeuze als **pure, exporteerbare helper** zodat hij unit-testbaar is.
4. Types: `PortalMeasurementLine` (`src/lib/portalTypes.ts:127-146`), `MeasurementLineDoc` (`src/components/projects/measurement/measurementTypes.ts:52-65`), `ReadyLine` (`src/components/quotes/MeasurementLinePicker.tsx:53-65`).

### Fase 2 — UI inmeten (winkel + buitendienst, zelfde component)

1. Productkiezer-component extraheren uit `QuoteLineEditor.tsx` (load-effect regel 74-125 + picker-UI 326-363) tot herbruikbare `CatalogProductPicker`; daarbij de bestaande bug fixen: dependency-array op regel 125 mist `productGroupHint`/`allowedCategories`.
2. `MeasurementPanel.tsx` `buildCalcTabs()` (1568-1917): per calculator-tab de kiezer in `fields` (gefilterd via `getAllowedCategories(productGroup)` uit `src/lib/quotes/measurementCatalogMapping.ts`) en de richtprijs als extra regel in het live "result"-SummaryList-paneel. Tab "manual" volgt de productGroup-select (1891-1895); groep "other" → geen filter.
3. `addLine`-helper (552-614) + per-tab `*ProductId` state (bij 130-174): productId + snapshot meesturen.
4. Meetregeltabel `lineColumns` (986-1073) + mobile cards (1943-1984): kolom product + richtprijs (uit snapshot — geen N+1).
5. Editformulier (1987-2073) + `lineCorrectionDraft` (176-183): product wijzigbaar; bij wijziging van product of hoeveelheid snapshot verversen via `getIndicativePrice`.
6. Weergave-instelling incl./excl. btw: standaard **incl.**; toggle in het paneel (sessievoorkeur), beide waarden zitten in het snapshot dus puur presentatie.
7. Disclaimer `CalculatorTabs.tsx:59-60` aanpassen ("richtprijs is indicatief; definitieve prijs in de offerte").
8. Field-mode krijgt alles gratis mee (zelfde `MeasurementPanel`, `FieldProjectWorkspace.tsx:361-368`).
9. Debounce op de prijslookup (authz doet 2 db-reads per call) — lookup alleen bij productkeuze/hoeveelheid-wijziging, niet per toetsaanslag.

### Fase 3 — doorstroom naar de offerte

1. `importMeasurementLinesToQuote` (`convex/offertes/core.ts:981-1124`): als de meetregel `productId` + snapshot heeft → `productId`, `unitPriceExVat` (ex-btw uit snapshot) en `vatRate` zetten i.p.v. 0/0 (regels 1082-1083); `requiresManualProductReview: false`, `requiresManualPriceReview` blijft **true** (bewuste controle blijft verplicht); titel/omschrijving (`convex/portalUtils.ts:856-879`) productnaam laten tonen.
2. `MeasurementLinePicker.tsx`: gekozen product + richtprijs tonen in tabel/cards/ConfirmDialog vóór import.
3. `QuoteBuilder` werkt ongewijzigd door (inferentie via metadata blijft intact).

### Fase 4 — tests en flankerende fixes

1. Unit-tests voor de prijskeuze-helper (`tests/indicativePrice.test.ts`): whitelist, vatMode-normalisatie, unknown→null, pak→m²-conversie, tie-breaks, 0-kandidaten.
2. Calculatortests uitbreiden met richtprijsberekening; smoke-test inmeetpagina.
3. **Aparte fix-taak (niet meeliften)**: `listProductsForPortal` labelt `amount` ongezien als `priceExVat` en kan via de priority-fallback inkoopprijzen tonen aan elke rol (`convex/catalog/core.ts:120-128, 528`) — bestaand lek, klein in praktijk (2 producten) maar fout patroon; bij voorkeur ook daar de §3-regel hergebruiken.

## 5. Snapshot vs. live prijs

Keuze: **snapshot op de meetregel** (prijs op moment van keuze), met verversing bij bewerken. Redenen: reproduceerbaar ("waarom stond er €X bij de klant thuis?"), geen joins/N+1 in lijsten, en geen stille prijswijziging tussen meting en offerte. Bij offerte-import wordt de snapshot als voorinvulling gebruikt en blijft prijsreview verplicht. Drift bij prijsimports is acceptabel omdat de richtprijs expliciet indicatief is; desgewenst later "snapshot verouderd"-indicator (vergelijk `indicativeCapturedAt` met laatste import).

## 6. Wat dit níet doet

- Geen marge-/staffellogica (1-op-1 adviesprijs; opslagbeleid is een businesskeuze, §7.7).
- Geen m¹↔m²-conversies of rolbreedte-aannames.
- Geen prijzen voor raamdecoratie (FlexColours niet geïmporteerd) en Masureel-behang (profiel klaar, niet geïmporteerd) — UI meldt dit expliciet.
- Geen wijziging van het offerteproces: controle van product/prijs/btw blijft daar verplicht.

## 7. Beslispunten voor de klant (Henke Wonen)

1. Per advieskolom: bedrag **incl. of excl. btw**? (beslistabel 2026-06-12; alle "medium confidence", alleen Co-pro-lijmkolom is expliciet). Was de dev-bulkstand (alles exclusive) bewust?
2. Reparatieroute bestaande rijen: bulk-patch of her-import?
3. Zijn `roll`/`cut_length` (Ambiant, entreematten) en `package`/`step` (traprenovatie) verkoop- of inkoopprijzen?
4. Texdecor: mogen "Code prix" en "Qté multiple d'achat" als prijsregels verwijderd worden? Welke inkoopstaffel (BNLA/B/C) geldt?
5. Kloppen parser-aannames (Lamelio inkoop = 60% van MSRP-excl; Hebeta 40%/45,46%; m¹→m² deler 4,0)?
6. Welke prijslijsten zijn commercieel actueel (vtwonen PVC 11-2023, Ambiant vinyl 07-2024 vs Roots/Unilin 05-2026)?
7. Richtprijsbeleid: kale adviesprijs of opslag/afronding per productgroep? Presentatie per regel, per ruimte en/of totaal?
8. Mag rol `viewer` de richtprijs zien?
9. Scope raamdecoratie/Masureel: expliciet "geen richtprijs" accepteren?
10. Pilotbron: dev-catalogus of productie? (Staan aantoonbaar niet gelijk.)
11. Texdecor-behang in categorie "Overig": omhangen naar "Behang" of wallpaper-mapping verbreden?

## 8. Risico's

- **Grootste risico**: richtprijs op foute btw-stand → systematisch 21% te hoog/laag. Mitigatie: fase 0 is blokkerend; `unknown` toont nooit een prijs.
- Eenheden-mismatch → mitigatie: harde priceUnit-match, alleen gedocumenteerde pak→m²-conversie, anders "niet beschikbaar".
- Stale snapshots na prijsimport → acceptabel (indicatief), optionele verouderd-indicator.
- Dev ≠ productie: alle datacijfers in dit plan zijn dev-stand; vóór productie-uitrol dezelfde verificatie tegen productie draaien (`npm run catalog:vat:export -- --target=production`).

## 9. Omvang (indicatie)

| Fase | Omvang |
|---|---|
| 0 — btw/datareparatie | vooral besluiten + 1 migratiescript + cleanup-script; doorlooptijd hangt op de klant |
| 1 — backend | schema + 2 mutaties + 1 query + helper + types: ~1 dag |
| 2 — UI inmeten | picker-extractie + 6 tabs + tabel/edit + toggle: ~1,5–2 dagen |
| 3 — offerte-doorstroom | ~0,5 dag |
| 4 — tests/flankerend | ~0,5–1 dag |

## Vervolgacties uitgevoerd (2026-06-13, na implementatie)

1. **Texdecor-behang hersteld** — oorzaak gevonden: de parser vergeleek het
   supporttype met `"Papier  peint"` (dubbele spatie) terwijl `clean_text`
   witruimte samenklapt; al het gewone behang viel daardoor naar "Overig" met
   priceUnit "custom". Gefixt in `tools/build_catalog_import.py` én op de
   dev-data via `catalog:texdecor:repair` (nieuw): 6.991 producten
   (Casadeco 2.648, Caselio 2.664, Casamance 1.679) van "Overig" naar
   "Behang"/wallpaper/rol, plus 6.991 adviesprijsregels van priceUnit
   "custom" naar "roll". End-to-end geverifieerd: Casadeco "BABYLONE CAD
   SCRIBE" geeft richtprijs €72,41 incl. btw per rol.
2. **Parser-btw conform klantbesluit** — `vat_mode_for` zette ZTAHL-verkoop en
   Texdecor-publieksprijzen hardcoded op "inclusive"; bij her-import zou de
   gerepareerde data dus terugdraaien. Beide nu op "exclusive" met verwijzing
   naar het klantbesluit (en revert-instructie in de comment).
3. **Prijslek portal-catalogus gedicht** — `listProductsForPortal` gebruikt nu
   `selectCustomerFacingPrice` (zelfde whitelist/btw-normalisatie/tie-break als
   de richtprijs) in plaats van de oude pricePriority-fallback die
   inkoopprijzen kon tonen en vatMode negeerde.
4. **Profielmappings gelijkgetrokken** — de ZTAHL-verkoopkolom (laatste op
   "inclusive") via de vat-apply tooling op "exclusive" gezet; verse export
   bevestigt 57/57 kolommen exclusief
   (`vat-mapping-current-state-2026-06-13.json`). Daarmee zijn rijen,
   profielmappings én parser consistent.

## Bijlagen / bronnen

- Live verificatie: `docs/release-readiness/vat-mapping/vat-mapping-current-state-2026-06-12.{md,json}` + `vat-mapping-human-decision-table-2026-06-12.md` (gegenereerd 2026-06-13 tegen dev)
- Kolomtabel 55 kolommen: `docs/release-readiness/vat-mapping/vat-mapping-current-state-2026-06-01.md`
- Pseudo-prijzen Texdecor: `docs/archief/audits/data-import/texdecor-import-details.md`
- Parkeerbesluit duplicate EAN: `docs/release-readiness/data-issues/duplicate-ean-parkeerbesluit-2026-06-01.md`
