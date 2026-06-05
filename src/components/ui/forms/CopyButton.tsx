import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
};

/**
 * CopyButton — small inline button that copies `value` to the clipboard.
 * Shows a ✓ checkmark for 2 seconds after a successful copy.
 *
 * @example
 * <CopyButton value={customer.phone} label="Telefoonnummer kopiëren" />
 */
export function CopyButton({ value, label = "Kopiëren" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value || copied) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — silent fail
    }
  }

  return (
    <button
      className={`copy-button${copied ? " copy-button--copied" : ""}`}
      aria-label={copied ? "Gekopieerd" : label}
      onClick={handleCopy}
      type="button"
      title={copied ? "Gekopieerd!" : label}
    >
      {copied ? (
        <Check size={13} aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
    </button>
  );
}
