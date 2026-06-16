import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import type { PortalProduct } from "../../lib/portalTypes";
import { createConvexHttpClient } from "../../lib/convex/client";
import { showToast } from "../../lib/toast";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { ProductFilterBar } from "./ProductFilterBar";
import { ProductEditPanel, type ProductDraft } from "./ProductEditPanel";
import { ProductListTable } from "./ProductListTable";
import { type ProductStatus } from "./catalog/catalogTypes";
import { decimalText } from "./catalog/catalogUtils";

type ProductListProps = {
  session: AppSession;
};

type CatalogResult = {
  items: PortalProduct[];
  total: number;
  limit: number;
  categories: Array<{
    name: string;
    count: number;
    truncated?: boolean;
  }>;
  isDone: boolean;
  continueCursor: string;
};

function optionalNumber(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function ProductList({ session }: ProductListProps) {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const [statusFilter, setStatusFilter] = useState<ProductStatus>("active");
  const [categories, setCategories] = useState<CatalogResult["categories"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [continueCursor, setContinueCursor] = useState<string>("");
  const [isDone, setIsDone] = useState(false);
  const [total, setTotal] = useState(0);
  const [includePilotHidden, setIncludePilotHidden] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<PortalProduct | null>(null);
  const [pendingProductStatus, setPendingProductStatus] = useState<{
    product: PortalProduct;
    nextStatus: ProductStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productEditPanelRef = useRef<HTMLElement>(null);
  const canManageProducts = canManage(session.role);

  useAutoFocusPanel(Boolean(editingProduct), productEditPanelRef);

  useEffect(() => {
    let isActive = true;

    async function loadCategoryStats() {
      const client = createConvexHttpClient(session);
      if (!client) return;

      try {
        const result = await client.query(api.catalog.core.listCategoryStats, {
          tenantSlug: session.tenantId,
          status: statusFilter
        });
        if (isActive) {
          setCategories(result.categories);
        }
      } catch {
        // Stille fout
      }
    }

    void loadCategoryStats();
    return () => { isActive = false; };
  }, [session.tenantId, statusFilter]);

  useEffect(() => {
    let isActive = true;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);

      const client = createConvexHttpClient(session);

      if (!client) {
        setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
        setIsLoading(false);
        return;
      }

      try {
        const isFirstPage = !cursor;
        const result = (await client.query(api.catalog.core.listProductsForPortal, {
          tenantSlug: session.tenantId,
          search: query || undefined,
          category: category === "Alle" ? undefined : category,
          status: statusFilter,
          includePilotHidden: canManageProducts && includePilotHidden,
          limit: 300,
          cursor: cursor ?? undefined
        })) as CatalogResult;

        if (isActive) {
          setProducts((prev) => (isFirstPage ? result.items : [...prev, ...result.items]));
          setTotal((prev) => (isFirstPage ? result.items.length : prev + result.items.length));
          setIsDone(result.isDone);
          setContinueCursor(result.continueCursor);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Catalogus kon niet worden opgehaald.");
          setProducts([]);
          setTotal(0);
          setCategories([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      isActive = false;
    };
  }, [
    canManageProducts,
    category,
    cursor,
    includePilotHidden,
    query,
    reloadKey,
    session.tenantId,
    statusFilter
  ]);

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    setCursor(null);
    setIsDone(false);
    setProducts([]);
  }

  function handleCategory(nextCategory: string) {
    setCategory(nextCategory);
    setCursor(null);
    setIsDone(false);
    setProducts([]);
  }

  function handleStatus(nextStatus: ProductStatus) {
    setStatusFilter(nextStatus);
    setCategory("Alle");
    setCursor(null);
    setIsDone(false);
    setProducts([]);
  }

  async function handleSaveProduct(draft: ProductDraft) {
    if (!editingProduct || !canManageProducts) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSavingProduct(true);
    setError(null);

    try {
      await client.mutation(api.catalog.core.updateProductForPortal, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        productId: editingProduct.id,
        naam: draft.name.trim(),
        artikelnummer: draft.articleNumber.trim() || undefined,
        leverancierCode: draft.supplierCode.trim() || undefined,
        commercieleCode: draft.commercialCode.trim() || undefined,
        kleurnaam: draft.colorName.trim() || undefined,
        leverancierProductGroep: draft.supplierProductGroup.trim() || undefined,
        pakinhoudM2: optionalNumber(draft.packageContentM2),
        stuksPerPak: optionalNumber(draft.piecesPerPackage),
        status: draft.status
      });
      setEditingProduct(null);
      setReloadKey((current) => current + 1);
      showToast({ title: "Product opgeslagen", tone: "success" });
    } catch (saveError) {
      console.error(saveError);
      setError("Product kon niet worden opgeslagen.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function confirmProductStatus() {
    if (!pendingProductStatus || !canManageProducts) {
      return;
    }

    const { product, nextStatus } = pendingProductStatus;
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSavingProduct(true);
    setError(null);

    try {
      await client.mutation(api.catalog.core.updateProductForPortal, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        productId: product.id,
        naam: product.naam,
        artikelnummer: product.artikelnummer,
        leverancierCode: product.leverancierCode,
        commercieleCode: product.commercieleCode,
        kleurnaam: product.kleurnaam,
        leverancierProductGroep: product.leverancierProductGroep,
        pakinhoudM2: product.pakinhoudM2,
        stuksPerPak: product.stuksPerPak,
        status: nextStatus
      });
      setPendingProductStatus(null);
      setReloadKey((current) => current + 1);
      showToast({
        title: nextStatus === "archived" ? "Product gearchiveerd" : "Product hersteld",
        tone: "success"
      });
    } catch (saveError) {
      console.error(saveError);
      setError("Productstatus kon niet worden bijgewerkt.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  const initialDraft: ProductDraft | null = editingProduct
    ? {
        name: editingProduct.naam,
        articleNumber: editingProduct.artikelnummer ?? "",
        supplierCode: editingProduct.leverancierCode ?? "",
        commercialCode: editingProduct.commercieleCode ?? "",
        colorName: editingProduct.kleurnaam ?? "",
        supplierProductGroup: editingProduct.leverancierProductGroep ?? "",
        packageContentM2: decimalText(editingProduct.pakinhoudM2),
        piecesPerPackage: decimalText(editingProduct.stuksPerPak),
        status: editingProduct.status
      }
    : null;

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingProductStatus)}
        title={
          pendingProductStatus?.nextStatus === "archived"
            ? "Product archiveren?"
            : "Product herstellen?"
        }
        description={
          pendingProductStatus
            ? pendingProductStatus.nextStatus === "archived"
              ? `Je archiveert "${pendingProductStatus.product.weergaveNaam ?? pendingProductStatus.product.naam}". Het product verdwijnt uit de actieve catalogus, maar historische data blijft bewaard.`
              : `Je herstelt "${pendingProductStatus.product.weergaveNaam ?? pendingProductStatus.product.naam}" naar de actieve catalogus.`
            : ""
        }
        confirmLabel={pendingProductStatus?.nextStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingProductStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={isSavingProduct}
        onCancel={() => setPendingProductStatus(null)}
        onConfirm={() => void confirmProductStatus()}
      />
      <section className="panel">
        <ProductFilterBar
          query={query}
          onQueryChange={handleSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatus}
          category={category}
          onCategoryChange={handleCategory}
          categories={categories}
          includePilotHidden={includePilotHidden}
          onIncludePilotHiddenChange={(checked) => {
            setIncludePilotHidden(checked);
            setCursor(null);
            setIsDone(false);
            setProducts([]);
          }}
          canManageProducts={canManageProducts}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <Badge>Catalogus</Badge>
          <span className="muted">
            {isLoading
              ? "Bezig met laden..."
              : isDone
                ? `Alle ${total} producten geladen`
                : `${total} producten geladen — meer beschikbaar`}
          </span>
          {!isDone && !isLoading ? (
            <Button
              variant="secondary"
              onClick={() => setCursor(continueCursor)}
            >
              Meer laden
            </Button>
          ) : null}
        </div>
        {error ? <div className="empty-state">{error}</div> : null}
      </section>

      {editingProduct && initialDraft ? (
        <ProductEditPanel
          displayName={editingProduct.weergaveNaam ?? editingProduct.naam}
          initialDraft={initialDraft}
          onSave={handleSaveProduct}
          onCancel={() => setEditingProduct(null)}
          formRef={productEditPanelRef}
        />
      ) : null}

      <ProductListTable
        products={products}
        isLoading={isLoading}
        error={error}
        canManageProducts={canManageProducts}
        onEditProduct={(p) => {
          setEditingProduct(p);
        }}
        onChangeStatus={(product, nextStatus) => {
          setPendingProductStatus({ product, nextStatus });
        }}
      />
    </div>
  );
}
