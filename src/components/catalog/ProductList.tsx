import { Archive, Pencil, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalProduct } from "../../lib/portalTypes";
import { formatEuro } from "../../lib/money";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatStatusLabel, formatUnit } from "../../lib/i18n/statusLabels";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Input } from "../ui/Input";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";

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
  }>;
};

type ProductStatus = PortalProduct["status"];

const productStatuses: ProductStatus[] = ["draft", "active", "inactive", "archived"];

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
  const [limit, setLimit] = useState(300);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<PortalProduct | null>(null);
  const [productDraft, setProductDraft] = useState({
    name: "",
    articleNumber: "",
    supplierCode: "",
    commercialCode: "",
    colorName: "",
    supplierProductGroup: "",
    packageContentM2: "",
    piecesPerPackage: "",
    status: "active" as ProductStatus
  });
  const [pendingProductStatus, setPendingProductStatus] = useState<{
    product: PortalProduct;
    nextStatus: ProductStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageProducts = canManage(session.role);

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
        const result = (await client.query(api.catalog.listProductsForPortal, {
          tenantSlug: session.tenantId,
          search: query || undefined,
          category: category === "Alle" ? undefined : category,
          status: statusFilter,
          limit
        })) as CatalogResult;

        if (isActive) {
          setProducts(result.items);
          setTotal(result.total);
          setCategories(result.categories ?? []);
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
  }, [category, limit, query, reloadKey, session.tenantId, statusFilter]);

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    setLimit(300);
  }

  function handleCategory(nextCategory: string) {
    setCategory(nextCategory);
    setLimit(300);
  }

  function handleStatus(nextStatus: ProductStatus) {
    setStatusFilter(nextStatus);
    setCategory("Alle");
    setLimit(300);
  }

  function startEditProduct(product: PortalProduct) {
    setEditingProduct(product);
    setProductDraft({
      name: product.name,
      articleNumber: product.articleNumber ?? "",
      supplierCode: product.supplierCode ?? "",
      commercialCode: product.commercialCode ?? "",
      colorName: product.colorName ?? "",
      supplierProductGroup: product.supplierProductGroup ?? "",
      packageContentM2: decimalText(product.packageContentM2),
      piecesPerPackage: decimalText(product.piecesPerPackage),
      status: product.status
    });
  }

  async function saveProduct(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingProduct || !canManageProducts || !productDraft.name.trim()) {
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
      await client.mutation(api.catalog.updateProductForPortal, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        productId: editingProduct.id,
        name: productDraft.name.trim(),
        articleNumber: productDraft.articleNumber.trim() || undefined,
        supplierCode: productDraft.supplierCode.trim() || undefined,
        commercialCode: productDraft.commercialCode.trim() || undefined,
        colorName: productDraft.colorName.trim() || undefined,
        supplierProductGroup: productDraft.supplierProductGroup.trim() || undefined,
        packageContentM2: optionalNumber(productDraft.packageContentM2),
        piecesPerPackage: optionalNumber(productDraft.piecesPerPackage),
        status: productDraft.status
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
      await client.mutation(api.catalog.updateProductForPortal, {
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

  const columns: Array<DataTableColumn<PortalProduct>> = [
    {
      key: "product",
      header: "Product",
      render: (product) => (
        <>
          <strong>{product.name}</strong>
          <div className="muted">
            {[
              product.articleNumber,
              product.supplierCode,
              product.commercialCode,
              product.colorName
            ]
              .filter(Boolean)
              .join(" · ") || "-"}
          </div>
        </>
      )
    },
    {
      key: "category",
      header: "Categorie",
      width: "150px",
      render: (product) => product.category
    },
    {
      key: "supplier",
      header: "Leverancier",
      width: "140px",
      render: (product) => product.supplier
    },
    {
      key: "labels",
      header: "Verkoopnamen",
      hideOnMobile: true,
      render: (product) =>
        product.commercialNames?.length ? (
          <>
            {product.commercialNames.map((name) => (
              <Badge variant="neutral" key={name.displayName} style={{ marginRight: 4 }}>
                {name.displayName}
              </Badge>
            ))}
          </>
        ) : (
          "-"
        )
    },
    {
      key: "unit",
      header: "Eenheid",
      width: "90px",
      render: (product) => formatUnit(product.unit)
    },
    {
      key: "price",
      header: "Prijs excl. btw",
      align: "right",
      width: "120px",
      render: (product) => formatEuro(product.priceExVat)
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (product) => (
        <StatusBadge status={product.status} label={formatStatusLabel(product.status)} />
      )
    },
    {
      key: "actions",
      header: "Acties",
      width: "180px",
      render: (product) =>
        canManageProducts ? (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => startEditProduct(product)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {product.status === "archived" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => setPendingProductStatus({ product, nextStatus: "active" })}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => setPendingProductStatus({ product, nextStatus: "archived" })}
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
        open={Boolean(pendingProductStatus)}
        title={
          pendingProductStatus?.nextStatus === "archived"
            ? "Product archiveren?"
            : "Product herstellen?"
        }
        description={
          pendingProductStatus
            ? pendingProductStatus.nextStatus === "archived"
              ? `Je archiveert "${pendingProductStatus.product.name}". Het product verdwijnt uit de actieve catalogus, maar historische data blijft bewaard.`
              : `Je herstelt "${pendingProductStatus.product.name}" naar de actieve catalogus.`
            : ""
        }
        confirmLabel={pendingProductStatus?.nextStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingProductStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={isSavingProduct}
        onCancel={() => setPendingProductStatus(null)}
        onConfirm={() => void confirmProductStatus()}
      />
      <section className="panel">
        <FilterBar
          search={
            <SearchInput
              aria-label="Zoek in catalogus"
              value={query}
              placeholder="Zoek op product, artikelnummer, kleur of leverancier"
              onChange={handleSearch}
            />
          }
          filters={
            <>
              <Field label="Status" htmlFor="catalog-status-filter">
                <Select
                  id="catalog-status-filter"
                  value={statusFilter}
                  onChange={(event) => handleStatus(event.target.value as ProductStatus)}
                >
                  {productStatuses.map((status) => (
                    <option value={status} key={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Categorie" htmlFor="catalog-category-filter">
                <Select
                  id="catalog-category-filter"
                  value={category}
                  onChange={(event) => handleCategory(event.target.value)}
                >
                  <option value="Alle">
                    Alle ({categories.reduce((sum, item) => sum + item.count, 0)})
                  </option>
                  {categories.map((item) => (
                    <option value={item.name} key={item.name}>
                      {item.name} ({item.count})
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          }
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <Badge>Catalogus</Badge>
          <span className="muted">
            {isLoading ? "Bezig met laden..." : `Toont ${products.length} van ${total} producten`}
          </span>
          {products.length < total ? (
            <Button variant="secondary" onClick={() => setLimit(limit + 300)}>
              Meer laden
            </Button>
          ) : null}
        </div>
        {error ? <div className="empty-state">{error}</div> : null}
      </section>
      {editingProduct ? (
        <section className="panel">
          <SectionHeader
            compact
            title="Catalogusproduct bewerken"
            description="Pas alleen beheerbare verkoopgegevens aan. Prijshistorie en importherkomst blijven bewaard."
            actions={<StatusBadge status={productDraft.status} label={formatStatusLabel(productDraft.status)} />}
          />
          <form className="form-grid" onSubmit={saveProduct}>
            <div className="grid two-column-even">
              <Field htmlFor="product-edit-name" label="Productnaam" required>
                <Input
                  id="product-edit-name"
                  required
                  value={productDraft.name}
                  onChange={(event) =>
                    setProductDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="product-edit-status" label="Status">
                <Select
                  id="product-edit-status"
                  value={productDraft.status}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      status: event.target.value as ProductStatus
                    }))
                  }
                >
                  {productStatuses.map((status) => (
                    <option value={status} key={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid three-column">
              <Field htmlFor="product-edit-article" label="Artikelnummer">
                <Input
                  id="product-edit-article"
                  value={productDraft.articleNumber}
                  onChange={(event) =>
                    setProductDraft((current) => ({ ...current, articleNumber: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="product-edit-supplier-code" label="Leverancierscode">
                <Input
                  id="product-edit-supplier-code"
                  value={productDraft.supplierCode}
                  onChange={(event) =>
                    setProductDraft((current) => ({ ...current, supplierCode: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="product-edit-commercial" label="Verkoopcode">
                <Input
                  id="product-edit-commercial"
                  value={productDraft.commercialCode}
                  onChange={(event) =>
                    setProductDraft((current) => ({ ...current, commercialCode: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid three-column">
              <Field htmlFor="product-edit-color" label="Kleur">
                <Input
                  id="product-edit-color"
                  value={productDraft.colorName}
                  onChange={(event) =>
                    setProductDraft((current) => ({ ...current, colorName: event.target.value }))
                  }
                />
              </Field>
              <Field htmlFor="product-edit-group" label="Leveranciersgroep">
                <Input
                  id="product-edit-group"
                  value={productDraft.supplierProductGroup}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      supplierProductGroup: event.target.value
                    }))
                  }
                />
              </Field>
              <Field htmlFor="product-edit-package" label="Pakinhoud m2">
                <Input
                  id="product-edit-package"
                  inputMode="decimal"
                  value={productDraft.packageContentM2}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      packageContentM2: event.target.value
                    }))
                  }
                />
              </Field>
            </div>
            <div className="toolbar">
              <Button
                isLoading={isSavingProduct}
                leftIcon={<Save size={17} aria-hidden="true" />}
                type="submit"
                variant="primary"
              >
                Product opslaan
              </Button>
              <Button variant="secondary" onClick={() => setEditingProduct(null)}>
                Annuleren
              </Button>
            </div>
          </form>
        </section>
      ) : null}
      <DataTable
        rows={products}
        columns={columns}
        getRowKey={(product) => product.id}
        loading={isLoading}
        error={error}
        emptyTitle="Geen producten gevonden"
        emptyDescription="Pas de zoekopdracht of categoriefilter aan."
        density="compact"
        ariaLabel="Catalogusproducten"
      />
    </div>
  );
}
