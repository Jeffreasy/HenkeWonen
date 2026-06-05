import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { PortalSupplier, ProductListStatus } from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FormModal } from "../ui/overlays/FormModal";
import { SupplierStats } from "./SupplierStats";
import { AddSupplierForm } from "./AddSupplierForm";
import { EditSupplierForm } from "./EditSupplierForm";
import { SupplierTable } from "./SupplierTable";

type SupplierWorkspaceProps = {
  session: AppSession;
};

type SupplierStatus = NonNullable<PortalSupplier["status"]>;

function isFollowUpStatus(status: ProductListStatus) {
  return status === "unknown" || status === "requested";
}

function supplierSearchText(supplier: PortalSupplier) {
  return [
    supplier.name,
    supplier.contactName,
    supplier.email,
    supplier.phone,
    supplier.notes,
    ...(supplier.sourceFileNames ?? []),
    supplier.productListStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function SupplierWorkspace({ session }: SupplierWorkspaceProps) {
  const [suppliers, setSuppliers] = useState<PortalSupplier[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductListStatus | "all">("all");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<SupplierStatus | "all">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<PortalSupplier | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingSupplierStatus, setPendingSupplierStatus] = useState<{
    supplier: PortalSupplier;
    nextStatus: SupplierStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.listSuppliers, {
        tenantSlug: session.tenantId
      });

      setSuppliers(result as PortalSupplier[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Leveranciers konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const summary = useMemo(() => {
    const available = suppliers.filter((supplier) =>
      ["received", "download_available"].includes(supplier.productListStatus)
    ).length;
    const followUp = suppliers.filter((supplier) => isFollowUpStatus(supplier.productListStatus))
      .length;
    const manual = suppliers.filter((supplier) =>
      ["not_available", "manual_only"].includes(supplier.productListStatus)
    ).length;
    const linkedProducts = suppliers.reduce(
      (total, supplier) => total + (supplier.activeProductCount ?? 0),
      0
    );
    const sourceFiles = suppliers.reduce(
      (total, supplier) => total + (supplier.sourceFileCount ?? 0),
      0
    );

    return { available, followUp, linkedProducts, manual, sourceFiles, total: suppliers.length };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" || supplier.productListStatus === statusFilter;
      const matchesSupplierStatus =
        supplierStatusFilter === "all" || (supplier.status ?? "active") === supplierStatusFilter;
      const matchesSearch =
        !normalizedSearch || supplierSearchText(supplier).includes(normalizedSearch);

      return matchesStatus && matchesSupplierStatus && matchesSearch;
    });
  }, [search, statusFilter, supplierStatusFilter, suppliers]);

  async function handleCreateSupplier(data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    productListStatus: ProductListStatus;
    lastContactAt?: number;
    expectedAt?: number;
    notes?: string;
  }) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.portal.createSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ...data
      });
      showToast({ title: "Leverancier opgeslagen", description: data.name, tone: "success" });
      setIsAddModalOpen(false);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      showToast({ title: "Leverancier kon niet worden opgeslagen", tone: "error" });
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSupplier(data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    productListStatus: ProductListStatus;
    status: SupplierStatus;
    lastContactAt?: number;
    expectedAt?: number;
    notes?: string;
  }) {
    if (!editingSupplier) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(editingSupplier.id);
    setError(null);

    try {
      await client.mutation(api.portal.updateSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: editingSupplier.id,
        ...data
      });
      showToast({ title: `${data.name.trim()} bijgewerkt`, tone: "success" });
      setEditingSupplier(null);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      showToast({ title: "Leverancier kon niet worden bijgewerkt", tone: "error" });
    } finally {
      setSavingSupplierId(null);
    }
  }

  async function handleChangeProductListStatus(supplier: PortalSupplier, nextStatus: ProductListStatus) {
    if (supplier.productListStatus === nextStatus) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(supplier.id);
    setError(null);

    try {
      await client.mutation(api.portal.updateSupplierProductListStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: supplier.id,
        productListStatus: nextStatus
      });
      showToast({ title: `Prijslijststatus bijgewerkt`, description: supplier.name, tone: "success" });
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      showToast({ title: "Status kon niet worden bijgewerkt", tone: "error" });
    } finally {
      setSavingSupplierId(null);
    }
  }

  async function confirmSupplierStatus() {
    if (!pendingSupplierStatus) {
      return;
    }

    const { supplier, nextStatus } = pendingSupplierStatus;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setSavingSupplierId(supplier.id);
    setError(null);

    try {
      await client.mutation(api.portal.updateSupplier, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        supplierId: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        notes: supplier.notes,
        productListStatus: supplier.productListStatus,
        lastContactAt: supplier.lastContactAt,
        expectedAt: supplier.expectedAt,
        status: nextStatus
      });
      showToast({
        title: nextStatus === "archived" ? `${supplier.name} gearchiveerd` : `${supplier.name} hersteld`,
        tone: nextStatus === "archived" ? "warning" : "success"
      });
      setPendingSupplierStatus(null);
      await loadSuppliers();
    } catch (saveError) {
      console.error(saveError);
      showToast({ title: "Leverancierstatus kon niet worden bijgewerkt", tone: "error" });
    } finally {
      setSavingSupplierId(null);
    }
  }

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingSupplierStatus)}
        title={
          pendingSupplierStatus?.nextStatus === "archived"
            ? "Leverancier archiveren?"
            : "Leverancier herstellen?"
        }
        description={
          pendingSupplierStatus
            ? pendingSupplierStatus.nextStatus === "archived"
              ? `Je archiveert ${pendingSupplierStatus.supplier.name}. Producten, imports en historie blijven bewaard.`
              : `Je herstelt ${pendingSupplierStatus.supplier.name} naar actief.`
            : ""
        }
        confirmLabel={pendingSupplierStatus?.nextStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingSupplierStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={Boolean(savingSupplierId)}
        onCancel={() => setPendingSupplierStatus(null)}
        onConfirm={() => void confirmSupplierStatus()}
      />

      <SupplierStats
        total={summary.total}
        available={summary.available}
        followUp={summary.followUp}
        linkedProducts={summary.linkedProducts}
        sourceFiles={summary.sourceFiles}
      />

      {error ? <Alert variant="danger" description={error} /> : null}

      {editingSupplier ? (
        <EditSupplierForm
          supplier={editingSupplier}
          isSaving={savingSupplierId === editingSupplier.id}
          onCancel={() => setEditingSupplier(null)}
          onSaveSupplier={handleSaveSupplier}
        />
      ) : null}

      <SupplierTable
        suppliers={filteredSuppliers}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        supplierStatusFilter={supplierStatusFilter}
        setSupplierStatusFilter={setSupplierStatusFilter}
        onEdit={setEditingSupplier}
        onNew={() => setIsAddModalOpen(true)}
        onArchive={(supplier) => setPendingSupplierStatus({ supplier, nextStatus: "archived" })}
        onRestore={(supplier) => setPendingSupplierStatus({ supplier, nextStatus: "active" })}
        onChangeProductListStatus={handleChangeProductListStatus}
        savingSupplierId={savingSupplierId}
        isLoading={isLoading}
        error={error}
      />

      <FormModal
        open={isAddModalOpen}
        title="Nieuwe leverancier toevoegen"
        description="Vul de leveranciersgegevens in en sla op om te beginnen."
        size="lg"
        onClose={() => setIsAddModalOpen(false)}
      >
        <AddSupplierForm
          isSaving={isSaving}
          onCreateSupplier={handleCreateSupplier}
        />
      </FormModal>
    </div>
  );
}
