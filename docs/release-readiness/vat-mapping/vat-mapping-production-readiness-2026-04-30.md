# Btw-mapping production readiness - 2026-04-30

## Samenvatting

De Henke Wonen productie-import blijft terecht **GEBLOKKEERD**.

Er zijn 55 prijskolom-mappings in de actieve importprofielen. Daarvan is 1 mapping opgelost en blijven 54 mappings open. Er zijn geen open mappings gevonden waarbij de bronkolom expliciet `incl. btw` of `excl. btw` noemt. Daarom zijn er geen automatische btw-beslissingen toegepast.

Dit is de juiste uitkomst: de importstraat is technisch gezond, maar de zakelijke btw-keuzes moeten nog door Henke Wonen/leveranciers bevestigd worden voordat productie-import zonder dev override mag draaien.

## Beginstand

| Controlepunt | Waarde |
| --- | ---: |
| Importprofielen actief | 16 |
| Btw-mappings totaal | 55 |
| Btw-mappings opgelost | 1 |
| Btw-mappings open | 54 |
| Onbekende btw-modus toegestaan | 0 |
| Productie-importstatus | BLOCKED |
| Open dubbele EAN-waarschuwingen | 25 |
| Productregels in preview | 10.291 |
| Voorvertonings-/auditregels | 10.691 |
| Prijsregels in preview | 13.015 |
| Prijsregels met onbekende btw-modus | 12.984 |

## Automatische beslissingen

Geen automatische beslissingen toegepast.

Reden:

- Alleen bronkolommen met expliciete `incl. btw`, `incl btw`, `inclusief btw`, `excl. btw`, `excl btw` of `exclusief btw` mogen automatisch gezet worden.
- De enige expliciete kolom, `Adviesverkoopprijs incl. BTW. per verpakking`, stond al op `inclusive`.
- Alle overige open kolommen missen expliciete btw-aanduiding en blijven menselijke beslispunten.

## Menselijke beslissingen

De volledige beslistabel staat in:

- `docs/vat-mapping-human-decision-table-2026-04-30.md`

Gebruik die tabel om per prijskolom een zakelijke keuze vast te leggen:

- `inclusive`
- `exclusive`
- `terugvragen aan leverancier`

Voorbeelden van open keuzes:

- Advies-/consumer prices: voorstel vaak `inclusive`, confidence `medium`, omdat Henke Wonen klantgericht inclusief btw offert maar de bronkolom dit niet expliciet noemt.
- Inkoop/netto/commissie/pallet/trailer: voorstel vaak `exclusive`, confidence `medium` of `low`, omdat dit leveranciers-/inkoopcontext is maar zonder expliciete bronbevestiging.
- Roll/coupage/package/step: blijft `unknown` of lage confidence totdat duidelijk is of het verkoop- of inkoopcontext is.

## Apply-script

Toegevoegd:

- `tools/apply_vat_mapping_decisions.mjs`
- `docs/vat-mapping-decisions.json`

Het beslisbestand is bewust leeg aangemaakt:

```json
[]
```

Vul het alleen met expliciete beslissingen, bijvoorbeeld:

```json
[
  {
    "importProfileId": "profiel-id",
    "sourceColumnIndex": 4,
    "sourceColumnName": "Adviesverkoopprijs EUR m2",
    "vatMode": "inclusive",
    "reviewed": true,
    "reviewNote": "Bevestigd met klant: adviesverkoopprijzen zijn inclusief btw."
  }
]
```

Gebruik:

```bash
node tools/apply_vat_mapping_decisions.mjs
node tools/apply_vat_mapping_decisions.mjs --apply
```

Het script is standaard dry-run. `unknown` wordt alleen geaccepteerd met `explicitAllowUnknown=true`.

## Toegepaste mappings

| Type | Aantal |
| --- | ---: |
| Automatisch toegepast | 0 |
| Handmatig toegepast | 0 |
| Dry-run beslissingen | 0 |
| Mislukte beslissingen | 0 |
| Open na apply | 54 |

Zie ook:

- `docs/vat-mapping-apply-result-2026-04-30.md`

## Guardrailcontrole

`npm run catalog:import` zonder dev override is uitgevoerd en faalt correct vóórdat er importdata wordt verwerkt:

```txt
This import contains unresolved vatMode mappings (54 profile columns).
Set profile price columns to inclusive/exclusive or explicitly allow unknown per profile.
```

Er is een kleine veiligheidsfix gedaan in:

- `tools/upload_catalog_batch_import.mjs`

De productie-import controleert nu eerst de bestaande Convex-btw-guardrail. Daardoor faalt de import duidelijk op de 54 open btw-mappings, ook als het optionele full-previewbestand niet aanwezig is.

## Regressiechecks

| Check | Resultaat |
| --- | --- |
| `npm run check` | OK |
| `npm run build` | OK |
| `npm run catalog:preview` | OK |
| `npm run test:portal` | OK |
| `npm run test:a11y` | OK |
| `npm run catalog:import` zonder override | Correct geblokkeerd |

Build-opmerking:

- De lokale Node.js versie is 25. Vercel Serverless Functions gebruiken lokaal Node.js 24 als runtime. Build blijft succesvol.

## Catalogusbaseline

Er is geen productie-import uitgevoerd en er zijn geen catalogusproducten of prijsregels gemuteerd.

Convex-audit na de btw-review:

| Controlepunt | Waarde |
| --- | ---: |
| Actieve producten | 7.775 |
| Prijsregels | 13.015 |
| Producten zonder prijsregels | 0 |
| Losse prijsregels zonder product | 0 |
| Dubbele product-importkeys | 0 |
| Dubbele prijs-sourceKeys | 0 |
| Prijsregels met bedrag <= 0 | 0 |
| Sectierijen als product | 0 |
| Prijsregels met onbekende btw-modus | 12.984 |
| Dubbele supplier+EAN groepen | 25 |

Opmerking:

- De Convex audit leest veel data en geeft een waarschuwing over veel gelezen bytes, maar blijft binnen de limiet en retourneert bovenstaande gezonde baseline.

## Productiestatus

Status: **NIET READY, correct geblokkeerd**.

Reden:

- 54 btw-mappings missen nog een expliciete zakelijke beslissing.
- `allowUnknownVatMode` staat op 0, zoals gewenst.
- De productie-import zonder override weigert terecht.

## Vervolg

1. Vul `docs/vat-mapping-decisions.json` met de bevestigde keuzes.
2. Draai `node tools/apply_vat_mapping_decisions.mjs` als dry-run.
3. Draai `node tools/apply_vat_mapping_decisions.mjs --apply`.
4. Controleer dat unresolved mappings 0 zijn.
5. Draai daarna pas `npm run catalog:import` zonder dev override.

Duplicate-EAN waarschuwingen blijven review-only en blokkeren productie-import niet.
