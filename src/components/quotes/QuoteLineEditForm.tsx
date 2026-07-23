import { Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalQuoteLine, PortalRoom, QuoteLineType } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import type { ServiceRuleRow } from "../settings/settings/settingsTypes";
import ServiceRulePicker from "../catalog/ServiceRulePicker";
import { calculationTypeToUnit, isStandaloneServiceRule } from "../catalog/serviceRuleCatalog";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import { LineTypeButtons } from "./LineTypeButtons";
import { serviceRuleProductId, serviceRuleQuoteMetadata } from "./QuoteLineEditor";
import { LINE_TYPE_OPTIONS, isServiceRuleLineType, parseDecimal } from "./quote/quoteConstants";
import { parseQuoteLineNumbers } from "./quote/quoteLineInput";
import { Alert } from "../ui/feedback/Alert";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

type QuoteLineEditFormProps = {
  line: PortalQuoteLine;
  projectRooms: PortalRoom[];
  isSaving: boolean;
  session: AppSession;
  onSave: (data: QuoteLineFormValues) => Promise<void>;
  onCancel: () => void;
};

export type ServiceRuleEditSelection = ServiceRuleRow | null | undefined;

export function quoteLineProductIdForEdit(
  line: Pick<PortalQuoteLine, "productId" | "regelType">,
  lineType: QuoteLineType,
  selectedServiceRule: ServiceRuleEditSelection
): string | undefined {
  // Tri-state: undefined = ongemoeid, null = expliciet losgekoppeld, object = nieuw gekozen.
  if (selectedServiceRule !== undefined) {
    return selectedServiceRule ? serviceRuleProductId(lineType, selectedServiceRule) : undefined;
  }

  if (
    (lineType === "service" || lineType === "labor") &&
    (line.regelType === "service" || line.regelType === "labor")
  ) {
    return line.productId;
  }

  if (
    (lineType === "product" || lineType === "material") &&
    (line.regelType === "product" || line.regelType === "material")
  ) {
    return line.productId;
  }

  return undefined;
}

export function quoteLineMetadataForEdit(
  metadata: Record<string, unknown> | undefined,
  showServicePicker: boolean,
  selectedServiceRule: ServiceRuleEditSelection
): Record<string, unknown> | undefined {
  if (!showServicePicker || selectedServiceRule === undefined) {
    return metadata;
  }

  if (selectedServiceRule) {
    return {
      ...(metadata ?? {}),
      ...serviceRuleQuoteMetadata(selectedServiceRule)
    };
  }

  if (!metadata) {
    return undefined;
  }

  const cleared = { ...metadata };
  delete cleared.serviceRuleId;
  delete cleared.serviceSku;
  delete cleared.serviceFamily;
  delete cleared.covering;
  delete cleared.stairShape;
  delete cleared.serviceRole;

  if (cleared.source === "serviceRule") {
    delete cleared.source;
    delete cleared.calculationType;
    delete cleared.sectionKey;
  }

  return Object.keys(cleared).length > 0 ? cleared : undefined;
}

