export type CustomerStatus = "lead" | "active" | "inactive" | "archived";
export type CustomerType = "private" | "business";

export type PortalCustomer = {
  id: string;
  tenantId: string;
  type: CustomerType;
  weergaveNaam: string;
  email?: string;
  telefoon?: string;
  straat?: string;
  huisnummer?: string;
  postcode?: string;
  plaats?: string;
  notities?: string;
  status: CustomerStatus;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type ProjectStatus =
  | "lead"
  | "quote_draft"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "measurement_planned"
  | "execution_planned"
  | "ordering"
  | "in_progress"
  | "invoiced"
  | "paid"
  | "closed"
  | "cancelled";

export type PortalRoom = {
  id: string;
  projectId: string;
  naam: string;
  verdieping?: string;
  breedteCm?: number;
  lengteCm?: number;
  oppervlakteM2?: number;
  omtrekMeter?: number;
  notities?: string;
  sortOrder: number;
};

export type PortalProject = {
  id: string;
  tenantId: string;
  klantId: string;
  titel: string;
  omschrijving?: string;
  status: ProjectStatus;
  inmeetdatum?: number;
  uitvoerdatum?: number;
  interneNotities?: string;
  klantNotities?: string;
  geaccepteerdOp?: number;
  inmeetGeplandOp?: number;
  uitvoerGeplandOp?: number;
  besteldOp?: number;
  gefactureerdOp?: number;
  betaaldOp?: number;
  afgeslotenOp?: number;
  rooms: PortalRoom[];
  createdByExternalUserId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type MeasurementStatus = "draft" | "measured" | "reviewed" | "converted_to_quote";

export type MeasurementProductGroup =
  | "flooring"
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "curtains"
  | "rails"
  | "stairs"
  | "other";

export type MeasurementCalculationType =
  | "area"
  | "perimeter"
  | "rolls"
  | "panels"
  | "stairs"
  | "matrix"
  | "manual";

export type QuotePreparationStatus = "draft" | "ready_for_quote" | "converted";

export type PortalMeasurement = {
  id: string;
  tenantId: string;
  projectId: string;
  klantId: string;
  status: MeasurementStatus;
  inmeetdatum?: number;
  gemetenDoor?: string;
  notities?: string;
  createdByExternalUserId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type PortalMeasurementRoom = {
  id: string;
  tenantId: string;
  inmetingId: string;
  projectRuimteId?: string;
  naam: string;
  verdieping?: string;
  breedteM?: number;
  lengteM?: number;
  hoogteM?: number;
  oppervlakteM2?: number;
  omtrekM?: number;
  notities?: string;
  sortOrder: number;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type PortalMeasurementLine = {
  id: string;
  tenantId: string;
  inmetingId: string;
  ruimteId?: string;
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  invoer: Record<string, unknown>;
  resultaat: Record<string, unknown>;
  snijverliesPct?: number;
  aantal: number;
  eenheid: string;
  notities?: string;
  offerteRegelType: QuoteLineType;
  quotePreparationStatus: QuotePreparationStatus;
  productId?: string;
  productNaam?: string;
  indicatieveEenheidsprijsExBtw?: number;
  indicatiefBtwTarief?: number;
  indicatievePrijsEenheid?: string;
  indicatievePrijsSoort?: string;
  indicatiefVastgelegdOp?: number;
  geconverteerdeOfferteId?: string;
  geconverteerdeOfferteregelId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type PortalWasteProfile = {
  id: string;
  tenantId: string;
  productGroep: MeasurementProductGroup;
  naam: string;
  standaardSnijverliesPct: number;
  omschrijving?: string;
  status: "active" | "inactive";
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type PortalProjectMeasurementData = {
  measurement: PortalMeasurement | null;
  rooms: PortalMeasurementRoom[];
  lines: PortalMeasurementLine[];
  wasteProfiles: PortalWasteProfile[];
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type QuoteLineType =
  | "product"
  | "service"
  | "labor"
  | "material"
  | "discount"
  | "text"
  | "manual";

export type PortalQuoteLine = {
  id: string;
  quoteId: string;
  projectRuimteId?: string;
  productId?: string;
  regelType: QuoteLineType;
  titel: string;
  omschrijving?: string;
  aantal: number;
  eenheid: string;
  eenheidsprijsExBtw: number;
  btwTarief: number;
  kortingExBtw?: number;
  regelTotaalExBtw: number;
  regelBtwTotaal: number;
  regelTotaalInclBtw: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};

export type PortalQuote = {
  id: string;
  tenantId: string;
  projectId: string;
  klantId: string;
  offertenummer: string;
  titel: string;
  status: QuoteStatus;
  verzondenOp?: number;
  geldigTot?: number;
  inleidingTekst?: string;
  afsluitTekst?: string;
  voorwaarden?: string[];
  betalingsvoorwaarden?: string[];
  subtotaalExBtw: number;
  btwTotaal: number;
  totaalInclBtw: number;
  lines: PortalQuoteLine[];
  createdByExternalUserId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type ProductListStatus =
  | "unknown"
  | "requested"
  | "received"
  | "download_available"
  | "not_available"
  | "manual_only";

export type PortalSupplier = {
  id: string;
  tenantId: string;
  naam: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  prijslijstStatus: ProductListStatus;
  status?: "active" | "inactive" | "archived";
  notities?: string;
  laatsteContactOp?: number;
  verwachtOp?: number;
  activeProductCount?: number;
  importProfileCount?: number;
  importBatchCount?: number;
  sourceFileCount?: number;
  sourceFileNames?: string[];
  latestImportStatus?: string;
  latestImportAt?: number;
  gewijzigdOp: number;
};

export type SupplierOrderStatus =
  | "draft"
  | "ordered"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled";

export type SupplierOrderLineStatus = "ordered" | "received" | "cancelled";

export type PortalSupplierOrderLine = {
  id: string;
  bestellingId: string;
  productId?: string;
  quoteLineId?: string;
  omschrijving: string;
  artikelnummer?: string;
  leverancierCode?: string;
  aantal: number;
  eenheid: string;
  inkoopPrijsExBtw?: number;
  inkoopPrijsBron?: "net_purchase" | "purchase" | "manual" | "none";
  regelTotaalExBtw?: number;
  status: SupplierOrderLineStatus;
  notities?: string;
  sortOrder: number;
};

export type PortalSupplierOrder = {
  id: string;
  tenantId: string;
  projectId: string;
  quoteId?: string;
  leverancierId?: string;
  leverancierNaam?: string;
  bestelnummer?: string;
  status: SupplierOrderStatus;
  besteldOp?: number;
  verwachteLeverdatumOp?: number;
  ontvangenOp?: number;
  notities?: string;
  regelAantal: number;
  totaalInkoopExBtw: number;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type ProductPriceType =
  | "purchase"
  | "net_purchase"
  | "retail"
  | "advice_retail"
  | "commission"
  | "pallet"
  | "trailer"
  | "roll"
  | "cut_length"
  | "package"
  | "step"
  | "manual";

export type PriceUnit =
  | "m2"
  | "m1"
  | "meter"
  | "piece"
  | "package"
  | "pack"
  | "roll"
  | "pallet"
  | "trailer"
  | "step"
  | "liter"
  | "kg"
  | "custom";

export type VatMode = "exclusive" | "inclusive" | "unknown";

export type ProductUnit =
  | "piece"
  | "m2"
  | "m1"
  | "meter"
  | "roll"
  | "package"
  | "pack"
  | "pallet"
  | "trailer"
  | "step"
  | "liter"
  | "kg"
  | "hour"
  | "stairs"
  | "custom";

export type ProductKind =
  | "click"
  | "dryback"
  | "src"
  | "panel"
  | "tile"
  | "carpet"
  | "vinyl"
  | "curtain"
  | "fabric"
  | "curtain_fabric"
  | "vitrage"
  | "roman_blind_fabric"
  | "panel_curtain_fabric"
  | "mat"
  | "rug"
  | "blind"
  | "plisse"
  | "jaloezie"
  | "duette"
  | "rail"
  | "wallpaper"
  | "underlay"
  | "adhesive"
  | "plinth"
  | "other";

export type CommercialName = {
  merknaam: string;
  collectieNaam?: string;
  kleurnaam?: string;
  weergaveNaam: string;
};

export type PortalProduct = {
  id: string;
  tenantId: string;
  category: string;
  supplier: string;
  displaySupplierName: string;
  brand?: string;
  collection?: string;
  artikelnummer?: string;
  leverancierCode?: string;
  commercieleCode?: string;
  leverancierProductGroep?: string;
  naam: string;
  weergaveNaam: string;
  kleurnaam?: string;
  productSoort?: ProductKind;
  commercialNames?: CommercialName[];
  eenheid: ProductUnit;
  pakinhoudM2?: number;
  stuksPerPak?: number;
  pakkenPerPallet?: number;
  verkoopEenheid?: string;
  inkoopEenheid?: string;
  bestelEenheid?: string;
  minimumBestelAantal?: number;
  bestelVeelvoud?: number;
  palletAantal?: number;
  vrachtwagenAantal?: number;
  bundelGrootte?: number;
  prijsExBtw: number;
  /** Eenheid waarop priceExVat slaat (m2/m1/rol/pak/...), voor nette weergave. */
  prijsEenheid?: string;
  btwTarief: number;
  pilotHiddenReason?: string;
  status: "draft" | "active" | "inactive" | "archived";
};

export type ImportWarning = {
  rijNummer: number;
  message: string;
  ernst: "warning" | "error";
};

export type ProductImportBatch = {
  id: string;
  tenantId: string;
  bestandsnaam: string;
  leverancierNaam: string;
  status:
    | "uploaded"
    | "analyzing"
    | "needs_mapping"
    | "ready_to_import"
    | "importing"
    | "imported"
    | "failed"
    | "archived";
  gearchiveerdVanafStatus?:
    | "uploaded"
    | "analyzing"
    | "needs_mapping"
    | "ready_to_import"
    | "importing"
    | "imported"
    | "failed";
  gearchiveerdOp?: number;
  archivedByExternalUserId?: string;
  bronPad?: string;
  bestandHash?: string;
  profileName?: string;
  totaalRijen: number;
  voorbeeldRijen: number;
  productRijen: number;
  geldigeRijen: number;
  waarschuwingRijen: number;
  foutRijen: number;
  genegeerdeRijen: number;
  geimporteerdeProducten: number;
  bijgewerkteProducten: number;
  overgeslagenProducten: number;
  geimporteerdePrijzen: number;
  overgeslagenPrijzen: number;
  dubbeleProductMatches: number;
  nulPrijsRijen: number;
  onbekendeBtwModusRijen: number;
  productenZonderLeverancierCode: number;
  weesPrijsRegels: number;
  dubbeleBronSleutels: number;
  staBtwModusOnbekendToe: boolean;
  geimporteerdOp?: number;
  vastgelegdOp?: number;
  misluktOp?: number;
  foutmelding?: string;
  reconciliatie?: Record<string, unknown>;
  waarschuwingen: ImportWarning[];
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type ProductImportRowKind =
  | "header"
  | "section"
  | "product"
  | "empty"
  | "warning"
  | "error"
  | "ignored";

export type ProductImportRowStatus = "valid" | "warning" | "error" | "ignored" | "imported";

export type ProductImportRow = {
  id: string;
  bronBestandsnaam?: string;
  bronBladNaam?: string;
  rijNummer: number;
  importSleutel?: string;
  bronSleutel?: string;
  rijSoort: ProductImportRowKind;
  status: ProductImportRowStatus;
  sectieLabel?: string;
  genormaliseerd?: Record<string, unknown>;
  waarschuwingen: string[];
  fouten: string[];
  geimporteerdProductId?: string;
  geimporteerdePrijsIds: string[];
};

export type NormalizedProductImportRow = {
  sourceFile: string;
  sourceSheet: string;
  bronRijNummer: number;
  rijSoort: ProductImportRowKind;
  leverancierNaam: string;
  merknaam?: string;
  collectieNaam?: string;
  sectieLabel?: string;
  productNaam: string;
  kleurnaam?: string;
  artikelnummer?: string;
  leverancierCode?: string;
  commercieleCode?: string;
  leverancierProductGroep?: string;
  sku?: string;
  ean?: string;
  category:
    | "pvc"
    | "tapijt"
    | "vinyl"
    | "karpetten"
    | "gordijnen"
    | "raambekleding"
    | "wandpanelen"
    | "douchepanelen"
    | "tegels"
    | "plinten"
    | "lijm"
    | "kit"
    | "egaline"
    | "entreematten"
    | "traprenovatie"
    | "behang"
    | "roedes_railsen"
    | "horren"
    | "overig";
  productSoort?: ProductKind;
  breedteMm?: number;
  lengteMm?: number;
  dikteMm?: number;
  slijtlaagMm?: number;
  pakinhoudM2?: number;
  stuksPerPak?: number;
  pakkenPerPallet?: number;
  verkoopEenheid?: string;
  inkoopEenheid?: string;
  bestelEenheid?: string;
  minimumBestelAantal?: number;
  bestelVeelvoud?: number;
  palletAantal?: number;
  vrachtwagenAantal?: number;
  bundelGrootte?: number;
  commercialNames?: CommercialName[];
  attributen?: Record<string, unknown>;
  prices: Array<{
    prijsSoort: ProductPriceType;
    prijsEenheid: PriceUnit;
    bedrag: number;
    btwTarief: number;
    btwModus: VatMode;
    bronKolomNaam: string;
    bronWaarde?: string;
  }>;
};

export type PortalCustomerContact = {
  id: string;
  tenantId: string;
  klantId: string;
  type: "note" | "call" | "email" | "visit" | "loaned_item" | "agreement";
  titel: string;
  omschrijving?: string;
  uitgeleendItemNaam?: string;
  verwachteRetourdatum?: number;
  geretourneerdOp?: number;
  zichtbaarVoorKlant: boolean;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type DossierAttachmentKind =
  | "floor_plan"
  | "photo"
  | "legacy_excel_quote"
  | "physical_dossier"
  | "scan"
  | "other";

export type PortalDossierAttachment = {
  id: string;
  tenantId: string;
  klantId: string;
  projectId?: string;
  kind: DossierAttachmentKind;
  titel: string;
  omschrijving?: string;
  bestandsnaam?: string;
  bestandstype?: string;
  bestandsgrootteBytes?: number;
  /**
   * Of er een fysiek bestand aan dit stuk hangt. Bewust géén directe URL meer: de bytes
   * worden per request achter de sessie opgehaald via de proxyroute (AVG). Bouw de link
   * met `dossierBestandHref(id)`.
   */
  hasFile: boolean;
  status: "active" | "archived";
  createdByExternalUserId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

/**
 * Link naar de sessie-beveiligde proxyroute die de bytes van een dossierstuk streamt.
 * Zie src/pages/portal/dossierbestand/[id].ts.
 */
export function dossierBestandHref(attachmentId: string): string {
  return `/portal/dossierbestand/${attachmentId}`;
}

export type PortalWorkflowEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  type:
    | "customer_contact"
    | "quote_created"
    | "measurement_requested"
    | "measurement_planned"
    | "measurement_completed"
    | "quote_sent"
    | "quote_accepted"
    | "quote_rejected"
    | "thank_you_letter_sent"
    | "execution_planned"
    | "supplier_order_created"
    | "invoice_created"
    | "payment_reminder_sent"
    | "payment_received"
    | "bookkeeper_export_sent"
    | "closed";
  titel: string;
  omschrijving?: string;
  zichtbaarVoorKlant: boolean;
  aangemaaktOp: number;
};

export type ProjectTaskType =
  | "quote_follow_up"
  | "confirmation_payment"
  | "execution_call"
  | "invoice_payment";

export type ProjectTaskStatus = "open" | "done" | "dismissed";

export type ProjectTaskPriority = {
  level: "red" | "orange" | "green";
  label: "Rood" | "Oranje" | "Groen";
  tone: "danger" | "warning" | "success";
  rank: number;
};

export type PortalProjectTask = {
  id: string;
  tenantId: string;
  projectId: string;
  quoteId?: string;
  type: ProjectTaskType;
  titel: string;
  vervaltOp: number;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  voltooidOp?: number;
  afgewezenOp?: number;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type QuoteTemplateSection = {
  sleutel: string;
  titel: string;
  omschrijving?: string;
  sortOrder: number;
};

export type QuoteTemplateLine = {
  sectieSleutel?: string;
  regelType: QuoteLineType;
  titel: string;
  eenheid: string;
  omschrijving?: string;
  standaardAantal?: number;
  sortOrder: number;
  optioneel?: boolean;
  standaardIngeschakeld?: boolean;
  categorieHint?: string;
  productSoortHint?: string;
};

export type QuoteTemplate = {
  id: string;
  tenantId: string;
  naam: string;
  type: "default" | "flooring" | "curtains" | "wall_panels" | "custom";
  status?: "active" | "inactive";
  inleidingTekst?: string;
  afsluitTekst?: string;
  secties?: QuoteTemplateSection[];
  standaardVoorwaarden: string[];
  betalingsvoorwaarden?: string[];
  standaardRegels: QuoteTemplateLine[];
};

export type FieldWorkspaceBucket = "today" | "measure" | "quote" | "followUp";

export type FieldWorkspaceCard = {
  id: string;
  href: string;
  bucket: FieldWorkspaceBucket;
  nextAction: string;
  visitAt?: number;
  address?: string;
  telefoon?: string;
  email?: string;
  gewijzigdOp: number;
  project: PortalProject;
  customer: PortalCustomer | null;
  latestQuote: Omit<PortalQuote, "lines"> | null;
  tasks: PortalProjectTask[];
  measurement: {
    id: string;
    status: MeasurementStatus;
    inmeetdatum?: number;
    gemetenDoor?: string;
    gewijzigdOp: number;
  } | null;
};

export type FieldServiceWorkspaceResult = {
  today: FieldWorkspaceCard[];
  measure: FieldWorkspaceCard[];
  quote: FieldWorkspaceCard[];
  followUp: FieldWorkspaceCard[];
  counts: Record<FieldWorkspaceBucket, number>;
};

/** Bestelling-samenvatting voor de buitendienst: leverstatus zonder inkoopbedragen. */
export type FieldSupplierOrderSummary = {
  id: string;
  bestelnummer?: string;
  leverancierNaam: string;
  status: "draft" | "ordered" | "confirmed" | "partially_received" | "received" | "cancelled";
  besteldOp?: number;
  verwachteLeverdatumOp?: number;
  ontvangenOp?: number;
};

export type FieldProjectWorkspaceResult = {
  project: PortalProject;
  customer: PortalCustomer | null;
  quotes: PortalQuote[];
  templates: QuoteTemplate[];
  tasks: PortalProjectTask[];
  /** Contactmomenten van de winkel (notities, uitgeleende stalen) — context aan de deur. */
  contacts: PortalCustomerContact[];
  /** Actieve dossierstukken (plattegrond, foto's, oude offertes). */
  attachments: PortalDossierAttachment[];
  /** Leveranciersbestellingen met leverstatus — relevant voor de montage. */
  supplierOrders: FieldSupplierOrderSummary[];
  visit: {
    status: string;
    visitAt?: number;
    measurementStatus?: MeasurementStatus;
    gemetenDoor?: string;
    omvang?: "klein" | "volledig";
  };
};

export type ImportProfile = {
  id: string;
  leverancierNaam: string;
  naam: string;
  verwachteBestandsextensie?: ".xlsx" | ".xls";
  bestandPatroon?: string;
  bladPatroon?: string;
  ondersteuntXlsx: boolean;
  ondersteuntXls: boolean;
  prijskolomMappings?: Array<{
    header?: string;
    bronKolomNaam?: string;
    bronKolomIndex?: number;
    prijsSoort?: ProductPriceType | string;
    prijsEenheid?: PriceUnit | string;
    btwModus?: VatMode;
  }>;
  btwModusPerPrijskolom?: Record<string, VatMode>;
  eenheidPerPrijskolom?: Record<string, string>;
  prijsSoortPerPrijskolom?: Record<string, string>;
  staBtwModusOnbekendToe?: boolean;
  btwModusReview?: Record<string, unknown>;
  vatModeUpdatedByExternalUserId?: string;
  btwModusGewijzigdOp?: number;
  dubbelenStrategie?: Record<string, unknown>;
  nulPrijsStrategie?: Record<string, unknown>;
  mapping: Record<string, unknown>;
  status: "active" | "inactive";
  gewijzigdOp: number;
};

// ---------------------------------------------------------------------------
// Facturen
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PortalInvoice = {
  id: string;
  tenantId: string;
  projectId: string;
  klantId: string;
  quoteId?: string;
  factuurnummer: string;
  status: InvoiceStatus;
  factuurdatum: number;
  vervaldatum: number;
  subtotaalExBtw: number;
  btwTotaal: number;
  totaalInclBtw: number;
  betaaldBedrag: number;
  betaaldOp?: number;
  herinneringVerzondenOp?: number;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type PortalInvoiceRow = PortalInvoice & {
  customerName: string;
  projectTitle: string;
};

export type PortalInvoiceLine = {
  id: string;
  regelType: string;
  titel: string;
  aantal: number;
  eenheid: string;
  eenheidsprijsExBtw: number;
  btwTarief: number;
  kortingExBtw?: number;
  regelTotaalExBtw: number;
  regelBtwTotaal: number;
  regelTotaalInclBtw: number;
  sortOrder: number;
};

export type PortalInvoiceDetail = {
  invoice: PortalInvoice;
  customer: {
    id: string;
    weergaveNaam: string;
    email?: string;
    telefoon?: string;
    type: CustomerType;
    straat?: string;
    huisnummer?: string;
    postcode?: string;
    plaats?: string;
    land?: string;
  } | null;
  project: {
    id: string;
    titel: string;
    status: ProjectStatus;
  } | null;
  quote: {
    id: string;
    offertenummer: string;
    titel: string;
    status: QuoteStatus;
  } | null;
  quoteLines: PortalInvoiceLine[];
};

