# Inmeetmodule samenvatting

## Doel

De inmeetmodule helpt Henke Wonen om per project ruimtes, maten, snijverlies en hoeveelheden vast te leggen. De uitkomst kan later als voorstel naar een offerte worden geladen.

Belangrijk: de inmeetmodule bepaalt geen product, prijs, btw of offertetotaal.

## Huidige flow

1. Project openen.
2. Sectie/tab `Inmeting` openen.
3. Inmeting starten of bestaande inmeting bekijken.
4. Meetruimtes toevoegen of projectruimtes als basis gebruiken.
5. Rekenhulpen gebruiken voor vloer, plinten, behang, wandpanelen, trap of handmatige meetregels.
6. Meetregel opslaan.
7. Meetregel klaarzetten voor offerte.
8. In de offertebuilder kiezen voor `Uit inmeting laden`.
9. Meetregel selecteren en bevestigen.
10. De offertepost controleren op product, prijs en btw.

## Datamodel

| Entiteit | Functie |
| --- | --- |
| `measurements` | Inmeting per project |
| `measurementRooms` | Snapshot van meetruimtes binnen een inmeting |
| `measurementLines` | Berekening/hoeveelheid per productgroep |
| `wasteProfiles` | Standaard snijverliesprofielen per productgroep |

## Calculators

Pure utilities staan in `src/lib/calculators`.

| Calculator | Uitkomst |
| --- | --- |
| Vloer | m2 inclusief snijverlies |
| Plinten | meters inclusief snijverlies |
| Behang | rollen, indicatief |
| Wandpanelen | panelen/stuks |
| Trap | aantallen/omschrijving |

## Offertekoppeling

Meetregels met status `Klaar voor offerte` kunnen handmatig worden geladen in de offertebuilder. Er is altijd bevestiging nodig. Daarna wordt de meetregel als verwerkt gemarkeerd.

## Guardrails

- Geen automatische offertepost zonder bevestiging.
- Geen automatische prijskeuze.
- Geen automatische productkeuze.
- Geen automatische btw-keuze.
- Offertetotalen blijven via de bestaande offertebuilder lopen.

## Brondocumenten

- [Inmeetmodule faseverslagen](../implementation/inmeetmodule/README.md)
- [Workflowhandleiding voor gebruikers](../klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md)

