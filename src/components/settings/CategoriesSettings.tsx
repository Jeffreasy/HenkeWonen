import { Archive, Pencil, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";

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

function slugFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesSettings({ session }: CategoriesSettingsProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({
    name: "",
    slug: "",
    sortOrder: "10",
    status: "active" as CategoryRow["status"]
  });
  const [pendingCategoryStatus, setPendingCategoryStatus] = useState<{
    category: CategoryRow;
    nextStatus: CategoryRow["status"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManageCategories = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

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

  function resetDraft() {
    setEditingCategory(null);
    setCategoryDraft({
      name: "",
      slug: "",
      sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 10),
      status: "active"
    });
  }

  function startEditCategory(category: CategoryRow) {
    setEditingCategory(category);
    setCategoryDraft({
      name: category.name,
      slug: category.slug,
      sortOrder: String(category.sortOrder),
      status: category.status
    });
  }

  async function saveCategory(event: SubmitEventLike) {
    event.preventDefault();

    if (!canManageCategories || !categoryDraft.name.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.upsertCategory, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        categoryId: editingCategory?.id,
        name: categoryDraft.name.trim(),
        slug: categoryDraft.slug.trim() || slugFromName(categoryDraft.name),
        sortOrder: Number(categoryDraft.sortOrder) || 0,
        status: categoryDraft.status
      });
      setNotice(editingCategory ? "Productgroep bijgewerkt." : "Productgroep toegevoegd.");
      resetDraft();
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error(saveError);
      setError("Productgroep kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmCategoryStatus() {
    if (!pendingCategoryStatus || !canManageCategories) {
      return;
    }

    const { category, nextStatus } = pendingCategoryStatus;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.portal.upsertCategory, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: nextStatus
      });
      setPendingCategoryStatus(null);
      setNotice(nextStatus === "inactive" ? "Productgroep gearchiveerd." : "Productgroep hersteld.");
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error(saveError);
      setError("Productgroepstatus kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: Array<DataTableColumn<CategoryRow>> = [
    {
      key: "name",
      header: "Productgroep",
      priority: "primary",
      render: (category) => (
        <div className="stack-sm">
          <strong>{category.name}</strong>
          <small className="muted">{category.slug}</small>
        </div>
      )
    },
    {
      key: "sortOrder",
      header: "Volgorde",
      align: "right",
      width: "100px",
      render: (category) => category.sortOrder
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (category) => (
        <StatusBadge status={category.status} label={formatStatusLabel(category.status)} />
      )
    },
    {
      key: "actions",
      header: "Acties",
      width: "190px",
      render: (category) =>
        canManageCategories ? (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => startEditCategory(category)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {category.status === "inactive" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => setPendingCategoryStatus({ category, nextStatus: "active" })}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => setPendingCategoryStatus({ category, nextStatus: "inactive" })}
                size="sm"
                variant="danger"
              >
                Archiveren
              </Button>
            )}
          </div>
        ) : null
    }
  ];

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
      {notice ? <Alert variant="success" description={notice} /> : null}
      {error ? <Alert variant="danger" description={error} /> : null}

      {canManageCategories ? (
        <section className="panel">
          <form className="form-grid" onSubmit={saveCategory}>
            <SectionHeader
              compact
              title={editingCategory ? "Productgroep bewerken" : "Productgroep toevoegen"}
              description="Gebruik productgroepen voor duidelijke catalogusindeling en offertekeuzes."
              actions={
                <StatusBadge
                  status={categoryDraft.status}
                  label={formatStatusLabel(categoryDraft.status)}
                />
              }
            />
            <div className="grid three-column">
              <Field htmlFor="category-name" label="Naam" required>
                <Input
                  id="category-name"
                  required
                  value={categoryDraft.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setCategoryDraft((current) => ({
                      ...current,
                      name,
                      slug:
                        !editingCategory && (!current.slug || current.slug === slugFromName(current.name))
                          ? slugFromName(name)
                          : current.slug
                    }));
                  }}
                />
              </Field>
              <Field htmlFor="category-slug" label="Interne sleutel">
                <Input
                  id="category-slug"
                  value={categoryDraft.slug}
                  onChange={(event) =>
                    setCategoryDraft((current) => ({ ...current, slug: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="category-sort-order" label="Volgorde">
                <Input
                  id="category-sort-order"
                  inputMode="numeric"
                  value={categoryDraft.sortOrder}
                  onChange={(event) =>
                    setCategoryDraft((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field htmlFor="category-status" label="Status">
              <Select
                id="category-status"
                value={categoryDraft.status}
                onChange={(event) =>
                  setCategoryDraft((current) => ({
                    ...current,
                    status: event.target.value as CategoryRow["status"]
                  }))
                }
              >
                <option value="active">{formatStatusLabel("active")}</option>
                <option value="inactive">{formatStatusLabel("inactive")}</option>
              </Select>
            </Field>
            <div className="toolbar">
              <Button
                isLoading={isSaving}
                leftIcon={<Save size={17} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Productgroep opslaan
              </Button>
              {editingCategory ? (
                <Button variant="secondary" onClick={resetDraft}>
                  Annuleren
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <DataTable
        ariaLabel="Productgroepen"
        columns={columns}
        density="compact"
        emptyDescription="Voeg de eerste productgroep toe om catalogusproducten te ordenen."
        emptyTitle="Geen productgroepen"
        error={error}
        getRowKey={(category) => category.id}
        loading={isLoading}
        rows={categories}
      />
    </div>
  );
}
