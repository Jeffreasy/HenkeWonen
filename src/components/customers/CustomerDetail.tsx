import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import type {
  PortalCustomer,
  PortalCustomerContact,
  PortalDossierAttachment,
  PortalProject
} from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { FormModal } from "../ui/overlays/FormModal";
import { CustomerDetailSkeleton } from "./CustomerDetailSkeleton";

import { CustomerDetailStats } from "./CustomerDetailStats";
import { CustomerInfoPanel } from "./CustomerInfoPanel";
import { CustomerProjectsTable } from "./CustomerProjectsTable";
import { CustomerEditPanel, type CustomerDraft } from "./CustomerEditPanel";
import { AddContactForm, type AddContactFormValues } from "./AddContactForm";
import { ContactListTable } from "./ContactListTable";
import { LoanedItemsList } from "./LoanedItemsList";
import {
  CustomerDossierAttachmentsPanel,
  type DossierAttachmentDraft
} from "./CustomerDossierAttachmentsPanel";
import { CustomerIntakePanel, type CustomerScopeOption } from "./CustomerIntakePanel";

type CustomerDetailProps = {
  session: AppSession;
  customerId: string;
};

type CustomerDetailResult = {
  customer: PortalCustomer;
  projects: PortalProject[];
  contacts: PortalCustomerContact[];
  attachments: PortalDossierAttachment[];
} | null;

