import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { showErrorToast, showToast } from "../../lib/toast";
import { Alert } from "../ui/feedback/Alert";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { CategoryForm } from "./CategoryForm";
import { CategoriesTable } from "./CategoriesTable";
import { type CategoryRow } from "./settings/settingsTypes";

type CategoriesSettingsProps = {
  session: AppSession;
};

export default function CategoriesSettings({ session }: CategoriesSettingsProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [pendingCategoryStatus, setPendingCategoryStatus] = useState<{
    category: CategoryRow;
    nextStatus: CategoryRow["status"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageCategories = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
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
          setError("Productgroepen konden niet worden geladen.");
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
  }, [reloadKey, session.tenantId]);

  const defaultSortOrder = useMemo(() => {
    return String((categories.at(-1)?.sortOrder ?? 0) + 10);
  }, [categories]);

  async function handleSaveCategory(data: {
    name: string;
    slug: string;
    sortOrder: number;
    status: "active" | "inactive";
  }) {
    if (!canManageCategories) {
      return;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.portal.upsertCategory, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        categorieId: editingCategory?.id,
        naam: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder,
        status: data.status
      });
      showToast({ title: editingCategory ? "Productgroep bijgewerkt" : "Productgroep toegevoegd", description: data.name, tone: "success" });
      setEditingCategory(null);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      showErrorToast(saveError, "Productgroep kon niet worden opgeslagen");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmCategoryStatus() {
    if (!pendingCategoryStatus || !canManageCategories) {
      return;
    }

    const { category, nextStatus } = pendingCategoryStatus;
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.portal.upsertCategory, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        categorieId: category.id,
        naam: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: nextStatus
      });
      setPendingCategoryStatus(null);
      showToast({ title: nextStatus === "inactive" ? "Productgroep gearchiveerd" : "Productgroep hersteld", description: category.name, tone: nextStatus === "inactive" ? "warning" : "success" });
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      showErrorToast(saveError, "Productgroepstatus kon niet worden bijgewerkt");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingCategoryStatus)}
        title={
          pendingCategoryStatus?.nextStatus === "inactive"
            ? "Productgroep archiveren?"
            : "Productgroep herstellen?"
        }
        description={
          pendingCategoryStatus
            ? pendingCategoryStatus.nextStatus === "inactive"
              ? `Je archiveert ${pendingCategoryStatus.category.name}. Bestaande producten blijven gekoppeld, maar de groep verdwijnt uit actieve keuzes.`
              : `Je herstelt ${pendingCategoryStatus.category.name} naar actief.`
            : ""
        }
        confirmLabel={pendingCategoryStatus?.nextStatus === "inactive" ? "Archiveren" : "Herstellen"}
        tone={pendingCategoryStatus?.nextStatus === "inactive" ? "danger" : "warning"}
        isBusy={isSaving}
        onCancel={() => setPendingCategoryStatus(null)}
        onConfirm={() => void confirmCategoryStatus()}
      />
      {error ? <Alert variant="danger" description={error} /> : null}

      {canManageCategories ? (
        <CategoryForm
          category={editingCategory}
          defaultSortOrder={defaultSortOrder}
          isSaving={isSaving}
          onCancel={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
        />
      ) : null}

      <CategoriesTable
        categories={categories}
        isLoading={isLoading}
        error={error}
        canManage={canManageCategories}
        onEdit={setEditingCategory}
        onArchive={(category) => setPendingCategoryStatus({ category, nextStatus: "inactive" })}
        onRestore={(category) => setPendingCategoryStatus({ category, nextStatus: "active" })}
      />
    </div>
  );
}
