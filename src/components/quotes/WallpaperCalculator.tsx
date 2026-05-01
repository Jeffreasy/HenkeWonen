import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculateWallpaperRolls,
  type WallpaperCalculationResult
} from "../../lib/wallpaperCalculator";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { SummaryList } from "../ui/SummaryList";

type WallpaperCalculatorProps = {
  onUseResult?: (result: WallpaperCalculationResult) => void;
};

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}

export default function WallpaperCalculator({ onUseResult }: WallpaperCalculatorProps) {
  const [wallWidthM, setWallWidthM] = useState("");
  const [wallHeightM, setWallHeightM] = useState("");
  const [rollWidthCm, setRollWidthCm] = useState("53");
  const [rollLengthM, setRollLengthM] = useState("10.05");
  const [patternRepeatCm, setPatternRepeatCm] = useState("0");
  const [wastePercent, setWastePercent] = useState("10");

  const result = useMemo(
    () =>
      calculateWallpaperRolls({
        wallWidthM: parseDecimal(wallWidthM),
        wallHeightM: parseDecimal(wallHeightM),
        rollWidthCm: parseDecimal(rollWidthCm),
        rollLengthM: parseDecimal(rollLengthM),
        patternRepeatCm: parseDecimal(patternRepeatCm),
        wastePercent: parseDecimal(wastePercent)
      }),
    [patternRepeatCm, rollLengthM, rollWidthCm, wallHeightM, wallWidthM, wastePercent]
  );

  return (
    <section className="wallpaper-calculator">
      <SectionHeader
        compact
        title="Behangcalculator"
        description="Deze berekening is indicatief. Controleer altijd maatvoering, patroonrapport en snijverlies."
      />
      <div className="grid three-column">
        <Field htmlFor="wallpaper-width" label="Wandbreedte (m)">
          <Input
            id="wallpaper-width"
            inputMode="decimal"
            value={wallWidthM}
            onChange={(event) => setWallWidthM(event.target.value)}
          />
        </Field>
        <Field htmlFor="wallpaper-height" label="Wandhoogte (m)">
          <Input
            id="wallpaper-height"
            inputMode="decimal"
            value={wallHeightM}
            onChange={(event) => setWallHeightM(event.target.value)}
          />
        </Field>
        <Field htmlFor="wallpaper-roll-width" label="Rolbreedte (cm)">
          <Input
            id="wallpaper-roll-width"
            inputMode="decimal"
            value={rollWidthCm}
            onChange={(event) => setRollWidthCm(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid three-column">
        <Field htmlFor="wallpaper-roll-length" label="Rollengte (m)">
          <Input
            id="wallpaper-roll-length"
            inputMode="decimal"
            value={rollLengthM}
            onChange={(event) => setRollLengthM(event.target.value)}
          />
        </Field>
        <Field htmlFor="wallpaper-repeat" label="Patroonrapport (cm)">
          <Input
            id="wallpaper-repeat"
            inputMode="decimal"
            value={patternRepeatCm}
            onChange={(event) => setPatternRepeatCm(event.target.value)}
          />
        </Field>
        <Field htmlFor="wallpaper-waste" label="Snijverlies (%)">
          <Input
            id="wallpaper-waste"
            inputMode="decimal"
            value={wastePercent}
            onChange={(event) => setWastePercent(event.target.value)}
          />
        </Field>
      </div>

      {result.validationError ? (
        <Alert variant="warning" title="Controleer invoer" description={result.validationError} />
      ) : (
        <div className="grid">
          <SummaryList
            items={[
              { id: "banen", label: "Banen nodig", value: result.banenNeeded },
              { id: "baanlengte", label: "Baanlengte", value: `${result.baanLengteM.toFixed(2)} m` },
              { id: "per-rol", label: "Banen per rol", value: result.banenPerRol },
              { id: "rollen", label: "Rollen incl. snijverlies", value: result.rollsNeeded }
            ]}
          />
          <div className="wallpaper-calculator-actions">
            <Button
              disabled={!onUseResult}
              leftIcon={<Calculator size={17} aria-hidden="true" />}
              onClick={() => onUseResult?.(result)}
              type="button"
              variant="secondary"
            >
              Gebruik aantal rollen
            </Button>
            <small className="muted">
              Snijverlies verhoogt het basisadvies van {result.baseRollsNeeded} naar{" "}
              {result.rollsNeeded} rollen. Aanbrengen behang blijft een aparte arbeidsregel per rol.
            </small>
          </div>
        </div>
      )}
    </section>
  );
}
