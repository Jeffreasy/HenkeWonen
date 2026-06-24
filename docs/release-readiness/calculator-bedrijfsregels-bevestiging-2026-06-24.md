# Reken-/arbeidswaarden — te bevestigen met Wim/Simone (2026-06-24, herzien)

> **Belangrijke correctie (na code-onderzoek):** de eerdere lezing "arbeid staat op €0 in de richtprijs" was
> **onjuist**. De `calculatorRules`-tabel (met de 18 zg. placeholders, incl. `labor_surcharge=0`) wordt
> **nergens geconsumeerd** — niet door de frontend, niet door enige prijsberekening. Het is inerte seed-data.
> De waarden die de richtprijs en de inmeet-hoeveelheden **echt** aansturen, leven op drie andere plekken,
> en die zijn grotendeels **al gevuld**. Dit document vervangt de calculatorRules-placeholder-lijst door de
> waarden die er wél toe doen — een veel kleinere, concretere bevestiging.

## Waar de getallen echt vandaan komen

| Bron | Wat | Status | Geconsumeerd door |
|---|---|---|---|
| **`serviceCostRules`** | Arbeid/legkosten (€-tarieven) | ✅ gevuld (20 regels, op prod) | inmeet-flow (`MeasurementAssignPanel`/`roomLineDerivation`) + offertes |
| **`wasteProfiles`** | Snijverlies-% per groep | ✅ gevuld (8 profielen, op prod) | `convex/projecten/measurements.ts` |
| **Calc-code-defaults** | Gordijn-zoom/zijzoom + egaline-verbruik | ⚠️ hardcoded placeholders | `curtainCalculator.ts` / `screedCalculator.ts` |
| ~~`calculatorRules`~~ | ~~marge-delers + 18 placeholders~~ | ❌ **inert — nergens gelezen** | (niets) |

---

## A. Arbeid/legkosten — `serviceCostRules` (verifiëren, niet invullen)

Deze tarieven zijn al in het systeem en gaan mee in de inmeting/offerte. **Vraag aan Wim/Simone: kloppen
deze bedragen nog?** (ex. btw, 21%)

| Regel | Type | Tarief |
|---|---|---|
| Dichte trap tapijt | vast | € 400 |
| Open trap tapijt | vast | € 500 |
| Ondertapijt | vast | € 250 |
| PVC trap rechte trap | vast | € 1.595 |
| PVC trap kwart draai | vast | € 1.695 |
| PVC trap halve draai | vast | € 1.795 |
| Extra toeslag open trap | vast | € 100 |
| Vinyl trap | vast | € 450 |
| Strippen | vast | € 150 |
| Legkosten rechte plank | per m² | € 17,50 |
| Legkosten visgraat | per m² | € 22,50 |
| Legkosten visgraat met bies | per m² | € 35,00 |
| Egaliseren | per m² | € 15,95 |
| Egaliseren plavuizen | per m² | € 19,50 |
| Vloerverwarming dichtzetten | per m² | € 12,95 |
| PVC plakondervloer | per m² | € 22,95 |
| Private Label Henke Wonen | per m² | € 28,95 |
| Behangen patroon | per rol | € 65 |
| Behangen uni | per rol | € 55 |

> Ontbreekt er een arbeidssoort (bv. gordijnen ophangen/confectie, wandpanelen montage)? Die voeg je toe
> als nieuwe `serviceCostRule` — dat is de juiste plek, niet de calculator.

## B. Snijverlies — `wasteProfiles` (verifiëren)

Deze %'s sturen de benodigde-materiaal-berekening. **Vraag: kloppen deze?**

| Productgroep | Snijverlies |
|---|---|
| PVC rechte plank | 3% |
| PVC visgraat | 5% |
| Tapijt | 10% |
| Vinyl | 10% |
| Behang | 10% |
| Wandpanelen | 8% |
| Plinten | 5% |

## C. Gordijn-/egaline-defaults — de énige echte code-placeholders (4 waarden)

Deze staan hardcoded in de calc-code en zijn de enige die een (kleine) **codewijziging** vergen na bevestiging:

| Waarde | Nu | Te bevestigen |
|---|---|---|
| Gordijn zoom (boven+onder) | 0,30 m | Klopt 30 cm totaal? |
| Gordijn zijzoom (per baan) | 0,06 m | Klopt 6 cm per baan? |
| Egaline verbruik | 1,5 kg/m²/mm | Verbruik per m² per mm? |
| Egaline zakinhoud | 25 kg | Kg per ingekochte zak? |

(De gordijn-**plooifactor** wordt per gordijn ingevoerd door de inmeter — geen globale default nodig, tenzij
jullie een standaard willen.)

---

## D. Architectuur-beslissing: wat met `calculatorRules`?

De tabel is volledig **dood** (51 regels, nergens gelezen) en op punten zelfs **inconsistent** met de live
`wasteProfiles` (calculatorRules zegt PVC 7%/behang 15%; wasteProfiles — die wél telt — zegt PVC 3%/behang 10%).
Keuze (niet pilot-blokkerend):
- **Aanbevolen:** laten staan tot na de pilot, dan **droppen** (of bewust wiren als jullie de richtprijs
  later marge-delers/opslagen uit één tabel willen laten halen). Tot die tijd misleidt 'ie alleen in audits.
- De test `tests/calculatorRulesSeed.test.ts` die "18 placeholders" vergrendelt, vervalt dan mee.

## Samenvatting voor de pilot

Geen €0-arbeid-probleem. Te doen: Wim/Simone **A** (19 serviceCostRules-tarieven) + **B** (7 snijverlies-%'s)
**verifiëren** (waarden bestaan al), en **C** (4 gordijn-/egaline-defaults) bevestigen. Dat is de hele
business-bevestiging — veel kleiner dan de oorspronkelijke "18 placeholders".
