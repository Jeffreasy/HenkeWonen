# Calculator-bedrijfsregels — te bevestigen met Wim/Simone (2026-06-24)

> **Doel:** de 18 reken-aannames die nu als *placeholder* in de calculators staan, laten bevestigen of
> corrigeren door de praktijk (Wim/Simone). Deze waarden voeden **de richtprijs én de inmeet-hoeveelheden**.
> Bron: `convex/catalog/calculatorRulesSeed.ts` (de 18 regels met `vereistKlantInput: true`, vergrendeld
> door `tests/calculatorRulesSeed.test.ts`). De overige 33 regels komen uit echte prijslijst-formules en
> zijn géén aanname.

## ⚠️ Belangrijkste beslissing eerst: arbeid staat nu op €0

**Alle 7 arbeids-/confectie-opslagen staan op 0.** Dat betekent dat de richtprijs nu **alleen materiaal**
rekent — leg-, plak-, montage- en confectiekosten zitten er niet in. Voor een eerlijke richtprijs tijdens
de pilot is dit het grootste blok om in te vullen (regels 2, 4, 6, 10, 12, 14, 18 hieronder).

> Spelregel die overeind blijft: de inmeting/richtprijs is *indicatief*; de **offerte** blijft de plek waar
> de prijs definitief wordt gezet. Maar de **hoeveelheden** (snijverlies, verbruik, gordijngeometrie) tellen
> wél echt mee, dus die aannames hebben directe impact.

## De 18 te bevestigen waarden

| # | Regel (productgroep · soort) | Wat het bepaalt | Huidige aanname | Te bevestigen waarde |
|---|------------------------------|-----------------|-----------------|----------------------|
| 1 | PVC-vloer · snijverlies | Extra m² materiaal bovenop netto vloeroppervlak | 7% | Welk % snijverlies bij PVC? Afhankelijk van legpatroon? |
| 2 | PVC-vloer · arbeidsopslag | Legkosten bovenop materiaalprijs | **0 (geen arbeid)** | Legkosten PVC: bedrag/m² of %? |
| 3 | Vinyl · snijverlies | Extra m² op rolbreedte | 7% | Welk % snijverlies bij vinyl op rol? |
| 4 | Vinyl · arbeidsopslag | Legkosten bovenop materiaalprijs | **0 (geen arbeid)** | Legkosten vinyl: bedrag/m² of %? |
| 5 | Tapijt · snijverlies | Extra m² op rolbreedte (incl. looprichting) | 10% | Klopt 10% voor tapijt? |
| 6 | Tapijt · arbeidsopslag | Legkosten bovenop materiaalprijs | **0 (geen arbeid)** | Legkosten tapijt: bedrag/m² of %? |
| 7 | Schoonloopmat · snijverlies | Extra m² bij maatwerk-coupage | 5% | Klopt 5% voor matten op maat? |
| 8 | Egaliseren · verbruik | Kg egaline per m² per mm laagdikte | 1,5 kg/m²/mm | Verbruik per m² per mm — merkafhankelijk? |
| 9 | Egaliseren · zakgewicht | Kg per zak → aantal zakken | 25 kg/zak | Hoeveel kg per ingekochte zak egaline? |
| 10 | Egaliseren · arbeidsopslag | Arbeidskosten egaliseren | **0 (geen arbeid)** | Kosten egaliseren: bedrag/m² of %? |
| 11 | Behang · snijverlies | Extra banen incl. patroon-uitlijning | 15% | Klopt 15%? Afhankelijk van rapporthoogte? |
| 12 | Behang · arbeidsopslag | Plak-/behangarbeid | **0 (geen arbeid)** | Plakkosten behang: per rol/m² of %? |
| 13 | Wandpanelen · snijverlies | Extra panelen/m² incl. zaagverlies | 5% | Klopt 5% zaagverlies? |
| 14 | Wandpanelen · arbeidsopslag | Montage-arbeid | **0 (geen arbeid)** | Montagekosten: per m²/paneel of %? |
| 15 | Gordijnen · plooifactor | Stofbreedte = railbreedte × factor | 2× | Standaard plooifactor? Per plooisoort anders? |
| 16 | Gordijnen · zoom boven+onder | Extra stoflengte voor zomen | 30 cm totaal | Hoeveel cm zoom boven + onder samen? |
| 17 | Gordijnen · zijzoom | Extra stofbreedte per baan | 6 cm per baan | Hoeveel cm zijzoom (per baan)? |
| 18 | Gordijnen · confectie | Maakkosten per gordijn/baan/meter | **0 (geen confectie)** | Confectiekosten: per gordijn/baan/m rail? |

## Na bevestiging

Lever de bevestigde getallen aan; dan is het een kleine, mechanische update: de waarden in
`convex/catalog/calculatorRulesSeed.ts` aanpassen (en de test-verwachtingen waar nodig), `seedCalculatorRules`
opnieuw draaien op dev → daarna prod (zelfde idempotente seed als 24 jun, `inserted:0/updated:51`).
Géén schema- of codewijziging nodig — alleen data.
