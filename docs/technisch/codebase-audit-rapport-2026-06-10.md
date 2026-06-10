# Codebase Audit Rapport - Henke Wonen Portal

Datum: 10 juni 2026  
Auteur: Antigravity Code Auditor  
Doel: Grondige code-analyse en verificatie van de gehele applicatie voor pilot-start  

---

## 1. Runtime, Stack & Baseline

De applicatie is gebouwd met een moderne, high-performance stack die server-side rendering (SSR) combineert met reactieve client componenten en een serverless backend:

* **Frontend Framework**: Astro v6.1.10 (`output: "server"` voor dynamische routing en middleware-validatie).
* **React Islands**: React v19.2.5 voor de interactieve werkplekken (winkel & buitendienst).
* **Database & Serverless Logic**: Convex v1.39.1.
* **Styling**: Tailwind CSS v4.3.0 in `src/styles/global.css`.
* **Runtime Constraint**: Node.js 24.x (npm 11.x), strikt gehandhaafd via `.npmrc` (`engine-strict=true`).
* **Kwaliteit-Baseline**: Type-safe (`npm run check` is 100% foutloos) en een brede testdekking met Vitest.

---

## 2. Relational Database Schema Analyse

Het Convex-schema (`convex/schema.ts`) definieert 30 tabellen met een strikte multi-tenant isolatie. Tenantgebonden publieke queries en mutaties valideren actor-token, tenantlidmaatschap en rol via `convex/authz.ts`. De belangrijkste entiteitgroepen zijn:

- **`tenants` & `users`**: Bepalen de tenant-toegang en rollen (`viewer`, `user`, `editor`, `admin`).
- **`customers` & `customerContacts`**: Klantinformatie met dossieropbouw. `customerContacts` bevat tevens `loanedItemName` en `expectedReturnDate` voor de sample-uitleenmodule.
- **`projects` & `projectRooms`**: De werkdossiers. Statusovergangen bepalen de workflow-fase.
- **`measurements` & `measurementRooms`**: Inmetingen op locatie. Bevatten berekeningsparameters (zoals snijverlies) en meetwaarden, maar bewust geen prijzen.
- **`quotes` & `quoteLines`**: De prijsopgaven, gekoppeld aan catalogusproducten of vaste service-tarieven (`serviceCostRules`).
- **`invoices` & `projectTasks`**: Facturen en procesopvolgingstaken.

---

## 3. Beveiliging, Autorisatie & Isolatie (`convex/authz.ts`)

Convex gebruikt een JWT-achtig cryptografisch tokensysteem (`authzToken`) om tenant-isolatie en rolbeveiliging af te dwingen in een stateless serverless omgeving.

### Token Verificatie en Cryptografie
* **HMAC SHA-256 Handtekening**: Tokens worden door de Astro-server ondertekend met `AUTHZ_TOKEN_SECRET`. De signature-verificatie in Convex gebruikt een timing-safe vergelijking (`timingSafeEqual`) om side-channel timing-attacks te voorkomen:
  ```typescript
  function timingSafeEqual(left: string, right: string) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }
  ```
* **Developer Bypass**: In lokale dev-omgevingen zonder geconfigureerd geheim kan via `ALLOW_DEV_AUTHZ_TOKENS=true` een bypass-token (`dev.actor.<tenantSlug>.<userId>`) worden gebruikt.
* **Tenant- & Rol-Guards**: Bij elke mutation controleert `requireMutationRole` of de gebruiker behoort tot de opgegeven tenant en of zijn rol (bijv. `editor`, `admin`) de mutatie mag uitvoeren.

---

## 4. Inmeet-Calculators & Formules (`src/lib/calculators/`)

De inmeetmodule gebruikt vijf specialistische calculators die netto metingen omzetten in bruto hoeveelheden voor de offerte:

1. **Flooring Calculator (`flooringCalculator.ts`)**
   * Berekent netto oppervlakte uit lengte en breedte ($A = L \times W$).
   * Voegt snijverlies toe: $\text{Totaal } m^2 = A \times (1 + \frac{\text{wastePercent}}{100})$.
2. **Plinth Calculator (`plinthCalculator.ts`)**
   * Berekent netto omtrek minus deuropeningen.
   * Voegt plint-snijverlies toe: $\text{Totaal meter} = (\text{perimeter} - \text{doorOpenings}) \times (1 + \frac{\text{wastePercent}}{100})$.
3. **Wall Panel Calculator (`wallPanelCalculator.ts`)**
   * Berekent panelen op basis van wandbreedte en paneelbreedte: $\text{banen} = \lceil \frac{\text{wallWidth}}{\text{panelWidth}} \rceil$.
   * Houdt rekening met de hoogte-compatibiliteit (paneel moet hoger zijn dan de wand).
   * Voegt panelen-snijverlies toe.
4. **Stair Calculator (`stairCalculator.ts`)**
   * Registreert traptype (open/dicht), treden en stootborden voor renovaties.