export default function CustomerDetail({ session, customerId }: CustomerDetailProps) {
  const [detail, setDetail] = useState<CustomerDetailResult>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [pendingCustomerStatus, setPendingCustomerStatus] =
    useState<PortalCustomer["status"] | null>(null);
  const customerEditFormRef = useRef<HTMLFormElement>(null);
  const canAddContact = canEditDossiers(session.role);

  useAutoFocusPanel(editingCustomer, customerEditFormRef);

  const loadDetail = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.customerDetail, {
        tenantSlug: session.tenantId,
        klantId: customerId
      });

      setDetail(result as CustomerDetailResult);
    } catch (loadError) {
      console.error(loadError);
      setError("Klantdossier kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId, session.tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleSaveCustomer(draft: CustomerDraft) {
    if (!detail?.customer) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.updateCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        type: detail.customer.type,
        status: detail.customer.status,
        weergaveNaam: draft.displayName.trim(),
        email: draft.email.trim() || undefined,
        telefoon: draft.phone.trim() || undefined,
        straat: draft.street.trim() || undefined,
        huisnummer: draft.houseNumber.trim() || undefined,
        postcode: draft.postalCode.trim() || undefined,
        plaats: draft.city.trim() || undefined,
        notities: draft.notes.trim() || undefined
      });
      setEditingCustomer(false);
      await loadDetail();
      showToast({ title: "Klantgegevens opgeslagen", tone: "success" });
    } catch {
      showToast({ title: "Opslaan mislukt", tone: "error" });
    }
  }

  async function confirmCustomerStatus() {
    if (!detail?.customer || !pendingCustomerStatus) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.updateCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        type: detail.customer.type,
        weergaveNaam: detail.customer.weergaveNaam,
        email: detail.customer.email,
        telefoon: detail.customer.telefoon,
        straat: detail.customer.straat,
        huisnummer: detail.customer.huisnummer,
        postcode: detail.customer.postcode,
        plaats: detail.customer.plaats,
        notities: detail.customer.notities,
        status: pendingCustomerStatus
      });
      setPendingCustomerStatus(null);
      await loadDetail();
      showToast({
        title: pendingCustomerStatus === "archived" ? "Klant gearchiveerd" : "Klant hersteld",
        tone: pendingCustomerStatus === "archived" ? "warning" : "success"
      });
    } catch {
      showToast({ title: "Status kon niet worden bijgewerkt", tone: "error" });
    }
  }

  async function handleAddContact(values: AddContactFormValues) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.createCustomerContact, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        type: values.type,
        titel: values.title,
        omschrijving: values.description,
        uitgeleendItemNaam: values.loanedItemName,
        verwachteRetourdatum: values.expectedReturnDate,
        zichtbaarVoorKlant: false,
        createdByExternalUserId: session.userId
      });
      await loadDetail();
      setIsContactModalOpen(false);
      showToast({ title: "Contactmoment toegevoegd", tone: "success" });
    } catch {
      showToast({ title: "Contactmoment kon niet worden toegevoegd", tone: "error" });
    }
  }

  async function handleCreateAttachment(draft: DossierAttachmentDraft) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      let storageId: string | undefined;

      if (draft.file) {
        const uploadUrl = (await client.mutation(api.portal.generateDossierAttachmentUploadUrl, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session)
        })) as string;

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": draft.file.type || "application/octet-stream" },
          body: draft.file
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload mislukt");
        }

        const uploadJson = (await uploadResponse.json()) as { storageId: string };
        storageId = uploadJson.storageId;
      }

      await client.mutation(api.portal.createDossierAttachment, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        projectId: draft.projectId,
        kind: draft.kind,
        titel: draft.titel,
        omschrijving: draft.omschrijving,
        bestandsnaam: draft.file?.name,
        bestandstype: draft.file?.type || undefined,
        bestandsgrootteBytes: draft.file?.size,
        storageId
      });

      await loadDetail();
      showToast({ title: "Dossierstuk toegevoegd", tone: "success" });
    } catch (createError) {
      console.error(createError);
      showToast({ title: "Dossierstuk kon niet worden toegevoegd", tone: "error" });
    }
  }

  async function handleArchiveAttachment(attachment: PortalDossierAttachment) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.archiveDossierAttachment, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        attachmentId: attachment.id
      });
      await loadDetail();
      showToast({ title: "Dossierstuk gearchiveerd", tone: "success" });
    } catch (archiveError) {
      console.error(archiveError);
      showToast({ title: "Dossierstuk kon niet worden gearchiveerd", tone: "error" });
    }
  }

  async function handleStartProject(scope: CustomerScopeOption) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      const projectId = await client.mutation(api.portal.createProject, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        titel: scope.projectTitle,
        omschrijving: scope.projectDescription,
        createdByExternalUserId: session.userId
      });

      showToast({ title: "Aanvraag gestart", description: scope.label, tone: "success" });
      window.location.assign(`/portal/projecten/${String(projectId)}#project-measurement`);
    } catch {
      showToast({ title: "Aanvraag kon niet worden gestart", tone: "error" });
    }
  }

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (error) {
    return <ErrorState title="Klantdossier niet geladen" description={error} />;
  }

  if (!detail) {
    return <EmptyState title="Klant niet gevonden" description="Controleer de link of ga terug naar klanten." />;
  }

  const { customer, projects, contacts, attachments } = detail;
  const loanedItems = contacts.filter((contact) => contact.type === "loaned_item");
  const openLoanedItems = loanedItems.filter((contact) => !contact.geretourneerdOp);

  const initialDraft: CustomerDraft = {
    displayName: customer.weergaveNaam,
    email: customer.email ?? "",
    phone: customer.telefoon ?? "",
    street: customer.straat ?? "",
    houseNumber: customer.huisnummer ?? "",
    postalCode: customer.postcode ?? "",
    city: customer.plaats ?? "",
    notes: customer.notities ?? ""
  };

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingCustomerStatus)}
        title={
          pendingCustomerStatus === "archived"
            ? "Klant archiveren?"
            : "Klant herstellen?"
        }
        description={
          pendingCustomerStatus === "archived"
            ? "De klant blijft bewaard, maar verdwijnt uit de dagelijkse werkvoorraad."
            : "De klant wordt weer actief zichtbaar in de werkvoorraad."
        }
        confirmLabel={pendingCustomerStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingCustomerStatus === "archived" ? "danger" : "warning"}
        onCancel={() => setPendingCustomerStatus(null)}
        onConfirm={() => void confirmCustomerStatus()}
      />
      <CustomerDetailStats
        projectsCount={projects.length}
        contactsCount={contacts.length}
        openLoanedItemsCount={openLoanedItems.length}
      />

      <div className="grid two-column customer-overview-grid">
        <CustomerInfoPanel
          customer={customer}
          canEdit={canAddContact}
          onEditToggle={() => setEditingCustomer((current) => !current)}
          onArchiveToggle={(status) => setPendingCustomerStatus(status)}
        />

        <CustomerProjectsTable projects={projects} />
      </div>

      {canAddContact && editingCustomer ? (
        <CustomerEditPanel
          initialDraft={initialDraft}
          onSave={handleSaveCustomer}
          onCancel={() => setEditingCustomer(false)}
          formRef={customerEditFormRef}
        />
      ) : null}

      <div className="grid two-column customer-support-grid">
        <ContactListTable
          contacts={contacts}
          onNew={canAddContact ? () => setIsContactModalOpen(true) : undefined}
        />
        <LoanedItemsList loanedItems={loanedItems} />
      </div>

      {canAddContact ? <CustomerIntakePanel onStartProject={handleStartProject} /> : null}

      <CustomerDossierAttachmentsPanel
        attachments={attachments}
        projects={projects}
        canCreate={canAddContact}
        onCreate={handleCreateAttachment}
        onArchive={canAddContact ? handleArchiveAttachment : undefined}
      />

      {canAddContact ? (
        <FormModal
          open={isContactModalOpen}
          title="Contactmoment toevoegen"
          description="Leg klantcontact, afspraken of uitgeleend materiaal vast."
          size="md"
          onClose={() => setIsContactModalOpen(false)}
        >
          <AddContactForm onSubmit={handleAddContact} />
        </FormModal>
      ) : null}
    </div>
  );
}
