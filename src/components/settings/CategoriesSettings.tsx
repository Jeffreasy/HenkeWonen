import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";

type CategoriesSettingsProps = {
  session: AppSession;
};

type CategoryRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: "active" | "inactive";
};

export default function CategoriesSettings({ session }: CategoriesSettingsProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
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

    async function loadCategories() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await convexClient.query(api.portal.listCategories, {
          tenantSlug: session.tenantId
        });

        if (isActive) {
          setCategories(result as CategoryRow[]);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Categorieën konden niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isActive = false;
    };
  }, [session.tenantId]);

  if (isLoading) {
    return <div className="empty-state">Categorieën laden...</div>;
  }

  if (error) {
    return <div className="empty-state">{error}</div>;
  }

  return (
    <section className="grid three-column">
      {categories.map((category) => (
        <div className="card" key={category.id}>
          <span className="badge">{category.sortOrder}</span>
          <h3>{category.name}</h3>
          <p className="muted">{category.slug}</p>
        </div>
      ))}
    </section>
  );
}
