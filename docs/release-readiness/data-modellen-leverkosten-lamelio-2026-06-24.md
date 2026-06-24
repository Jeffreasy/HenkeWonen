# Datamodellen — tapijt-leverkosten + Lamelio-inkoopstaffel (2026-06-24)

> Twee "aparte interne regels" uit de [data-dive](./henkedata-deep-dive-2026-06-24.md) gemodelleerd als
> kant-en-klare definities. **Nog niet gewired/geseed** (bewust niet vlak vóór de pilot) — de JSON-blokken
> hieronder zijn direct omzetbaar naar seed-entries zodra je groen licht geeft. Beide zijn **intern/conditioneel**
> en mogen NIET in de klantzichtbare richtprijs lekken (`pricingRules.ts` sluit inkoop-/staffelprijzen al uit).

---

## A. Tapijt-leverkosten (Hebeta + Montinique) — klantkost, conditioneel

**Bron:** beide tapijt-PDF's, identieke staffel. Transport bij kleine orders + optionele tijdslevering-toeslag.
**Thuis:** `serviceCostRules` (`berekeningType: "fixed"`, ex btw 21%). Modelleer als **`status: "inactive"`**
(opt-in) zodat ze niet ongevraagd in de inmeet-picker verschijnen; de buitendienst/winkel kiest ze handmatig
op de offerte wanneer van toepassing. De *voorwaarde* (order < €200 / gekozen tijdvak) is niet auto-afdwingbaar
in de huidige flow → vastgelegd in `metadata` als documentatie + handmatige toepassing.

| Naam | berekeningType | prijsExBtw | Voorwaarde |
|---|---|---|---|
| Tapijt — transport (order < €200) | fixed | 21,80 | alleen als orderTotaalExBtw < 200 |
| Tapijt — tijdslevering vóór 08:00 | fixed | 85,00 | optioneel tijdvak |
| Tapijt — tijdslevering vóór 09:00 | fixed | 75,00 | optioneel tijdvak |
| Tapijt — tijdslevering vóór 10:00 | fixed | 65,00 | optioneel tijdvak |
| Tapijt — tijdslevering vóór 11:00 | fixed | 57,50 | optioneel tijdvak |
| Tapijt — tijdslevering vóór 12:00 (of 12:00–18:00) | fixed | 50,00 | optioneel tijdvak |

**Seed-klaar (drop-in voor `convex/seed/core.ts` `serviceCostRules`-array):**
```json
[
  {"name":"Tapijt transport (order < €200)","calculationType":"fixed","priceExVat":21.80,"vatRate":21,
   "status":"inactive","metadata":{"soort":"leverkosten","leverancier":["Hebeta","Montinique"],"voorwaarde":"orderTotaalExBtw < 200","bron":"Hebeta/Montinique tapijt 2026"}},
  {"name":"Tapijt tijdslevering vóór 08:00","calculationType":"fixed","priceExVat":85.00,"vatRate":21,"status":"inactive","metadata":{"soort":"tijdslevering","venster":"08:00"}},
  {"name":"Tapijt tijdslevering vóór 09:00","calculationType":"fixed","priceExVat":75.00,"vatRate":21,"status":"inactive","metadata":{"soort":"tijdslevering","venster":"09:00"}},
  {"name":"Tapijt tijdslevering vóór 10:00","calculationType":"fixed","priceExVat":65.00,"vatRate":21,"status":"inactive","metadata":{"soort":"tijdslevering","venster":"10:00"}},
  {"name":"Tapijt tijdslevering vóór 11:00","calculationType":"fixed","priceExVat":57.50,"vatRate":21,"status":"inactive","metadata":{"soort":"tijdslevering","venster":"11:00"}},
  {"name":"Tapijt tijdslevering vóór 12:00","calculationType":"fixed","priceExVat":50.00,"vatRate":21,"status":"inactive","metadata":{"soort":"tijdslevering","venster":"12:00-18:00"}}
]
```
> Bevestig met Wim/Simone of zij deze leverkosten **doorbelasten** aan de klant (en op welke leverancier ze
> van toepassing zijn). Pas dan op `status:"active"` zetten + her-seeden (idempotent, op `naam` per tenant).

---

