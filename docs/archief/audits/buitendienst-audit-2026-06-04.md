# Auditrapport Buitendienst-module (Henke Wonen Portal)
**Datum:** 4 juni 2026  
**Auditor:** Antigravity AI Coding Assistant  
**Status:** Definitief  
**Scope:** Frontend (Astro pages & React Workspace islands), Layout, Styling (global.css) en Convex Backend API's (`portal.ts`, `measurements.ts`, `quotes.ts`).

---

## 📌 Executive Summary

De **Buitendienst-module** van de Henke Wonen Portal is ontworpen om buitendienstmedewerkers op locatie (mobiel of tablet) te ondersteunen bij inmetingen en het opstellen van conceptoffertes (Klantversies). 

Tijdens deze audit zijn de codekwaliteit, de UI/UX-interactie, de mobiele bruikbaarheid, de toegankelijkheid (a11y), en de backend-beveiliging en -schaalbaarheid grondig geanalyseerd.

### Belangrijkste Conclusies:
1. **Beveiligingsrisico (Kritiek):** Convex-queries (`fieldServiceWorkspace`, `fieldProjectWorkspace`, `getForProject`) controleren momenteel geen gebruikerstokens (`authzToken`). Iedereen met kennis van de Convex-URL en de tenant-slug kan alle klant-, project- en inmeetgegevens uitlezen. De mutations zijn daarentegen wél waterdicht beveiligd.
2. **Performance Bottleneck (Hoog):** De query `fieldServiceWorkspace` haalt bij elke aanroep *alle* historische klanten, projecten, quotes en inmetingen van de tenant op via `.collect()` en filtert ze in het geheugen. Dit zal bij schaling leiden tot timeouts of geheugenuitputting.
3. **UX Navigatie-val (Medium):** Wanneer een gebruiker zich in een projectkaart bevindt, veranderen de hoofdnavigatielinks "Inmeten" en "Conceptoffertes" in paginahashes (`#inmeten`, `#conceptofferte`). Dit blokkeert de primaire manier om terug te keren naar de globale dossierlijsten en dwingt de gebruiker om een secundaire, conditionele link te zoeken.
4. **Toegankelijkheid & Interactie (Laag):** Enkele ARIA-attributen (zoals `aria-expanded` in het mobiele menu) zijn statisch hardcoded, en er ontbreekt een focus-trap voor het mobiele menu-drawer.

---

## 📁 1. Code- & Architectuuranalyse (Fase 1)

