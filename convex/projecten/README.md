# Inmeetmodule — `convex/projecten/`

Backend voor projectbeheer, inmeting (buitendienst) en de koppeling naar de offertebuilder.

## Bestanden

| Bestand | Functie |
| --- | --- |
| `core.ts` | Project CRUD, statusmachine, taken en opvolging |
| `measurements.ts` | Inmetingen, meetruimtes en meetregels |
| `fieldService.ts` | Buitendienstbezoeken en field-service queries |
| `workflowEvents.ts` | Audit trail van projectstatusovergangen |

## Inmeet-flow

```
Project openen
    ↓ Tab "Inmeting" openen
    ↓ Inmeting starten (core.ts: startOrPlanMeasurement / measurements.ts: createForProject)
    ↓ Meetruimtes toevoegen (measurementRooms)
    ↓ Calculator gebruiken → meetregel opslaan (measurementLines)
    ↓ Meetregel klaarzetten (status: ready_for_quote)
    ↓ In offertebuilder: "Uit inmeting laden"
    ↓ Bevestigen → offertepost aanmaken
    ↓ Meetregel gemarkeerd als converted
```

> [!IMPORTANT]
> De inmeetmodule bepaalt **nooit** een product, prijs, btw of offertetotaal.
> Alles wordt handmatig bevestigd in de offertebuilder.

## Datamodel

| Tabel | Functie |
| --- | --- |
| `measurements` | Inmeetbezoek per project (datum, status, uitvoerder) |
| `measurementRooms` | Gemeten ruimtes binnen een inmeting |
| `measurementLines` | Calculatieregel per productgroep (vloer, gordijn, etc.) |
| `wasteProfiles` | Standaard snijverliespercentages per productgroep |

## Calculators (frontend)

Pure utility-functies in [`src/lib/calculators/`](../../src/lib/calculators/):

| Calculator | Uitkomst |
| --- | --- |
| Vloer | m² inclusief snijverlies |
| Plinten | strekkende meter inclusief snijverlies |
| Behang | rollen, indicatief op basis van baanbreedte |
| Wandpanelen | panelen of stuks |
| Gordijnen | breedte × hoogte × plusfactor |
| Trap | aantallen per trede/zijkant |
| Tapijt/vinyl op rol (broadloom) | banen + lopende meters in de zuinigste legrichting, incl. snijverlies |
| Gordijnstof (curtain) | banen + baanlengte of gekantelde lopende meters stof |
| Egaliseren (screed) | benodigde kg → aantal zakken |
| Raambekleding-matrix | richtprijs via breedte × hoogte-matrix ("offerte op maat" buiten bereik) |

## Statusmachine meetregels

```
draft → ready_for_quote → converted
```

## Guardrails

- Geen automatische offertepost — altijd expliciete bevestiging nodig
- Geen automatische product-, prijs- of btw-keuze
- Offertetotalen lopen altijd via de offertebuilder (`convex/offertes/`)
- Dubbele conversie van een meetregel naar offerte is geblokkeerd

## Projectstatussen (volledig)

```
lead → quote_draft → quote_sent → quote_accepted → quote_rejected
     → measurement_planned → execution_planned → ordering
     → in_progress → invoiced → paid → closed | cancelled
```

Zie [`convex/projecten/workflowEvents.ts`](workflowEvents.ts) voor de event-log per overgang.
