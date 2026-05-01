import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { PortalCustomer } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
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

  const loadCustomers = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
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
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    await client.mutation(api.portal.createCustomer, {
      tenantSlug: session.tenantId,
      ...customer
    });
    await loadCustomers();
  }

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Klanten niet geladen" description={error} />
      ) : null}

      <section className="grid three-column">
        <StatCard label="Klanten" value={customers.length} tone="info" />
        <StatCard
          label="Leads"
          value={customers.filter((customer) => customer.status === "lead").length}
          tone="warning"
        />
        <StatCard
          label="Actief"
          value={customers.filter((customer) => customer.status === "active").length}
          tone="success"
        />
      </section>

      <div className="grid two-column">
        <CustomerForm onCreate={createCustomer} />
        <section className="grid">
          <SectionHeader
            compact
            title="Klantdossiers"
            description="Zoek klanten, open dossiers en controleer contactgegevens."
          />
          <CustomerList customers={customers} isLoading={isLoading} />
        </section>
      </div>
    </div>
  );
}
