import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import type { PortalProduct } from "../../lib/portalTypes";
import { formatEuro } from "../../lib/money";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatUnit } from "../../lib/i18n/statusLabels";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";

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

export default function ProductList({ session }: ProductListProps) {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const [categories, setCategories] = useState<CatalogResult["categories"]>([]);
  const [limit, setLimit] = useState(300);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);

      const client = createConvexHttpClient();

      if (!client) {
        setError("De gegevensverbinding is niet geconfigureerd.");
        setIsLoading(false);
        return;
      }

      try {
        const result = (await client.query(api.catalog.listProductsForPortal, {
          tenantSlug: session.tenantId,
          search: query || undefined,
          category: category === "Alle" ? undefined : category,
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
          setError("Catalogus kon niet worden geladen.");
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
  }, [category, limit, query, session.tenantId]);

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    setLimit(300);
  }

  function handleCategory(nextCategory: string) {
    setCategory(nextCategory);
    setLimit(300);
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
              .join(" | ") || "-"}
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
      header: "Labels",
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
    }
  ];

  return (
    <div className="grid">
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
