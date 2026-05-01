import type { ReactNode } from "react";

type InlineHelpProps = {
  children: ReactNode;
  title?: string;
};

export function InlineHelp({ children, title }: InlineHelpProps) {
  return (
    <span className="inline-help" title={title}>
      {children}
    </span>
  );
}
