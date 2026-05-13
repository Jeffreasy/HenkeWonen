type CommercialName = {
  brandName: string;
  collectionName?: string;
  colorName?: string;
  displayName: string;
};

type PilotProductLike = {
  name: string;
  productKind?: string;
  commercialNames?: CommercialName[];
};

function normalized(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

export function pilotHiddenReason(product: PilotProductLike, categoryName?: string) {
  if (normalized(categoryName) === "pvc click") {
    return "PVC Click verborgen voor pilot";
  }

  if (normalized(product.productKind) === "click") {
    return "PVC click verborgen voor pilot";
  }

  return undefined;
}

export function isPilotHiddenProduct(product: PilotProductLike, categoryName?: string) {
  return Boolean(pilotHiddenReason(product, categoryName));
}

export function isPvcProduct(product: PilotProductLike, categoryName?: string, supplierName?: string) {
  const values = [categoryName, product.productKind, supplierName, product.name].map(normalized);

  return values.some((value) => value.includes("pvc") || value === "dryback" || value === "src");
}

export function displaySupplierName(supplierName: string) {
  return normalized(supplierName) === "roots" ? "Moduleo" : supplierName;
}

export function displayProductName(
  product: PilotProductLike,
  categoryName?: string,
  supplierName?: string
) {
  const isPvc = isPvcProduct(product, categoryName, supplierName);
  const floorlifeName = product.commercialNames?.find(
    (name) => normalized(name.brandName) === "floorlife"
  );

  if (floorlifeName && isPvc) {
    return floorlifeName.displayName;
  }

  if (isPvc && (normalized(supplierName) === "roots" || /\broots\b/i.test(product.name))) {
    return product.name
      .replace(/\bMOD ROOTS\b/gi, "Moduleo")
      .replace(/\bROOTS\b/gi, "Moduleo")
      .replace(/\bRoots\b/g, "Moduleo");
  }

  return product.name;
}

export function visibleCommercialNames(product: PilotProductLike, categoryName?: string) {
  if (!product.commercialNames?.length) {
    return product.commercialNames;
  }

  if (!isPvcProduct(product, categoryName)) {
    return product.commercialNames;
  }

  const withoutAmbiant = product.commercialNames.filter(
    (name) => normalized(name.brandName) !== "ambiant"
  );

  return withoutAmbiant.length ? withoutAmbiant : product.commercialNames;
}
