# Import btw-mapping review - 2026-04-29

## Samenvatting

Er zijn **55 prijskolommen** gevonden over **16 actieve importprofielen**. Daarvan zijn **1** expliciet gezet op inclusive/exclusive en **54** nog productieblokkerend omdat ze op unknown staan zonder profiel-override.

Voor Henke Wonen blijft de standaard **allowUnknownVatMode=false**. Definitieve productie-import zonder dev override mag pas slagen als alle rows hieronder inclusive/exclusive zijn of als een profiel bewust allowUnknownVatMode=true heeft.

## Heuristiek

- Kolommen met "incl. BTW", "incl btw" of "inclusief btw" krijgen suggestie **inclusive** met high confidence.
- Kolommen met "excl. BTW", "excl btw" of "exclusief btw" krijgen suggestie **exclusive** met high confidence.
- Inkoopprijzen, netto inkoop, palletprijzen, commissieprijzen en trailerprijzen blijven reviewplichtig zonder expliciete bronaanwijzing.
- Adviesverkoopprijzen worden alleen automatisch gezet als de bron of kolomnaam expliciet incl/excl vermeldt.

## Overzicht per importProfile en prijskolom

| Profiel | Supplier | Categorie | Bestandspatroon | Kolom | Index | PriceType | Unit | Huidig | Suggestie | Confidence | Review | Reden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Rolprijs EUR m1 | 0 | roll | m1 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Rolprijs EUR m2 | 1 | roll | m2 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Coupageprijs EUR m1 | 2 | cut_length | m1 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Coupageprijs EUR m2 | 3 | cut_length | m2 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Adviesverkoopprijs EUR m1 | 4 | advice_retail | m1 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Ambiant tapijt 2025 | Ambiant | Tapijt | *Ambiant*Tapijt*.xlsx | Adviesverkoopprijs EUR m2 | 5 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Rolprijs EUR m1 | 0 | roll | m1 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Rolprijs EUR m2 | 1 | roll | m2 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Coupageprijs EUR m1 | 2 | cut_length | m1 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Coupageprijs EUR m2 | 3 | cut_length | m2 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Adviesverkoopprijs EUR m1 | 4 | advice_retail | m1 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Ambiant vinyl 2024 | Ambiant | Vinyl | *Ambiant*Vinyl*.xlsx | Adviesverkoopprijs EUR m2 | 5 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Co-pro entreematten 2025 | Co-pro | Entreematten | *Entreematten*.xlsx | Coupageprijs | 0 | cut_length | m1 | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Co-pro entreematten 2025 | Co-pro | Entreematten | *Entreematten*.xlsx | Rolprijs | 1 | roll | roll | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Co-pro entreematten 2025 | Co-pro | Entreematten | *Entreematten*.xlsx | Adviesverkoopprijs per m1 /stuks | 2 | advice_retail | m1 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Co-pro entreematten 2025 | Co-pro | Entreematten | *Entreematten*.xlsx | Adviesverkoopprijs per m2 /stuks | 3 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Co-pro lijm kit egaline 2025 | Co-pro | Uit bron/sectie | *lijm*kit*egaline*.xlsx | Palletprijs / per verpakking | 0 | pallet | package | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro lijm kit egaline 2025 | Co-pro | Uit bron/sectie | *lijm*kit*egaline*.xlsx | Palletprijs / per stuk, kilo, liter | 1 | pallet | pallet | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro lijm kit egaline 2025 | Co-pro | Uit bron/sectie | *lijm*kit*egaline*.xlsx | commisieprijs / per verpakking | 2 | commission | package | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro lijm kit egaline 2025 | Co-pro | Uit bron/sectie | *lijm*kit*egaline*.xlsx | commisieprijs / per stuk, kilo, liter | 3 | commission | piece | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro lijm kit egaline 2025 | Co-pro | Uit bron/sectie | *lijm*kit*egaline*.xlsx | Adviesverkoopprijs incl. BTW. per verpakking | 4 | advice_retail | package | inclusive | inclusive | high | no | Kolomnaam noemt expliciet inclusief btw. |
| Co-pro plinten 2025 | Co-pro | Plinten | *Plinten*.xlsx | Palletprijs lengte (3,0) | 0 | pallet | meter | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro plinten 2025 | Co-pro | Plinten | *Plinten*.xlsx | Palletprijs (3,0) m1 | 1 | pallet | m1 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro plinten 2025 | Co-pro | Plinten | *Plinten*.xlsx | Commissieprijs lengte (2,7) | 2 | commission | meter | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro plinten 2025 | Co-pro | Plinten | *Plinten*.xlsx | Commissieprijs (2,7) m1 | 3 | commission | m1 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Co-pro plinten 2025 | Co-pro | Plinten | *Plinten*.xlsx | Adviesverkoopprijs lengte | 4 | advice_retail | meter | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Douchepanelen en tegels 2025 | Floorlife | Uit bron/sectie | *Douchepanelen*tegels*.xlsx | Inkoopprijs per stuk | 0 | purchase | piece | unknown | unknown | medium | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Douchepanelen en tegels 2025 | Floorlife | Uit bron/sectie | *Douchepanelen*tegels*.xlsx | Inkoopprijs per pallet | 1 | purchase | pallet | unknown | unknown | medium | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Douchepanelen en tegels 2025 | Floorlife | Uit bron/sectie | *Douchepanelen*tegels*.xlsx | Adviesverkoopprijs per pak | 2 | advice_retail | pack | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| EVC PVC click dryback | EVC | pvc | *EVC*click*dryback*.xlsx | Palletprijs EUR m2 | 0 | pallet | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| EVC PVC click dryback | EVC | pvc | *EVC*click*dryback*.xlsx | Commissieprijs EUR m2 | 1 | commission | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| EVC PVC click dryback | EVC | pvc | *EVC*click*dryback*.xlsx | Adviesverkoopprijs EUR m2 | 2 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Floorlife/Ambiant PVC 11-2025 | Floorlife | pvc | *PVC*11-2025*.xlsx | Palletprijs EUR m2 | 0 | pallet | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Floorlife/Ambiant PVC 11-2025 | Floorlife | pvc | *PVC*11-2025*.xlsx | Commissieprijs EUR m2 | 1 | commission | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Floorlife/Ambiant PVC 11-2025 | Floorlife | pvc | *PVC*11-2025*.xlsx | Trailerprijs | 2 | trailer | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Floorlife/Ambiant PVC 11-2025 | Floorlife | pvc | *PVC*11-2025*.xlsx | Adviesverkoopprijs EUR m2 | 3 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Headlam gordijnstoffen Complete Collectie 2026 | Headlam | Gordijnen | *Gordijnen*Headlam*.xlsx | Consumer Price | 0 | advice_retail | m1 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Interfloor legacy artikeloverzicht | Interfloor | Tapijt | *Interfloor*.xls | Adviesverkoop per m1 | 0 | advice_retail | m1 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| PVC palletcollectie 2025 | Floorlife | Palletcollectie PVC | *palletcollectie*.xlsx | inkoop op commissie | 0 | commission | pack | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| PVC palletcollectie 2025 | Floorlife | Palletcollectie PVC | *palletcollectie*.xlsx | Adviesverkoopprijs | 1 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Roots collectie NL 2026 | Roots | pvc | *Roots*2026*.xlsx | Adviesverkoopprijs vanaf 01/05/2026 | 0 | advice_retail | pack | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Roots collectie NL 2026 | Roots | pvc | *Roots*2026*.xlsx | Netto inkoop per pak | 1 | net_purchase | pack | unknown | unknown | medium | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Roots collectie NL 2026 | Roots | pvc | *Roots*2026*.xlsx | Adviesverkoopprijs / m2 vanaf 01/05/2026 | 2 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Traprenovatie Floorlife 2025 | Floorlife | Traprenovatie | *Traprenovatie*.xlsx | prijs per verpakkking | 0 | package | pack | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Traprenovatie Floorlife 2025 | Floorlife | Traprenovatie | *Traprenovatie*.xlsx | prijs per trede / stuk | 1 | step | step | unknown | unknown | low | yes | Geen expliciete btw-aanduiding in kolomnaam of profielmapping. |
| Traprenovatie Floorlife 2025 | Floorlife | Traprenovatie | *Traprenovatie*.xlsx | adviesverkoopprijs per verpakkking | 2 | advice_retail | pack | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Traprenovatie Floorlife 2025 | Floorlife | Traprenovatie | *Traprenovatie*.xlsx | adviesverkoopprijs per trede / stuk | 3 | advice_retail | step | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| vtwonen karpetten 2024 | vtwonen | Karpetten | *Karpetten*.xlsx | Inkoopprijs | 0 | purchase | piece | unknown | unknown | medium | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| vtwonen karpetten 2024 | vtwonen | Karpetten | *Karpetten*.xlsx | Adviesverkoopprijs | 1 | advice_retail | piece | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| vtwonen PVC click dryback | vtwonen | pvc | *vtwonen*pvc*.xlsx | Palletprijs EUR m2 | 0 | pallet | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| vtwonen PVC click dryback | vtwonen | pvc | *vtwonen*pvc*.xlsx | Commissieprijs EUR m2 | 1 | commission | m2 | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| vtwonen PVC click dryback | vtwonen | pvc | *vtwonen*pvc*.xlsx | Adviesverkoopprijs EUR m2 | 2 | advice_retail | m2 | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |
| Wandpanelen 2025 | Floorlife | Wandpanelen | *Wandpanelen*.xlsx | Inkoopprijs per stuk | 0 | purchase | piece | unknown | unknown | medium | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Wandpanelen 2025 | Floorlife | Wandpanelen | *Wandpanelen*.xlsx | Palletprijs per stuk | 1 | pallet | piece | unknown | unknown | low | yes | Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing. |
| Wandpanelen 2025 | Floorlife | Wandpanelen | *Wandpanelen*.xlsx | Adviesverkoopprijs per stuk | 2 | advice_retail | piece | unknown | unknown | low | yes | Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig. |

## Conclusie

Productie-import zonder dev override is **nog niet akkoord**: 54 prijskolommen hebben menselijke btw-mapping nodig.
