import { Archive, Pencil, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { formatStatusLabel, formatUnit } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalProduct } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { StatusBadge } from "../ui/StatusBadge";
import { type ProductStatus } from "./catalog/catalogTypes";


type ProductListTableProps = {
  products: PortalProduct[];
  isLoading: boolean;
  error: string | null;
  canManageProducts: boolean;
  onEditProduct: (product: PortalProduct) => void;
  onChangeStatus: (product: PortalProduct, nextStatus: ProductStatus) => void;
};

export function ProductListTable({
  products,
  isLoading,
  error,
  canManageProducts,
  onEditProduct,
  onChangeStatus
}: ProductListTableProps) {
  const columns = useMemo<Array<DataTableColumn<PortalProduct>>>(
    () => [
      {
        key: "product",
        header: "Product",
        render: (product) => (
          <>
            <strong>{product.displayName ?? product.name}</strong>
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
            {product.displayName && product.displayName !== product.name ? (
              <small className="muted">Bron: {product.name}</small>
            ) : null}
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
        render: (product) => (
          <div className="stack-sm">
            <span>{product.displaySupplierName ?? product.supplier}</span>
            {product.displaySupplierName && product.displaySupplierName !== product.supplier ? (
              <small className="muted">Bron: {product.supplier}</small>
            ) : null}
          </div>
        )
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
          <div className="stack-sm">
            <StatusBadge status={product.status} label={formatStatusLabel(product.status)} />
            {product.pilotHiddenReason ? (
              <Badge variant="warning">{product.pilotHiddenReason}</Badge>
            ) : null}
          </div>
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
                onClick={() => onEditProduct(product)}
                size="sm"
                variant="secondary"
              >
                Bewerken
              </Button>
              {product.status === "archived" ? (
                <Button
                  leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                  onClick={() => onChangeStatus(product, "active")}
                  size="sm"
                  variant="secondary"
                >
                  Herstellen
                </Button>
              ) : (
                <Button
                  leftIcon={<Archive size={16} aria-hidden="true" />}
                  onClick={() => onChangeStatus(product, "archived")}
                  size="sm"
                  variant="danger"
                >
                  Archiveren
                </Button>
              )}
            </div>
          ) : null
      }
    ],
    [canManageProducts, onEditProduct, onChangeStatus]
  );

  return (
    <DataTable
      rows={products}
      columns={columns}
      getRowKey={(product) => product.id}
      loading={isLoading}
      error={error}
      emptyTitle="Geen producten gevonden"
      emptyDescription="Pas de zoekopdracht of categoriefilter aan."
      density="compact"
      mobileMode="cards"
      renderMobileCard={(product) => (
        <div className="mobile-card-section">
          <div className="mobile-card-header">
            <div className="mobile-card-title">
              <strong>{product.displayName ?? product.name}</strong>
              <small className="muted">
                {[product.articleNumber, product.supplierCode, product.colorName]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </small>
            </div>
            <StatusBadge status={product.status} label={formatStatusLabel(product.status)} />
          </div>
          <div className="mobile-card-meta">
            <span>{product.category}</span>
            <span>{product.displaySupplierName ?? product.supplier}</span>
            <strong>{formatEuro(product.priceExVat)}</strong>
          </div>
          {canManageProducts ? (
            <div className="mobile-card-actions">
              <Button
                leftIcon={<Pencil size={16} aria-hidden="true" />}
                onClick={() => onEditProduct(product)}
                size="sm"
                variant="secondary"
              >
                Bewerken
              </Button>
              {product.status === "archived" ? (
                <Button
                  leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                  onClick={() => onChangeStatus(product, "active")}
                  size="sm"
                  variant="secondary"
                >
                  Herstellen
                </Button>
              ) : (
                <Button
                  leftIcon={<Archive size={16} aria-hidden="true" />}
                  onClick={() => onChangeStatus(product, "archived")}
                  size="sm"
                  variant="danger"
                >
                  Archiveren
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
      ariaLabel="Catalogusproducten"
    />
  );
}
