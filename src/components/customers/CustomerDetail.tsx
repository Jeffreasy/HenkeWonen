import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "astro:transitions/client";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import type {
  PortalCustomer,
  PortalCustomerContact,
  PortalDossierAttachment,
  PortalProject
} from "../../lib/portalTypes";
import { showErrorToast, showToast } from "../../lib/toast";
import { formatDate } from "../../lib/dates";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import { Button } from "../ui/forms/Button";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { FormModal } from "../ui/overlays/FormModal";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { CustomerDetailSkeleton } from "./CustomerDetailSkeleton";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";

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
import { measurementWorktypeQuery } from "../../lib/measurementIntent";
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
  // Route "Gesprek of oriëntatie" uit het intakemenu vult het type alvast op
  // "Bezoek"; de losse Toevoegen-knop houdt de gewone standaard (Notitie).
  const [contactPrefillType, setContactPrefillType] = useState<"note" | "visit">("note");
  const [editingContact, setEditingContact] = useState<PortalCustomerContact | null>(null);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<PortalCustomerContact | null>(null);
  const [pendingCustomerStatus, setPendingCustomerStatus] = useState<
    PortalCustomer["status"] | null
  >(null);
  // Duplicaat-wachter: start de winkel een aanvraag terwijl er al een open
  // dossier met dezelfde titel loopt, dan eerst kiezen (verder in bestaand of
  // bewust nieuw). In de praktijk ontstonden anders drie keer "PVC vloer".
  const [pendingDuplicateStart, setPendingDuplicateStart] = useState<{
    scope: CustomerScopeOption;
    existing: PortalProject;
  } | null>(null);
  const [isStartingProject, setIsStartingProject] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const customerEditFormRef = useRef<HTMLFormElement>(null);
  const canAddContact = canEditDossiers(session.role);
  const canDeleteCustomer = canManage(session.role);

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
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
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
    } catch (saveError) {
      showErrorToast(saveError, "Opslaan mislukt");
    }
  }

  async function confirmCustomerStatus() {
    if (!detail?.customer || !pendingCustomerStatus) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
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
    } catch (statusError) {
      showErrorToast(statusError, "Status kon niet worden bijgewerkt");
    }
  }

  async function handleAddContact(values: AddContactFormValues) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
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
        opvolgenOp: values.followUpDate,
        projectId: values.projectId,
        zichtbaarVoorKlant: values.visibleToCustomer ?? false
      });
      await loadDetail();
      setIsContactModalOpen(false);
      showToast({ title: "Contactmoment toegevoegd", tone: "success" });
    } catch (contactError) {
      showErrorToast(contactError, "Contactmoment kon niet worden toegevoegd");
    }
  }

  async function handleUpdateContact(values: AddContactFormValues) {
    if (!editingContact) {
      return;
    }
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.updateCustomerContact, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        contactId: editingContact.id,
        type: values.type,
        titel: values.title,
        omschrijving: values.description,
        uitgeleendItemNaam: values.loanedItemName,
        verwachteRetourdatum: values.expectedReturnDate,
        opvolgenOp: values.followUpDate,
        zichtbaarVoorKlant: values.visibleToCustomer
      });
      await loadDetail();
      setEditingContact(null);
      showToast({ title: "Contactmoment bijgewerkt", tone: "success" });
    } catch (contactError) {
      showErrorToast(contactError, "Contactmoment kon niet worden bijgewerkt");
    }
  }

  async function confirmDeleteContact() {
    if (!pendingDeleteContact) {
      return;
    }
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.deleteCustomerContact, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        contactId: pendingDeleteContact.id
      });
      await loadDetail();
      showToast({ title: "Contactmoment verwijderd", tone: "success" });
    } catch (contactError) {
      showErrorToast(contactError, "Contactmoment kon niet worden verwijderd");
    } finally {
      setPendingDeleteContact(null);
    }
  }

  async function handleMarkLoanedItemReturned(contact: PortalCustomerContact, returned: boolean) {
    const client = createConvexHttpClient(session);
    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.markCustomerLoanedItemReturned, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        contactId: contact.id,
        returned
      });
      await loadDetail();
      showToast({
        title: returned ? "Retour vastgelegd" : "Retour ongedaan gemaakt",
        description: contact.uitgeleendItemNaam ?? contact.titel,
        tone: "success"
      });
    } catch (contactError) {
      showErrorToast(contactError, "Retourstatus kon niet worden bijgewerkt");
    }
  }

  async function handleCreateAttachment(draft: DossierAttachmentDraft) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
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
      showErrorToast(createError, "Dossierstuk kon niet worden toegevoegd");
    }
  }

  async function handleArchiveAttachment(attachment: PortalDossierAttachment) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
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
      showErrorToast(archiveError, "Dossierstuk kon niet worden gearchiveerd");
    }
  }

  /** Dossierfases waarin "nog een keer starten" vrijwel altijd een vergissing is. */
  const OPEN_PROJECT_STATUSES = new Set(["lead", "measurement_planned", "quote_draft", "quote_sent"]);

  async function createProjectFromScope(scope: CustomerScopeOption) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
      return;
    }

    setIsStartingProject(true);
    try {
      const projectId = await client.mutation(api.portal.createProject, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        titel: scope.projectTitle,
        omschrijving: scope.projectDescription,
        directeVerkoop: scope.target === "quote",
        createdByExternalUserId: session.userId
      });

      showToast({ title: "Aanvraag gestart", description: scope.label, tone: "success" });
      const newProjectId = String(projectId);
      // Directe verkoop springt naar een nieuwe offerte met de catalogus-picker;
      // de overige werksoorten gaan naar de inmeting mét werksoort-hint zodat
      // het inmeet-paneel op de juiste product-tab opent.
      const worktypeQuery = scope.werksoort ? measurementWorktypeQuery(scope.werksoort) : "";
      void navigate(
        scope.target === "quote"
          ? `/portal/offertes?open=nieuw&project=${newProjectId}`
          : `/portal/projecten/${newProjectId}${worktypeQuery}#project-measurement`
      );
    } catch (startError) {
      showErrorToast(startError, "Aanvraag kon niet worden gestart");
    } finally {
      setIsStartingProject(false);
    }
  }

  async function handleStartProject(scope: CustomerScopeOption) {
    // Duplicaat-wachter: dezelfde aanvraag nóg een keer starten terwijl het
    // vorige dossier nog open staat is vrijwel altijd "waar was ik gebleven?".
    // Laat dan kiezen i.p.v. stil een tweede dossier aan te maken.
    const existing = (detail?.projects ?? []).find(
      (project) =>
        OPEN_PROJECT_STATUSES.has(project.status) &&
        project.titel.trim().toLowerCase() === scope.projectTitle.trim().toLowerCase()
    );

    if (existing) {
      setPendingDuplicateStart({ scope, existing });
      return;
    }

    await createProjectFromScope(scope);
  }

  async function handleDeleteCustomer(typedName: string) {
    // Re-entrancy-guard: een snelle dubbelklik vóór de re-render mag geen tweede mutation starten.
    if (!detail?.customer || isDeleting) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const result = (await client.mutation(api.portal.deleteCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        klantId: customerId,
        // Bewust de gebruikersinvoer, niet de server-opgehaalde naam: anders vergelijkt de
        // servercheck het record met zichzelf en beschermt hij niet tegen een verkeerd id.
        bevestigNaam: typedName
      })) as { mode?: "deleted" | "anonymized" };

      const anonymized = result?.mode === "anonymized";
      showToast({
        title: anonymized ? "Klant geanonimiseerd" : "Klant verwijderd",
        description: anonymized
          ? "Facturen blijven wettelijk 7 jaar bewaard; de overige gegevens zijn gewist."
          : "Alle gekoppelde gegevens zijn verwijderd.",
        tone: anonymized ? "warning" : "success"
      });
      // De klant is weg of geanonimiseerd — terug naar de klantenlijst.
      void navigate("/portal/klanten");
    } catch (deleteError) {
      showErrorToast(deleteError, "Verwijderen mislukt");
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (error) {
    return <ErrorState title="Klantdossier niet geladen" description={error} />;
  }

  if (!detail) {
    return (
      <EmptyState
        title="Klant niet gevonden"
        description="Controleer de link of ga terug naar klanten."
      />
    );
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
        title={pendingCustomerStatus === "archived" ? "Klant archiveren?" : "Klant herstellen?"}
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
      <ConfirmDialog
        open={Boolean(pendingDuplicateStart)}
        title={`Er loopt al een dossier “${pendingDuplicateStart?.existing.titel ?? ""}”`}
        description={`Voor deze klant staat al een open aanvraag met dezelfde naam (status ${formatProjectStatus(pendingDuplicateStart?.existing.status ?? "lead")}, gestart ${formatDate(pendingDuplicateStart?.existing.aangemaaktOp)}). Meestal wil je dáárin verder werken — zo voorkom je dubbele dossiers voor dezelfde klus.`}
        confirmLabel="Bestaand dossier openen"
        tone="warning"
        isBusy={isStartingProject}
        onCancel={() => setPendingDuplicateStart(null)}
        onConfirm={() => {
          const existing = pendingDuplicateStart?.existing;
          setPendingDuplicateStart(null);
          if (existing) {
            void navigate(`/portal/projecten/${existing.id}`);
          }
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={isStartingProject}
          onClick={() => {
            const scope = pendingDuplicateStart?.scope;
            setPendingDuplicateStart(null);
            if (scope) {
              void createProjectFromScope(scope);
            }
          }}
        >
          Toch een nieuw dossier starten
        </Button>
      </ConfirmDialog>
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
          onNew={
            canAddContact
              ? () => {
                  setContactPrefillType("note");
                  setIsContactModalOpen(true);
                }
              : undefined
          }
          onEdit={canAddContact ? (contact) => setEditingContact(contact) : undefined}
          onDelete={canManage(session.role) ? (contact) => setPendingDeleteContact(contact) : undefined}
        />
        <LoanedItemsList
          loanedItems={loanedItems}
          onMarkReturned={canAddContact ? handleMarkLoanedItemReturned : undefined}
        />
      </div>

      {canAddContact ? (
        <CustomerIntakePanel
          onStartProject={handleStartProject}
          onLogVisit={() => {
            setContactPrefillType("visit");
            setIsContactModalOpen(true);
          }}
        />
      ) : null}

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
          <AddContactForm
            key={contactPrefillType}
            initialValues={contactPrefillType === "visit" ? { type: "visit", title: "" } : undefined}
            onSubmit={handleAddContact}
            projectOptions={projects.map((project) => ({ id: project.id, titel: project.titel }))}
          />
        </FormModal>
      ) : null}

      {canAddContact && editingContact ? (
        <FormModal
          open
          title="Contactmoment bewerken"
          description="Corrigeer de tekst, het type of de retourdatum. De oorspronkelijke vastlegger blijft de auteur."
          size="md"
          onClose={() => setEditingContact(null)}
        >
          <AddContactForm
            key={editingContact.id}
            initialValues={{
              type: editingContact.type,
              title: editingContact.titel,
              description: editingContact.omschrijving,
              loanedItemName: editingContact.uitgeleendItemNaam,
              expectedReturnDate: editingContact.verwachteRetourdatum,
              followUpDate: editingContact.opvolgenOp,
              projectId: editingContact.projectId,
              visibleToCustomer: editingContact.zichtbaarVoorKlant
            }}
            submitLabel="Wijzigingen opslaan"
            onSubmit={handleUpdateContact}
          />
        </FormModal>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteContact)}
        title="Contactmoment verwijderen?"
        description={`Je verwijdert "${pendingDeleteContact?.titel ?? ""}" definitief uit dit klantdossier.`}
        confirmLabel="Verwijderen"
        tone="danger"
        onCancel={() => setPendingDeleteContact(null)}
        onConfirm={() => void confirmDeleteContact()}
      />

      {canDeleteCustomer ? (
        <section className="panel customer-detail-panel">
          <SectionHeader
            compact
            title="Klant verwijderen"
            description="AVG — recht op vergetelheid. Verwijdert de klant en alle gekoppelde gegevens; facturen blijven wettelijk 7 jaar bewaard (de klant wordt dan geanonimiseerd)."
            actions={
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={16} aria-hidden="true" />}
                onClick={() => setIsDeleteOpen(true)}
              >
                Klant verwijderen
              </Button>
            }
          />
        </section>
      ) : null}

      {canDeleteCustomer ? (
        <DeleteCustomerDialog
          open={isDeleteOpen}
          customerName={customer.weergaveNaam}
          isBusy={isDeleting}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteCustomer}
        />
      ) : null}
    </div>
  );
}