5. **Wallpaper Calculator (`wallpaperCalculator.ts`)**
   * Berekent benodigde banen: $\text{banen} = \lceil \frac{\text{wallWidth} \times 100}{\text{rollWidth}} \rceil$.
   * Corrigeert baanlengte voor het patroonrapport: $\text{baanlengte} = \text{wallHeight} + \frac{\text{patternRepeat}}{100}$.
   * Banen per rol: $\lfloor \frac{\text{rollLength}}{\text{baanlengte}} \rfloor$.
   * Totaal rollen met snijverlies: $\lceil \text{baseRolls} \times (1 + \frac{\text{wastePercent}}{100}) \rceil$.

---

## 5. Catalogus Import & Custom Branding Rules

De catalogus-importstraat bevat een Python-auditfase en een Convex staging-fase (`productImportBatches` en `productImportRows`). Er zijn drie kritieke guardrails en een set rebranding-regels actief:

### Guardrails
* **Btw-mapping Blokkade**: Prijskolommen met een btw-status `unknown` blokkeren de catalogus-import naar productie. Beheerders moeten dit in de portal expliciet beoordelen (`inclusive` of `exclusive`).
* **EAN-Dubbeling Beoordeling**: Dubbele EAN-nummers worden gemarkeerd als datakwaliteitswaarschuwingen, maar **nooit** automatisch samengevoegd om dataverlies of merkclashes te voorkomen.
* **PVC-Click Filter**: Producten die tot de categorie of het type `pvc-click` behoren, worden tijdens de import automatisch overgeslagen (`ignored`).

### Weergave- en Rebranding-regels (`convex/catalog/pilot.ts`)
Om de presentatie voor de pilotgebruikers overzichtelijk te houden, voert de database-laag automatische transformaties uit bij het opvragen van producten:
1. **Moduleo / Roots Rebranding**: De leverancier **Roots** en productnamen met "Roots" of "MOD ROOTS" worden automatisch hernoemd naar **Moduleo**:
   ```typescript
   export function displaySupplierName(supplierName: string) {
     return supplierName.toLowerCase() === "roots" ? "Moduleo" : supplierName;
   }
   ```
2. **Floorlife PVC Selectie**: PVC-producten die een commerciële merknaam van **Floorlife** hebben, gebruiken automatisch deze merknaam als primaire weergavenaam.
3. **Ambiant Filtering**: Bij PVC-producten worden commerciële namen onder het merk **Ambiant** weggefilterd om dubbele merkaanduidingen op de winkelvloer te voorkomen.
4. **Productverberging**: Producten van het type `click` of in de categorie `pvc click` worden in de pilot-catalogus verborgen.

---

## 6. Task Automation & Workflow Statusmachine (`convex/offertes/core.ts`)

Wanneer de status van een offerte wijzigt in `updateQuoteStatus`, voert de database-laag automatisch gerelateerde workflow-acties en statusovergangen uit op het projectniveau:

* **Bij status `sent`**: 
  * Maakt project-event `quote_sent`.
  * Maakt een opvolgingstaak aan voor de verkoper ("Offerte opvolgen") met een deadline van +18 dagen.
* **Bij status `accepted`**:
  * Annuleert automatisch alle andere concept- en verzonden offertes van dit project (wijzigt status naar `cancelled`).
  * Wijzigt projectstatus naar `quote_accepted`.
  * Sluit openstaande opvolgingstaken als `done`.
  * Maakt twee nieuwe taken aan met een deadline van 5 dagen:
    1. "Bevestigingsmail / betaling binnen 5 dagen" (aanbetalingscontrole).
    2. "Bellen / afspraak maken voor uitvoering" (planning buitendienst).

---

## 7. Pilot Reset-Mechanisme (`clearTenantData.ts`)

De portal bevat een admin-mutatie `clearTenantData` om testdata veilig te verwijderen voor de start van de pilot:
* **Wat wordt bewaard**: Catalogus, leveranciers, importprofielen, categorieën, offertesjablonen en btw-mappings.
* **Wat wordt verwijderd**: Klanten, contacten, projecten, inmetingen, offertes, facturen, taken en bestellingen.
* **Veiligheidscontroles**:
  1. Vereist de Convex-omgevingsvariabele `ALLOW_CONVEX_TOOLING=true`.
  2. Vereist de exacte string `"JA_VERWIJDER_TESTDATA"` als `confirmPhrase` argument om accidentele uitvoering te blokkeren.

---

## 8. Audit-Conclusie & Aanbevelingen

De codebase is **uitzonderlijk goed gestructureerd, beveiligd en type-safe**. Er zijn geen openstaande linting-fouten en de tests slagen. 

### Belangrijke aandachtspunten voor de pilot-start:
1. **Productie-omgevingsvariabelen**: Zorg ervoor dat `ALLOW_DEV_AUTHZ_TOKENS` op `false` staat in productie (Vercel/Convex) om token-spoofing te voorkomen.
2. **Convex Tooling**: Zorg ervoor dat `ALLOW_CONVEX_TOOLING` alleen op `true` staat op het moment dat de testdata definitief wordt gewist met `clearTenantData`, en daarna weer wordt uitgeschakeld.
3. **Roots/Moduleo branding**: Houd er rekening mee dat Roots-producten onder de naam Moduleo in de portal staan. Dit is correct geïmplementeerd in de database-laag.
