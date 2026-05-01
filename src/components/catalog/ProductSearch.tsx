import { Search } from "lucide-react";

type ProductSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ProductSearch({ value, onChange }: ProductSearchProps) {
  return (
    <label className="field">
      <span>Zoeken</span>
      <span className="toolbar">
        <Search size={17} aria-hidden="true" />
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}