### React componenten
*   **[FieldServiceWorkspace.tsx](file:///c:/Users/JJALa/Desktop/2026Developer/HenkeWonen/src/components/field/FieldServiceWorkspace.tsx):**
    *   *Rol:* Het centrale startpunt voor de werkdag. Handelt de categorisatie af ("Vandaag", "Inmeten", "Conceptoffertes", "Opvolgen") en het aanmaken van nieuwe klanten/leads onderweg.
    *   *Structuur:* Goed opgebouwd met `useMemo` voor pre-filtering en `useCallback` voor API-aanroepen. De form-state voor klantintake is modulair opgezet en herstelt netjes na succesvolle commits.
*   **[FieldProjectWorkspace.tsx](file:///c:/Users/JJALa/Desktop/2026Developer/HenkeWonen/src/components/field/FieldProjectWorkspace.tsx):**
    *   *Rol:* De gedetailleerde projectkaart voor inmeten en offerteopbouw op locatie.
    *   *Structuur:* Integreert de `MeasurementPanel` en `QuoteBuilder` componenten naadloos. Statusovergangen en acties worden via callbacks correct teruggekoppeld naar de backend en de lokale state wordt ververst.

### Backend-koppelingen & Integratie
De frontend praat met de backend via de `ConvexHttpClient`. Mutations sturen correct een `actor`-object mee met een cryptografisch getekend `authzToken` (HMAC SHA-256) gegenereerd door de Astro-middleware.
Queries (`fieldServiceWorkspace`, `fieldProjectWorkspace`) ontvangen echter geen token en valideren alleen op basis van de `tenantSlug` of `tenantId`.

---

## 🎨 2. UI/UX & Design-system Evaluatie (Fase 2)

### De Navigatie-val (UX Trap)
In [FieldNavigation.tsx](file:///c:/Users/JJALa/Desktop/2026Developer/HenkeWonen/src/components/layout/FieldNavigation.tsx) is de volgende logica aanwezig voor de links "Inmeten" en "Conceptoffertes":
```typescript
function workdayHref(pathname: string, pagePath: string, projectHash: string) {
  return isProjectPath(pathname) ? projectHash : pagePath;
}
```
*   **Probleem:** Als de gebruiker op `/portal/buitendienst/projecten/[id]` is, verwijzen deze hoofdnavigatielinks naar `#inmeten` en `#conceptofferte`. De gebruiker klikt op de knop om naar de lijst met inmetingen te gaan, maar de pagina scrollt alleen naar beneden op de huidige projectkaart. Terugkeren naar het dossieroverzicht kan alleen via de secundaire link "Dossiers" die onder een aparte groep "Klantbezoek" verschijnt. Dit is contra-intuïtief.
*   **Aanbeveling:** Laat de hoofdnavigatielinks altijd globaal blijven (`/portal/buitendienst/inmeten` en `/portal/buitendienst/conceptoffertes`). Voeg de in-page hashes uitsluitend toe als secundaire tab- of actieknoppen binnen de projectkaart zelf, niet in het hoofdmenu.

### Responsive Gedrag & Mobiele Optimalisatie
*   **Breakpoints:** De module maakt gebruik van een `@media (max-width: 980px)` breakpoint in [global.css](file:///c:/Users/JJALa/Desktop/2026Developer/HenkeWonen/src/styles/global.css) om over te schakelen naar mobiele weergave.
*   **Mobiele Quickbar:** Op schermen kleiner dan 980px wordt onderaan een fixed `.field-quickbar` getoond. Dit zorgt voor een duim-vriendelijke interactie op smartphones.
*   **Layout Shifts:** Kaarten en formulieren passen zich vloeiend aan (omslag van CSS grids naar single-column layout). Hover-states maken gebruik van vloeiende transities (150-180ms) zonder layout-shifts.

### Toegankelijkheid (a11y)
*   **Menu Drawer:** De mobiele sidebar close-knop (`.field-sidebar-close`) en de overlay (`.field-mobile-overlay`) zijn functioneel.
*   **Knelpunt 1 (Aria-expanded):** De mobiele menu-knop heeft een statisch attribuut `aria-expanded="false"`. Dit moet dynamisch worden gekoppeld aan de state: `aria-expanded={isMenuOpen ? "true" : "false"}`.
*   **Knelpunt 2 (Focus trap):** Wanneer de mobiele sidebar is geopend, kan de gebruiker via de `Tab`-toets nog steeds elementen op de achtergrond focusseren. Dit hindert gebruikers met een schermlezer of toetsenbordnavigatie.
*   **Contrast & Tekst:** Tekstkleuren voldoen ruimschoots aan de contrastrichtlijnen (contrast ratio $> 4.5:1$ met `--color-text` `#211f1c` op `--color-bg` `#f6f2ea`).

### Taal & Consistentie
De UI-copy is consequent in het Nederlands opgesteld. Statuslabels worden via [statusLabels.ts](file:///c:/Users/JJALa/Desktop/2026Developer/HenkeWonen/src/lib/i18n/statusLabels.ts) correct vertaald (bijv. `quote_draft` $\rightarrow$ "Offerteconcept", `measured` $\rightarrow$ "Ingemeten").

---

## 🔒 3. Beveiliging & Tenant-Isolatie (Fase 3)

### Query Toegang
*   **Risico:** Hoog.
*   **Analyse:** Convex-queries worden uitgevoerd via HTTP-requests vanuit de browser. Omdat queries geen actor-token ontvangen, controleert Convex niet of de aanvrager ingelogd is of behoort tot de tenant. Een kwaadwillende gebruiker kan via de developer console queries zoals `portal.fieldServiceWorkspace({ tenantSlug: "andere-tenant-slug" })` aanroepen en alle gegevens van die tenant uitlezen.
*   **Aanbeveling:** Breid de Convex-queries uit met een optioneel of verplicht token-argument en valideer dit met een read-only token-parser analoog aan mutations, of implementeer Convex's ingebouwde Auth-integratie voor queries.

### Mutation Toegang
*   **Status:** Veilig.
*   **Analyse:** Alle muterende operaties (zoals `createCustomer`, `createProject`, `createQuote`, `addQuoteLine`) verifiëren het `authzToken` server-side via `requireMutationRoleForTenantId`. Dit voorkomt manipulatie door andere tenants of ongeautoriseerde rollen.

---

## ⚡ 4. Performance & Schaalbaarheid

### In-memory collect in queries
*   **Risico:** Hoog (bij toenemende database-omvang).
*   **Analyse:** De query `fieldServiceWorkspace` voert de volgende database-operaties parallel uit:
    ```typescript
    ctx.db.query("customers").withIndex("by_tenant", ...).collect()
    ctx.db.query("projects").withIndex("by_tenant", ...).collect()
    ctx.db.query("quotes").withIndex("by_tenant", ...).collect()
    ctx.db.query("measurements").withIndex("by_status", ...).collect()
    ```
    Dit laadt de *volledige* geschiedenis van de tenant in het geheugen van de Convex-serverless functie. Zodra een tenant honderden of duizenden projecten/klanten heeft opgebouwd, zal deze query de geheugenlimiet overschrijden of een timeout veroorzaken.
*   **Aanbeveling:**
    1.  Voeg paginering toe aan de project- en klantqueries.
    2.  Filter actieve dossiers (zoals `lead` t/m `invoiced`) direct op database-niveau via specifieke indexen, in plaats van `.collect()` te gebruiken op alle records en daarna in JS te filteren.

---

## 🛠️ 5. Concrete Aanbevelingen & Verbeterplan

| Categorie | Omschrijving | Impact | Prioriteit | Oplossingsrichting |
| --- | --- | --- | --- | --- |
| **Beveiliging** | Toevoegen token-validatie aan queries. | Kritiek | Hoog | Breid `fieldServiceWorkspace` en `fieldProjectWorkspace` uit met een `actor` argument en valideer het `authzToken`. |
| **Performance** | Database-level filtering van projecten. | Hoog | Hoog | Maak een Convex index op `projects` die filtert op tenant en status, of voeg een limiet/paginering toe aan de queries. |
| **UI/UX** | Herstel navigatie-val in zijbalk. | Medium | Medium | Pas `FieldNavigation.tsx` aan zodat hoofdnavigatielinks altijd naar de globale overzichtspagina's linken. |
| **Toegankelijkheid** | Dynamische `aria-expanded` & focus trap. | Laag | Laag | Koppel `aria-expanded` aan `isMenuOpen` en integreer een focus-trap bibliotheek of React-hook in de mobiele drawer. |
