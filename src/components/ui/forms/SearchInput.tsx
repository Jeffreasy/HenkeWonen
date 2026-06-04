import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { IconButton } from "./IconButton";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
};

export function SearchInput({ value, onChange, placeholder, ...props }: SearchInputProps) {
  return (
    <div className="search-input">
      <Search className="search-input-icon" size={17} aria-hidden="true" />
      <input
        {...props}
        className="search-input-control"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <IconButton
          aria-label="Zoekopdracht wissen"
          className="search-input-clear"
          size="sm"
          variant="ghost"
          onClick={() => onChange("")}
        >
          <X size={15} aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}