export function QuoteLineEditForm({
  line,
  projectRooms,
  isSaving,
  session,
  onSave,
  onCancel
}: QuoteLineEditFormProps) {
  const [lineType, setLineType] = useState<QuoteLineType>("product");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPriceExVat, setUnitPriceExVat] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [discountExVat, setDiscountExVat] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [projectRoomId, setProjectRoomId] = useState("");
  const [selectedServiceRule, setSelectedServiceRule] =
    useState<ServiceRuleEditSelection>(undefined);
  const [numbersError, setNumbersError] = useState<string | null>(null);

  const existingServiceRuleId =
    typeof line.metadata?.serviceRuleId === "string" ? line.metadata.serviceRuleId : "";
  const isImportedStairBundle =
    line.metadata?.bundleType === "stair_renovation" && typeof line.metadata?.bundleId === "string";
  const showServicePicker = isServiceRuleLineType(lineType) && !isImportedStairBundle;

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(true, formRef);

  useEffect(() => {
    setLineType(line.regelType);
    setTitle(line.titel);
    setDescription(line.omschrijving ?? "");
    setQuantity(String(line.aantal));
    setUnit(line.eenheid);
    setUnitPriceExVat(String(line.eenheidsprijsExBtw));
    setVatRate(String(line.btwTarief));
    setDiscountExVat(
      line.kortingExBtw !== undefined && line.kortingExBtw !== null ? String(line.kortingExBtw) : ""
    );
    setSortOrder(String(line.sortOrder));
    setProjectRoomId(line.projectRuimteId ?? "");
    setSelectedServiceRule(undefined);
  }, [line]);

  useEffect(() => {
    if (!isServiceRuleLineType(lineType)) {
      setSelectedServiceRule(undefined);
    }
  }, [lineType]);

  function applyServiceRule(rule: ServiceRuleRow | null) {
    setSelectedServiceRule(rule);

    if (!rule) {
      return;
    }

    setTitle(rule.name);
    setUnit(calculationTypeToUnit(rule.calculationType));
    setUnitPriceExVat(String(rule.priceExVat));
    setVatRate(String(rule.vatRate));
    setDescription((current) => current || rule.description || "");
  }

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!title.trim()) return;

    // Zelfde validatiepad als bij het toevoegen: komma-invoer geldig, onzin of
    // negatieve waarden melden i.p.v. stil € 0 opslaan.
    const numbers = parseQuoteLineNumbers({
      lineType,
      quantity,
      unitPriceExVat,
      vatRate,
      discountExVat
    });
    if (!numbers.ok) {
      setNumbersError(numbers.error);
      return;
    }
    setNumbersError(null);

    const isTextLine = lineType === "text";
    await onSave({
      projectRoomId: projectRoomId || undefined,
      productId: quoteLineProductIdForEdit(line, lineType, selectedServiceRule),
      lineType,
      title: title.trim(),
      description: description.trim() || undefined,
      quantity: numbers.values.quantity,
      unit: isTextLine ? "tekst" : unit.trim() || line.eenheid,
      unitPriceExVat: numbers.values.unitPriceExVat,
      vatRate: numbers.values.vatRate,
      discountExVat: numbers.values.discountExVat,
      sortOrder: Math.max(1, Math.round((parseDecimal(sortOrder) ?? 0) || line.sortOrder)),
      // undefined behoudt de koppeling, null wist hem en een object vervangt hem.
      metadata: quoteLineMetadataForEdit(line.metadata, showServicePicker, selectedServiceRule)
    });
  }

  return (
    <section className="panel edit-work-panel" ref={formRef}>
      <SectionHeader
        compact
        title={`Offertepost bewerken: ${line.titel}`}
        description="Je bewerkt nu deze ene conceptregel. Definitieve of verzonden offertes blijven beschermd tegen losse regelwijzigingen."
        actions={<LineTypeBadge lineType={lineType} />}
      />
      <form className="form-grid" onSubmit={handleSubmit}>
        {isImportedStairBundle ? (
          <Alert
            variant="info"
            title="Onderdeel van PVC-trapbundel"
            description="Regeltype, product, aantal, ruimte en eenheid blijven gekoppeld aan het berekende recept. Omschrijving, prijs, btw en korting kun je corrigeren; verwijderen herstelt altijd de volledige bundel."
          />
        ) : (
          <LineTypeButtons value={lineType} options={LINE_TYPE_OPTIONS} onChange={setLineType} />
        )}
        <Field htmlFor="quote-line-edit-title" label="Omschrijving" required>
          <Input
            id="quote-line-edit-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        {projectRooms.length > 0 ? (
          <Field htmlFor="quote-line-edit-room" label="Ruimte">
            <Select
              id="quote-line-edit-room"
              disabled={isImportedStairBundle}
              value={projectRoomId}
              onChange={(event) => setProjectRoomId(event.target.value)}
            >
              <option value="">Geen specifieke ruimte</option>
              {projectRooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.naam}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {showServicePicker ? (
          <section className="quote-product-picker">
            <SectionHeader
              compact
              title="Werkzaamheid uit de lijst"
              description="Kies een losse werkzaamheid; naam, prijs, btw en eenheid worden overgenomen."
            />
            <ServiceRulePicker
              session={session}
              idPrefix="quote-line-edit-service"
              selectedRuleId={
                selectedServiceRule === undefined
                  ? existingServiceRuleId
                  : (selectedServiceRule?.id ?? "")
              }
              selectedRuleLabel={line.titel}
              onSelect={applyServiceRule}
              ruleFilter={isStandaloneServiceRule}
              label="Werkzaamheid kiezen"
              showPriceInLabel
            />
            <Alert
              variant="info"
              description="PVC-trapwerk beheer je via Inmeting › Trap; nieuwe geleide trapdiensten zijn hier niet selecteerbaar. Een bestaande koppeling blijft staan totdat je die bewust wist."
            />
          </section>
        ) : null}
        <Field htmlFor="quote-line-edit-description" label="Beschrijving">
          <Textarea
            id="quote-line-edit-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid three-column">
          <Field htmlFor="quote-line-edit-quantity" label="Aantal">
            <Input
              disabled={lineType === "text" || isImportedStairBundle}
              id="quote-line-edit-quantity"
              inputMode={isImportedStairBundle ? "numeric" : "decimal"}
              min={isImportedStairBundle ? 1 : undefined}
              step={isImportedStairBundle ? 1 : "any"}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-unit" label="Eenheid">
            <Input
              disabled={lineType === "text" || isImportedStairBundle}
              id="quote-line-edit-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-price" label="Prijs excl. btw">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-price"
              inputMode="decimal"
              value={unitPriceExVat}
              onChange={(event) => setUnitPriceExVat(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid three-column">
          <Field htmlFor="quote-line-edit-vat" label="Btw %">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-vat"
              inputMode="decimal"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-discount" label="Korting excl. btw">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-discount"
              inputMode="decimal"
              value={discountExVat}
              onChange={(event) => setDiscountExVat(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-sort" label="Volgorde">
            <Input
              id="quote-line-edit-sort"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        {numbersError ? (
          <Alert variant="warning" title="Controleer de invoer" description={numbersError} />
        ) : null}
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Offertepost opslaan
          </Button>
          <Button
            variant="secondary"
            leftIcon={<X size={15} aria-hidden="true" />}
            onClick={onCancel}
          >
            Annuleren
          </Button>
        </div>
      </form>
    </section>
  );
}
