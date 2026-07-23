export type StairMaterialCatalogFilter = {
  family: "stair_renovation";
  covering: "pvc";
};

export const PVC_STAIR_MATERIAL_FILTER: StairMaterialCatalogFilter = {
  family: "stair_renovation",
  covering: "pvc"
};

export function matchesStairMaterialCatalogFilter(
  metadata: { family?: unknown; covering?: unknown } | undefined,
  filter: StairMaterialCatalogFilter
): boolean {
  return metadata?.family === filter.family && metadata.covering === filter.covering;
}
