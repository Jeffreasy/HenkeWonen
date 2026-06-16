import { StatCard } from "../ui/data-display/StatCard";

type SupplierStatsProps = {
  total: number;
  available: number;
  followUp: number;
  linkedProducts: number;
  sourceFiles: number;
};

export function SupplierStats({
  total,
  available,
  followUp,
  linkedProducts,
  sourceFiles
}: SupplierStatsProps) {
  return (
    <section className="grid dashboard-grid">
      <StatCard label="Totaal leveranciers" value={total} tone="neutral" />
      <StatCard
        label="Productlijst beschikbaar"
        value={available}
        description="Ontvangen of download beschikbaar"
        tone="success"
      />
      <StatCard
        label="Opvolging nodig"
        value={followUp}
        description="Onbekend of opgevraagd"
        tone={followUp > 0 ? "warning" : "success"}
      />
      <StatCard
        label="Catalogusproducten"
        value={linkedProducts}
        description={`${sourceFiles} prijslijstbestanden gekoppeld`}
        tone="info"
      />
    </section>
  );
}
