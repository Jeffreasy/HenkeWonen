import { Camera, ExternalLink, FileText, Package } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { showErrorToast, showToast } from "../../lib/toast";
import type {
  FieldSupplierOrderSummary,
  PortalCustomerContact,
  PortalDossierAttachment
} from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { SectionHeader } from "../ui/layout/SectionHeader";

/**
 * Winkel-context voor de monteur aan de deur: dossierstukken (plattegrond, foto's,
 * oude Excel-offerte), contactmomenten (bv. "stalenboek uitgeleend, retour bij
 * inmeting") en de leverstatus van bestellingen (montage: is alles binnen?).
 * Plus de omgekeerde richting: een foto van de situatie direct in het dossier
 * vastleggen — voorheen kon dat alleen via het volledige kantoorportaal.
 */
type FieldDossierPanelProps = {
  session: AppSession;
  klantId: string;
  projectId: string;
  contacts: PortalCustomerContact[];
  attachments: PortalDossierAttachment[];
  supplierOrders: FieldSupplierOrderSummary[];
  onChanged: () => Promise<void> | void;
};

const ATTACHMENT_KIND_LABEL: Record<PortalDossierAttachment["kind"], string> = {
  floor_plan: "Plattegrond",
  photo: "Foto",
  legacy_excel_quote: "Oude Excel-offerte",
  physical_dossier: "Fysieke map",
  scan: "Scan",
  other: "Overig"
};

const CONTACT_TYPE_LABEL: Record<PortalCustomerContact["type"], string> = {
  note: "Notitie",
  call: "Telefoongesprek",
  email: "E-mail",
  visit: "Bezoek",
  loaned_item: "Uitgeleend",
  agreement: "Afspraak"
};

const ORDER_STATUS_LABEL: Record<FieldSupplierOrderSummary["status"], string> = {
  draft: "Concept",
  ordered: "Besteld",
  confirmed: "Bevestigd",
  partially_received: "Deels ontvangen",
  received: "Ontvangen",
  cancelled: "Geannuleerd"
};

export function FieldDossierPanel({
  session,
  klantId,
  projectId,
  contacts,
  attachments,
  supplierOrders,
  onChanged
}: FieldDossierPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUpload = canEditDossiers(session.role);

  async function uploadPhoto(file: File) {
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Kan de foto nu niet opslaan", tone: "error" });
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await client.mutation(api.portal.generateDossierAttachmentUploadUrl, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session)
      });
      const response = await fetch(uploadUrl as string, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!response.ok) {
        throw new Error(`Upload mislukt (${response.status})`);
      }
      const { storageId } = (await response.json()) as { storageId: string };

      await client.mutation(api.portal.createDossierAttachment, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId,
        projectId,
        kind: "photo",
        titel: `Foto buitendienst ${formatDate(Date.now())}`,
        bestandsnaam: file.name || undefined,
        bestandstype: file.type || undefined,
        bestandsgrootteBytes: file.size,
        storageId
      });

      showToast({ title: "Foto toegevoegd aan het dossier", tone: "success" });
      await onChanged();
    } catch (uploadError) {
      showErrorToast(uploadError, "Foto opslaan mislukt", "Controleer de verbinding en probeer opnieuw.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="grid field-project-grid" id="dossier">
      <article className="panel field-customer-card">
        <SectionHeader
          compact
          title="Dossierstukken"
          description="Plattegronden, foto's en oude offertes uit de winkel."
          actions={
            canUpload ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadPhoto(file);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={isUploading}
                  leftIcon={<Camera size={16} aria-hidden="true" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Foto toevoegen
                </Button>
              </>
            ) : undefined
          }
        />
        {attachments.length === 0 ? (
          <p className="muted">Nog geen dossierstukken.</p>
        ) : (
          <ul className="field-dossier-list">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <FileText size={15} aria-hidden="true" />
                <span>
                  {attachment.fileUrl ? (
                    <a href={attachment.fileUrl} target="_blank" rel="noreferrer">
                      {attachment.titel} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : (
                    <strong>{attachment.titel}</strong>
                  )}
                  <small className="muted">
                    {" "}
                    {ATTACHMENT_KIND_LABEL[attachment.kind]} · {formatDate(attachment.aangemaaktOp)}
                    {attachment.omschrijving ? ` · ${attachment.omschrijving}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel field-customer-card">
        <SectionHeader
          compact
          title="Contactmomenten"
          description="Afspraken en notities van de winkel — incl. uitgeleende stalen."
        />
        {contacts.length === 0 ? (
          <p className="muted">Nog geen contactmomenten.</p>
        ) : (
          <ul className="field-dossier-list">
            {contacts.slice(0, 6).map((contact) => (
              <li key={contact.id}>
                <span>
                  <strong>{contact.titel}</strong>
                  <small className="muted">
                    {" "}
                    {CONTACT_TYPE_LABEL[contact.type]} · {formatDate(contact.aangemaaktOp)}
                  </small>
                  {contact.type === "loaned_item" && contact.uitgeleendItemNaam && !contact.geretourneerdOp ? (
                    <small>
                      {" "}
                      — <strong>{contact.uitgeleendItemNaam}</strong> nog retour
                      {contact.verwachteRetourdatum
                        ? ` (verwacht ${formatDate(contact.verwachteRetourdatum)})`
                        : ""}
                    </small>
                  ) : null}
                  {contact.omschrijving ? <small className="muted"> — {contact.omschrijving}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel field-customer-card">
        <SectionHeader
          compact
          title="Bestellingen & levering"
          description="Leverstatus per leveranciersbestelling — handig vóór de montage."
        />
        {supplierOrders.length === 0 ? (
          <p className="muted">Nog geen bestellingen op dit dossier.</p>
        ) : (
          <ul className="field-dossier-list">
            {supplierOrders.map((order) => (
              <li key={order.id}>
                <Package size={15} aria-hidden="true" />
                <span>
                  <strong>{order.leverancierNaam}</strong>
                  {order.bestelnummer ? <small className="muted"> · {order.bestelnummer}</small> : null}
                  <small className="muted"> · {ORDER_STATUS_LABEL[order.status]}</small>
                  {order.status !== "received" && order.status !== "cancelled" && order.verwachteLeverdatumOp ? (
                    <small> — verwacht {formatDate(order.verwachteLeverdatumOp)}</small>
                  ) : null}
                  {order.ontvangenOp ? <small> — ontvangen {formatDate(order.ontvangenOp)}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
