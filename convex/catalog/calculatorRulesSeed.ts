// AUTO-GEGENEREERD uit HenkeWonenDATA/convex/calculatorSeed.ts. Niet handmatig bewerken.
// Marge-delers/opslagen uit de prijslijst-formules + placeholder-bedrijfsregels
// (snijverlies/arbeid/plooi/verbruik; vereistKlantInput=true -> bevestigen met Wim/Simone).
// regelSoort-waarden moeten overeenkomen met de calculatorRuleType-union in convex/schema.ts.
export type CalculatorRuleType =
  | "commission_divisor"
  | "pallet_divisor"
  | "trailer_divisor"
  | "coupage_divisor"
  | "roll_divisor"
  | "markup_factor"
  | "waste_pct"
  | "labor_surcharge"
  | "fullness"
  | "hem_cm"
  | "side_hem_cm"
  | "confectie_per_unit"
  | "consumption_kg_m2_mm"
  | "pack_kg"
  | "min_max"
  | "dependency";

export type CalculatorRuleSeed = {
  productToolSleutel: string;
  regelSoort: CalculatorRuleType;
  waarde: number | null;
  bronCel: string | null;
  notitie: string | null;
  vereistKlantInput: boolean;
};

export const calculatorRulesSeed: CalculatorRuleSeed[] = [
  {
    "productToolSleutel": "schoonloopmat",
    "regelSoort": "coupage_divisor",
    "waarde": 2.4,
    "bronCel": "/2.4",
    "notitie": "Co-pro Entreematten 2025.xlsx :: Ambiant Entreematten (kol I)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "schoonloopmat",
    "regelSoort": "roll_divisor",
    "waarde": 3,
    "bronCel": "/3",
    "notitie": "Co-pro Entreematten 2025.xlsx :: Ambiant Entreematten (kol J)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "schoonloopmat",
    "regelSoort": "markup_factor",
    "waarde": 1.3,
    "bronCel": "*1.3",
    "notitie": "Co-pro Entreematten 2025.xlsx :: Ambiant Entreematten (kol K)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "pallet_divisor",
    "waarde": 3.45,
    "bronCel": "$G$3",
    "notitie": "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx :: Blad1 (kol G)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "pallet_divisor",
    "waarde": 10,
    "bronCel": "/10",
    "notitie": "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx :: Blad1 (kol H)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "commission_divisor",
    "waarde": 3.2,
    "bronCel": "$J$3",
    "notitie": "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx :: Blad1 (kol J)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "commission_divisor",
    "waarde": 10,
    "bronCel": "/10",
    "notitie": "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx :: Blad1 (kol K)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "markup_factor",
    "waarde": 2.7,
    "bronCel": "*2.7",
    "notitie": "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx :: Blad1 (kol P)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "roll_divisor",
    "waarde": 2.6,
    "bronCel": "$H$4",
    "notitie": "Prijslijst Ambiant Tapijt 2025-04.xlsx :: Tapijt (kol H)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "roll_divisor",
    "waarde": 2.6,
    "bronCel": "$I$4",
    "notitie": "Prijslijst Ambiant Tapijt 2025-04.xlsx :: Tapijt (kol I)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "coupage_divisor",
    "waarde": 2.4,
    "bronCel": "$J$4",
    "notitie": "Prijslijst Ambiant Tapijt 2025-04.xlsx :: Tapijt (kol J)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "coupage_divisor",
    "waarde": 2.4,
    "bronCel": "$K$4",
    "notitie": "Prijslijst Ambiant Tapijt 2025-04.xlsx :: Tapijt (kol K)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "roll_divisor",
    "waarde": 2.6,
    "bronCel": "$F$4",
    "notitie": "Prijslijst Ambiant Vinyl 07-2024.xlsx :: Vinyl (kol F)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "roll_divisor",
    "waarde": 2.6,
    "bronCel": "$G$4",
    "notitie": "Prijslijst Ambiant Vinyl 07-2024.xlsx :: Vinyl (kol G)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "coupage_divisor",
    "waarde": 2.4,
    "bronCel": "$H$4",
    "notitie": "Prijslijst Ambiant Vinyl 07-2024.xlsx :: Vinyl (kol H)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "coupage_divisor",
    "waarde": 2.4,
    "bronCel": "$I$4",
    "notitie": "Prijslijst Ambiant Vinyl 07-2024.xlsx :: Vinyl (kol I)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "wandpanelen",
    "regelSoort": "pallet_divisor",
    "waarde": 2.4,
    "bronCel": "$I$3",
    "notitie": "Prijslijst Douchepanelen en tegels 2025-04.xlsx :: Blad1 (kol I)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 3.4,
    "bronCel": "$U$2",
    "notitie": "Prijslijst EVC 2025 click en dryback apart.xlsx :: Drbyack (kol U)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 3.2,
    "bronCel": "$V$2",
    "notitie": "Prijslijst EVC 2025 click en dryback apart.xlsx :: Drbyack (kol V)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 2.2,
    "bronCel": "$U$2",
    "notitie": "Prijslijst EVC 2025 click en dryback apart.xlsx :: Click (kol U)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 2,
    "bronCel": "$V$2",
    "notitie": "Prijslijst EVC 2025 click en dryback apart.xlsx :: Click (kol V)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 3.4,
    "bronCel": "$X$3",
    "notitie": "Prijslijst PVC 11-2025 click dryback apart.xlsx :: Floorlife PVC Dryback (kol X)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 3.2,
    "bronCel": "$Y$3",
    "notitie": "Prijslijst PVC 11-2025 click dryback apart.xlsx :: Floorlife PVC Dryback (kol Y)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 2.4,
    "bronCel": "$X$3",
    "notitie": "Prijslijst PVC 11-2025 click dryback apart.xlsx :: Floorlife PVC SRC (kol X)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 2.4,
    "bronCel": "$Y$3",
    "notitie": "Prijslijst PVC 11-2025 click dryback apart.xlsx :: Floorlife PVC SRC (kol Y)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 3.4,
    "bronCel": "$T$4",
    "notitie": "Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx :: Prijslijst - vtwonen PVC drybac (kol T)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 3.2,
    "bronCel": "$U$4",
    "notitie": "Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx :: Prijslijst - vtwonen PVC drybac (kol U)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 2.2,
    "bronCel": "$T$4",
    "notitie": "Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx :: Prijslijst - vtwonen PVC click (kol T)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 2,
    "bronCel": "$U$4",
    "notitie": "Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx :: Prijslijst - vtwonen PVC click (kol U)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "wandpanelen",
    "regelSoort": "pallet_divisor",
    "waarde": 2.4,
    "bronCel": "$L$3",
    "notitie": "Prijslijst Wandpanelen 2025-05.xlsx :: Blad1 (kol L)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 2.2,
    "bronCel": "$X$3",
    "notitie": "PVC 11-2025 click dryback apart floorlife.xlsx :: Floorlife PVC Dryback (kol X)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "commission_divisor",
    "waarde": 2,
    "bronCel": "$Y$3",
    "notitie": "PVC 11-2025 click dryback apart floorlife.xlsx :: Floorlife PVC Dryback (kol Y)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "pallet_divisor",
    "waarde": 2.93,
    "bronCel": "$X$3",
    "notitie": "PVC 11-2025 click dryback apart floorlife.xlsx :: Floorlife PVC SRC (kol X)",
    "vereistKlantInput": false
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "waste_pct",
    "waarde": 0.07,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "pvc_vloer",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "waste_pct",
    "waarde": 0.07,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "vinyl",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "waste_pct",
    "waarde": 0.1,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "tapijt",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "schoonloopmat",
    "regelSoort": "waste_pct",
    "waarde": 0.05,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "consumption_kg_m2_mm",
    "waarde": 1.5,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "pack_kg",
    "waarde": 25,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "egaliseren",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "behang",
    "regelSoort": "waste_pct",
    "waarde": 0.15,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "behang",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "wandpanelen",
    "regelSoort": "waste_pct",
    "waarde": 0.05,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "wandpanelen",
    "regelSoort": "labor_surcharge",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "gordijnen",
    "regelSoort": "fullness",
    "waarde": 2,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "gordijnen",
    "regelSoort": "hem_cm",
    "waarde": 30,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "gordijnen",
    "regelSoort": "side_hem_cm",
    "waarde": 6,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  },
  {
    "productToolSleutel": "gordijnen",
    "regelSoort": "confectie_per_unit",
    "waarde": 0,
    "bronCel": null,
    "notitie": "PLACEHOLDER — bedrijfsregel, bevestigen met Wim/Simone",
    "vereistKlantInput": true
  }
];