## B. Lamelio inkoop-margestaffel — INTERN, niet klantzichtbaar

**Bron:** Lamelio Partner Gids 2024. Dit is Henke's **inkoopkorting** op basis van jaaromzet — dus marge-
controle, **geen verkoopprijs**. NIET als `priceItem`/`serviceCostRule` modelleren (zou in de richtprijs
lekken). Modelleer als losse **referentie** (margin-control), bv. een gitignore-vrij data-bestand of een
interne `inkoopMargeStaffel`-notitie. Gebruik: bepaal op welk niveau Henke inkoopt → ken de echte inkoopprijs
van wandpanelen → marge-bewaking op de adviesverkoopprijs (MSRP) die al in de catalogus staat.

| Niveau | Jaaromzet | Marge | OLMO-groep midden / strip | VASCO midden | INFINITY midden |
|---|---|---|---|---|---|
| ZILVER | €0–10k | 35% | 16,20 / 8,06 | 18,26 | 14,77 |
| GOUD | €10–25k | 40% | 14,88 / 7,44 | 16,86 | 13,64 |
| PLATINUM | >€25k | 45% | 13,64 / 6,82 | 15,45 | 12,50 |
| INVENTARIS-partner | — | 50% | 12,40 / 6,20 | 14,05 | — |

- **MSRP (adviesverkoop, = wat in de catalogus staat):** OLMO/MILO/ASTI/ONDA/AMBER midden €30 / strip €15; VASCO €34; INFINITY €27,50; KIT droog €12,50 / vochtig €14,50.
- **Min. order:** 15 dozen (OLMO/MILO/ASTI = 19 panelen/doos; VASCO = 14/doos).
- **Dropship/transport:** NL €50 / BE €95 per bestelling.

**Referentie-blok (intern, margin-control):**
```json
{
  "leverancier": "Lamelio",
  "type": "inkoop_marge_staffel",
  "klantzichtbaar": false,
  "bron": "Lamelio Partner Gids 2024",
  "staffels": [
    {"niveau":"ZILVER","omzetVan":0,"omzetTot":10000,"marge":0.35,"olmoMidden":16.20,"olmoStrip":8.06,"vascoMidden":18.26,"infinityMidden":14.77},
    {"niveau":"GOUD","omzetVan":10000,"omzetTot":25000,"marge":0.40,"olmoMidden":14.88,"olmoStrip":7.44,"vascoMidden":16.86,"infinityMidden":13.64},
    {"niveau":"PLATINUM","omzetVan":25000,"omzetTot":null,"marge":0.45,"olmoMidden":13.64,"olmoStrip":6.82,"vascoMidden":15.45,"infinityMidden":12.50},
    {"niveau":"INVENTARIS","omzetVan":null,"omzetTot":null,"marge":0.50,"olmoMidden":12.40,"olmoStrip":6.20,"vascoMidden":14.05}
  ],
  "msrp": {"olmoGroepMidden":30,"strip":15,"vasco":34,"infinity":27.50,"kitDroog":12.50,"kitVochtig":14.50},
  "minOrderDozen": 15,
  "panelenPerDoos": {"olmo_milo_asti":19,"vasco":14},
  "dropshipEx": {"NL":50,"BE":95}
}
```
> **Beslissing:** op welk niveau koopt Henke in? Dat bepaalt de echte wandpaneel-inkoopprijs en daarmee de
> marge op de MSRP. Houd dit los van de klant-richtprijs.

---

## Wiren/seeden — wanneer je het wilt activeren

- **A (tapijt-leverkosten):** zet de JSON om naar `serviceCostRules`-seed-entries → `npm run` seed op dev →
  na akkoord `status:"active"` → prod (idempotent, dedup op `naam`). Geen schema-wijziging nodig.
- **B (Lamelio-staffel):** géén klant-prijspad. Houd als intern referentie-bestand (margin-control) of, indien
  je de wandpaneel-**inkoopprijs** in het systeem wilt, importeer als `priceItems` met `prijssoort:"inkoop"`
  (die sluit `pricingRules.ts` al uit van de richtprijs). De adviesprijs (MSRP) staat al in de catalogus.

> Status: **gemodelleerd, niet gewired** (pre-pilot). Zeg het als je A wilt seeden of B als import wilt.
