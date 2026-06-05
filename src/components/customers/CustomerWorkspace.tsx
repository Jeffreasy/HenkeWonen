import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { PortalCustomer } from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FormModal } from "../ui/overlays/FormModal";
import { SectionHeader } from "../ui/SectionHeader";
import { StatCard } from "../ui/StatCard";
import CustomerForm, { type CustomerFormValues } from "./CustomerForm";
import CustomerList from "./CustomerList";

type CustomerWorkspaceProps = {
  session: AppSession;
};

export default function CustomerWorkspace({ session }: CustomerWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const canCreateCustomers = canEditDossiers(session.role);

  const loadCustomers = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.listCustomers, {
        tenantSlug: session.tenantId
      });

      setCustomers(result as PortalCustomer[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Klanten konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  async function createCustomer(customer: CustomerFormValues) {
    const client = createConvexHttpClient();

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.createCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ...customer
      });
      await loadCustomers();
      setIsModalOpen(false);
      showToast({ title: "Klant aangemaakt", description: customer.displayName, tone: "success" });
    } catch {
      showToast({ title: "Klant aanmaken mislukt", tone: "error" });
    }
  }

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Klanten niet geladen" description={error} />
      ) : null}

      <section className="grid three-column">
        <StatCard label="Klanten" value={customers.length} tone="info" />
        <StatCard
          label="Nieuwe aanvragen"
          value={customers.filter((customer) => customer.status === "lead").length}
          tone="warning"
        />
        <StatCard
          label="Actief"
          value={customers.filter((customer) => customer.status === "active").length}
          tone="success"
        />
      </section>

      <section className="grid">
        <SectionHeader
          compact
          title="Klantdossiers"
          description="Zoek klanten, open dossiers en controleer contactgegevens."
          actions={
            canCreateCustomers ? (
              <Button
                leftIcon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setIsModalOpen(true)}
                size="sm"
                variant="primary"
              >
                Nieuwe klant
              </Button>
            ) : null
          }
        />
        <CustomerList customers={customers} isLoading={isLoading} />
      </section>

      {canCreateCustomers ? (
        <FormModal
          open={isModalOpen}
          title="Klant of lead toevoegen"
          description="Leg snel een klant of lead vast vanuit winkelcontact."
          size="md"
          onClose={() => setIsModalOpen(false)}
        >
          <CustomerForm onCreate={createCustomer} />
        </FormModal>
      ) : null}
    </div>
  );
}
