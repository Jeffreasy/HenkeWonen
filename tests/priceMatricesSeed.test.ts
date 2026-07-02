import { describe, expect, test } from "vitest";
import { priceMatricesSeed } from "../convex/catalog/priceMatricesSeed";

// lookupMatrixPrice indexeert prijzen[hoogte][breedte] en rondt omhoog naar de
// eerstvolgende as-klasse; dat veronderstelt rechthoekige matrices met strikt
// oplopende assen. Deze test bewaakt die aannames voor de seed-data, zodat een
// toekomstige seed-wijziging nooit stilletjes null-prijzen kan veroorzaken.
describe("priceMatricesSeed integriteit", () => {
  test("elke matrix is rechthoekig en heeft strikt oplopende assen", () => {
    const fouten: string[] = [];
    for (const m of priceMatricesSeed) {
      const label = `${m.productToolSleutel}/${m.prijsgroep}`;
      if (m.prijzen.length !== m.hoogteAs.length) {
        fouten.push(`${label}: ${m.prijzen.length} prijsrijen vs ${m.hoogteAs.length} hoogtes`);
      }
      m.prijzen.forEach((rij, i) => {
        if (rij.length !== m.breedteAs.length) {
          fouten.push(`${label}: rij ${i} heeft ${rij.length} kolommen vs ${m.breedteAs.length} breedtes`);
        }
      });
      const striktOplopend = (arr: number[]) => arr.every((v, i) => i === 0 || arr[i - 1] < v);
      if (!striktOplopend(m.breedteAs)) fouten.push(`${label}: breedte-as niet strikt oplopend`);
      if (!striktOplopend(m.hoogteAs)) fouten.push(`${label}: hoogte-as niet strikt oplopend`);
    }
    expect(fouten).toEqual([]);
    expect(priceMatricesSeed.length).toBeGreaterThan(0);
  });
});
