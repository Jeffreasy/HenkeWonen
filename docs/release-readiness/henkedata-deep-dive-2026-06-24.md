# HenkeWonenDATA → productie — uitputtende data-dive (2026-06-24)

> Diepteonderzoek (multi-agent) over álle 32 bronbestanden in `C:\…\HenkeWonenDATA` + de reeds-aanwezige
> data-audit-pijplijn (`analysis_output/`), gekruist met de productie-stand. Volledige PDF-extractie
> (pdftotext) + de calculator/marge-modelbron (`HenkeWonenDATA/convex/`). Doel: vaststellen wat er in de
> brondata zit dat nog **niet** in productie zit — met focus op arbeid/montage.

## TL;DR — de echt nieuwe vondsten

1. **De arbeid/montage-gap is 9 regels, niet 4.** Henke's eigen offerte-template (`Offerte voorbeeld.xlsx`)
   bevat 9 arbeid/montage-regels zonder tarief in het systeem. Géén enkele bron (incl. 4 PDF's) bevat
   aanvullende leg-/ophang-/montagetarieven → dit zijn **bedrijfsregels**, niet uit data af te leiden.
2. **Lamelio heeft een echte omzet-staffelkorting** (35/40/45/50% marge) — de enige staffelkorting in álle
   bronnen, en die zit **niet** in productie. Het is een *inkoop*-margebron, niet een verkoopprijs.
3. **Tapijt-leverkosten-staffel** (Hebeta+Montinique: transport <€200 → €21,80; tijdslevering €50–85) staat
   nergens in het systeem — een reële klantkost.
4. **`calculatorRules` is hard bevestigd inert** — en het zijn niet 18 placeholders maar 51 regels (33
   marge-delers + 18 placeholders), allemaal herkomst-/auditdocumentatie met **drift-risico**.
5. **2 lage datakwaliteit-restpunten**: ongeverifieerd Headlam-dubbelimport + 1 losse foute checksum-EAN.

---

## 1. Data-map per productgroep (bron → productie)

Prod = `accomplished-kangaroo-354`, geverifieerd schoon 17 jun. "ACTIEF" = werkende calculator; prijzen zijn
bij de import platgeslagen als `priceItems` (anker = `recommended_retail`).

| Groep | Bron (HenkeWonenDATA) | Productie |
|---|---|---|
| PVC vloer | 16 sheets / 10 best. (Floorlife/EVC/Co-pro/Unilin/Ambiant/Roots/vtwonen), 733 EAN | ✅ ACTIEF (area_m2). PVC Click gestaged, **niet** gepubliceerd |
| Vinyl | Ambiant Vinyl + Interfloor | ✅ ACTIEF (area_m2) |
| Tapijt | Montinique (advies), Hebeta (inkoop+advies), Ambiant/Interfloor 988 | ✅ ACTIEF (broadloom_m1). Leverkosten-staffel **niet** in prod |
| Vloerkleed/karpet | VT Wonen (vaste artikelen) | ✅ ACTIEF (catalog_pricing) |
| Schoonloopmat | Co-pro Entreematten | ✅ ACTIEF (area_m2) |
| Egaliseren | egaline-materiaal (Co-pro) | ✅ ACTIEF (screed_m2) + serviceCostRules. Primeren niet apart geprijsd |
| Behang | Masureel NL NG (3267 + lookup-sheets) | ✅ ACTIEF (area_m2) + behangen 55–65/rol |
| Wandpanelen | Lamelio Partner Gids + douchepanelen/tegels | ✅ ACTIEF (per_unit). **Lamelio-staffel niet in prod** |
| Raambekleding | **29 breedte×hoogte-matrixblokken, 5372 prijsposities** | ✅ ACTIEF (matrix) — sterkste dekking |
| Gordijnen/stoffen | Headlam (5954, byte-dubbel), Masureel-stof, Vadain-bon (geen prijzen) | ✅ ACTIEF (curtain_fabric). Confectie-tarief **ontbreekt** |
| Gordijnrails | Busche/Forest/Qrail | ⛔ LEAD-ONLY (geen prijslijst) |
| Horren | Uniluxe | ⛔ LEAD-ONLY (geen prijslijst) |
| Verlichting / meubels | geen data | ⛔ LEAD-ONLY/inactief |

---

## 2. Arbeid + montage — definitief

**Gedekt (19 `serviceCostRules`, = exact het master-tabblad "Werkzaamheden kosten totaal"):** trap-legkosten
(€400–1.795/type), strippen €150, legkosten per m² (rechte plank €17,50 / visgraat €22,50 / +bies €35),
egaliseren €15,95 (plavuizen €19,50), vloerverwarming dichtzetten €12,95, PVC plakondervloer €22,95,
Private Label €28,95, behangen €55–65/rol.

**Ontbrekend — 9 regels uit Henke's offerte-template, géén tarief in het systeem** (wel `quoteTemplateSection`):

| # | Regel | Eenheid |
|---|---|---|
| 1 | Plint geplaatst | per meter |
| 2 | Gordijn-confectie/maakloon (Vadain: "strijken apart berekend") | per stel/baan |
| 3 | Gordijnrail kompleet geplaatst | per meter |
| 4 | Plissé montage | per stuks |
| 5 | Houten/bamboe jaloezie montage | per stuks |
| 6 | Duette montage | per stuks |
| 7 | Traprenovatie PVC met inlegstrip | per stuks/trede |
| 8 | Wandpanelen geplaatst incl. lijm | per stuks |
| 9 | Primeren (los van egaliseren) | per m² |

→ **Niet uit data af te leiden** (data-onderzoek hiervoor uitgeput). 1 beslis-sessie met Wim/Simone → 9 nieuwe `serviceCostRules`.

**Lead-only (geen prijslijst — UI tonen, prijsberekening blokkeren):** gordijnrails (Qrail/Forest/Busche),
horren (Uniluxe), raambekleding-matrices Lifestyle/Flex Colours/Dib, vloerkleed/matten als m²-calculator,
plissé/jaloezie/duette als *product*, verlichting, meubels.

---

## 3. Calculator/marge-model (bron) vs productie

De DATA-repo had een engine (`calculators.ts`) + `calculatorRules` (51) die afgeleide prijzen **runtime**
zou reconstrueren uit één anker (`recommended_retail`) + de Excel-delers. De 51 regels = **33 marge-delers**
(pallet/commissie/coupage/roll-divisors + markup-factoren, mét `bronCel`-verwijzing naar de Excel-formule) +
**18 placeholders** (`vereistKlantInput=true`).

**In productie is dit platgeslagen:** `curate.ts` schrijft bij de import álle prijslagen al als statische
`priceItems` weg. Daardoor:
- `calculatorRules` wordt **nergens geconsumeerd** (code-geverifieerd: `pricingRules.ts` sluit inkoop-/staffel-/
  pseudo-prijzen zelfs expliciet uit als richtprijs).
- De tabel is dus **herkomst-/auditdocumentatie**, geen rekenpad — met **drift-risico**: niets dwingt af dat
  `priceItem == advies/deler`; een deler wijzigen heeft 0 prod-effect.
- De **6 `labor_surcharge=0`** zijn **by-design**: arbeid loopt volledig via `serviceCostRules`, niet via de
  engine. (Belangrijk: niet later dubbel tellen.)

**Beslissing nodig:** markeer `calculatorRules` expliciet als *audit-only* (documenteer dat `priceItems` de
waarheid zijn) **óf** bouw een drift-check (`priceItem ≈ advies/deler`). Niet half laten staan. Post-pilot.

---

## 4. Marge-/kosten-bronnen die nog niet in prod zitten (nieuw)

- **Lamelio omzet-staffel** (inkoop): ZILVER 0–10k = 35% · GOUD 10–25k = 40% · PLATINUM >25k = 45% ·
  INVENTARIS = 50% marge; midden OLMO-groep €16,20/14,88/13,64/12,40, strip €8,06/7,44/6,82/6,20; min. 15
  dozen; dropship NL €50 / BE €95; MSRP midden €30 / strip €15. → Vastleggen als **margebron buiten de
  klant-richtprijs** (pricingRules sluit staffelprijzen al uit). Bepaal op welk niveau Henke inkoopt.
- **Hebeta tapijt = inkoop + advies** (Ohio 16/39,95 … Monza 354,10/779) → afleidbare brutomarge ~58–72%;
  bruikbaar als **ijkpunt** voor de calculatorRules-delers. Montinique = identieke collectie, alleen advies.
- **Tapijt leverkosten-staffel** (beide PDF's): order <€200 → €21,80 transport; tijdslevering 08:00=€85 …
  12:00=€50. → Reële klantkost; toevoegen als aparte offerte-/serviceregel.

---

## 5. Datakwaliteit — restpunten

Prijs/btw/naam zijn in prod aantoonbaar opgelost (17 jun); EAN-duplicaten (1.871 groepen) bewust geparkeerd.
Twee lage open puntjes:
- **Headlam-dubbelimport (ongeverifieerd):** 2 byte-identieke gordijnstof-workbooks (0 EAN → buiten de
  EAN-dedup-triage). Niet bevestigd dat prod de "Collectie Compleet" (~8.215 rijen) maar 1× bevat → **tellen**.
- **Foute checksum-EAN `8717003467042`** (Floorlife Valento beige, rij 140) — functioneel ongevaarlijk (EAN
  is nooit klant-selector), maar als losse bron-fout niet opgeschoond → registreren in `catalogDataIssues`.
- Borg dat de **Roots mixed-text/price** parsing-regel in de importpijplijn zit (anders hervervuilt een her-import).

---

## 6. Aanbevelingen (geprioriteerd)

1. **Wim/Simone-sessie** → 9 ontbrekende `serviceCostRules` (arbeid/montage) + bevestig de 18 placeholders
   (vooral: de 6 `labor_surcharge=0` als "arbeid loopt via serviceCostRules").
2. **Lead-only UX**: tonen maar prijsberekening blokkeren; actief Qrail/Forest/Uniluxe + Lifestyle/Flex
   Colours/Dib prijslijsten opvragen (`supplierPriceRequests`).
3. **Tapijt-leverkosten** als offerte-/serviceregel toevoegen.
4. **Lamelio-staffel** vastleggen als interne margebron (niet klantzichtbaar).
5. **`calculatorRules`** post-pilot: audit-only markeren óf drift-check bouwen.
6. **Datakwaliteit**: Headlam-telling, foute EAN registreren, Roots-parsingregel borgen.

> Alle arbeid/montage-data-bronnen zijn hiermee **uitgeput**: wat ontbreekt zijn bedrijfsbeslissingen
> (de 9 montagetarieven + lead-only prijslijsten die leveranciers nog moeten aanleveren), niet data.
