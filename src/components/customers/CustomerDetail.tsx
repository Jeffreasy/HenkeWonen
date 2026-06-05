import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import type {
  PortalCustomer,
  PortalCustomerContact,
  PortalProject
} from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import { FormModal } from "../ui/overlays/FormModal";

import { CustomerDetailStats } from "./CustomerDetailStats";
import { CustomerInfoPanel } from "./CustomerInfoPanel";
import { CustomerProjectsTable } from "./CustomerProjectsTable";
import { CustomerEditPanel, type CustomerDraft } from "./CustomerEditPanel";
import { AddContactForm, type AddContactFormValues } from "./AddContactForm";
import { ContactListTable } from "./ContactListTable";
import { LoanedItemsList } from "./LoanedItemsList";

type CustomerDetailProps = {
  session: AppSession;
  customerId: string;
};

type CustomerDetailResult = {
  customer: PortalCustomer;
  projects: PortalProject[];
  contacts: PortalCustomerContact[];
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
    const client = createConvexHttpClient();

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
        customerId
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

    const client = createConvexHttpClient();

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.updateCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        customerId,
        type: detail.customer.type,
        status: detail.customer.status,
        displayName: draft.displayName.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        street: draft.street.trim() || undefined,
        houseNumber: draft.houseNumber.trim() || undefined,
        postalCode: draft.postalCode.trim() || undefined,
        city: draft.city.trim() || undefined,
        notes: draft.notes.trim() || undefined
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

    const client = createConvexHttpClient();

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.updateCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        customerId,
        type: detail.customer.type,
        displayName: detail.customer.displayName,
        email: detail.customer.email,
        phone: detail.customer.phone,
        street: detail.customer.street,
        houseNumber: detail.customer.houseNumber,
        postalCode: detail.customer.postalCode,
        city: detail.customer.city,
        notes: detail.customer.notes,
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
    const client = createConvexHttpClient();

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.createCustomerContact, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        customerId,
        type: values.type,
        title: values.title,
        loanedItemName: values.loanedItemName,
        visibleToCustomer: false,
        createdByExternalUserId: session.userId
      });
      await loadDetail();
      setIsContactModalOpen(false);
      showToast({ title: "Contactmoment toegevoegd", tone: "success" });
    } catch {
      showToast({ title: "Contactmoment kon niet worden toegevoegd", tone: "error" });
    }
  }

  if (isLoading) {
    return <LoadingState title="Klantdossier laden" description="Klantgegevens ophalen." />;
  }

  if (error) {
    return <ErrorState title="Klantdossier niet geladen" description={error} />;
  }

  if (!detail) {
    return <EmptyState title="Klant niet gevonden" description="Controleer de link of ga terug naar klanten." />;
  }

  const { customer, projects, contacts } = detail;
  const loanedItems = contacts.filter((contact) => contact.type === "loaned_item");
  const openLoanedItems = loanedItems.filter((contact) => !contact.returnedAt);

  const initialDraft: CustomerDraft = {
    displayName: customer.displayName,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    street: customer.street ?? "",
    houseNumber: customer.houseNumber ?? "",
    postalCode: customer.postalCode ?? "",
    city: customer.city ?? "",
    notes: customer.notes ?? ""
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

      <div className="grid two-column">
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

      <div className="grid two-column">
        <ContactListTable
          contacts={contacts}
          onNew={canAddContact ? () => setIsContactModalOpen(true) : undefined}
        />
        <LoanedItemsList loanedItems={loanedItems} />
      </div>

      {canAddContact ? (
        <FormModal
          open={isContactModalOpen}
          title="Contactmoment toevoegen"
          description="Registreer een notitie, afspraak of geleend artikel."
          size="sm"
          onClose={() => setIsContactModalOpen(false)}
        >
          <AddContactForm onSubmit={handleAddContact} />
        </FormModal>
      ) : null}
    </div>
  );
}
