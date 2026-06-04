import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import type { PortalProduct } from "../../lib/portalTypes";
import { createConvexHttpClient } from "../../lib/convex/client";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ProductFilterBar } from "./ProductFilterBar";
import { ProductEditPanel, type ProductDraft } from "./ProductEditPanel";
import { ProductListTable } from "./ProductListTable";

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

type ProductStatus = PortalProduct["status"];

function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

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
      const client = createConvexHttpClient();
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

      const client = createConvexHttpClient();

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

    const client = createConvexHttpClient();

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
        name: draft.name.trim(),
        articleNumber: draft.articleNumber.trim() || undefined,
        supplierCode: draft.supplierCode.trim() || undefined,
        commercialCode: draft.commercialCode.trim() || undefined,
        colorName: draft.colorName.trim() || undefined,
        supplierProductGroup: draft.supplierProductGroup.trim() || undefined,
        packageContentM2: optionalNumber(draft.packageContentM2),
        piecesPerPackage: optionalNumber(draft.piecesPerPackage),
        status: draft.status
      });
      setEditingProduct(null);
      setReloadKey((current) => current + 1);
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
    const client = createConvexHttpClient();

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
        name: product.name,
        articleNumber: product.articleNumber,
        supplierCode: product.supplierCode,
        commercialCode: product.commercialCode,
        colorName: product.colorName,
        supplierProductGroup: product.supplierProductGroup,
        packageContentM2: product.packageContentM2,
        piecesPerPackage: product.piecesPerPackage,
        status: nextStatus
      });
      setPendingProductStatus(null);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error(saveError);
      setError("Productstatus kon niet worden bijgewerkt.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  const initialDraft: ProductDraft | null = editingProduct
    ? {
        name: editingProduct.name,
        articleNumber: editingProduct.articleNumber ?? "",
        supplierCode: editingProduct.supplierCode ?? "",
        commercialCode: editingProduct.commercialCode ?? "",
        colorName: editingProduct.colorName ?? "",
        supplierProductGroup: editingProduct.supplierProductGroup ?? "",
        packageContentM2: decimalText(editingProduct.packageContentM2),
        piecesPerPackage: decimalText(editingProduct.piecesPerPackage),
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
              ? `Je archiveert "${pendingProductStatus.product.displayName ?? pendingProductStatus.product.name}". Het product verdwijnt uit de actieve catalogus, maar historische data blijft bewaard.`
              : `Je herstelt "${pendingProductStatus.product.displayName ?? pendingProductStatus.product.name}" naar de actieve catalogus.`
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
          displayName={editingProduct.displayName ?? editingProduct.name}
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
