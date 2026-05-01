import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";

type ServiceRulesSettingsProps = {
  session: AppSession;
};

type ServiceRuleRow = {
  id: string;
  name: string;
  calculationType: string;
  priceExVat: number;
};

export default function ServiceRulesSettings({ session }: ServiceRulesSettingsProps) {
  const [rules, setRules] = useState<ServiceRuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      setIsLoading(false);
      return;
    }
    const convexClient = client;

    async function loadRules() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await convexClient.query(api.portal.listServiceRules, {
          tenantSlug: session.tenantId
        });

        if (isActive) {
          setRules(result as ServiceRuleRow[]);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Werkzaamheden konden niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadRules();

    return () => {
      isActive = false;
    };
  }, [session.tenantId]);

  if (isLoading) {
    return <div className="empty-state">Werkzaamheden laden...</div>;
  }

  if (error) {
    return <div className="empty-state">{error}</div>;
  }

  return (
    <section className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Werkzaamheid</th>
            <th>Berekening</th>
            <th>Prijs excl. btw</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>
                <strong>{rule.name}</strong>
              </td>
              <td>{formatStatusLabel(rule.calculationType)}</td>
              <td>{formatEuro(rule.priceExVat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
