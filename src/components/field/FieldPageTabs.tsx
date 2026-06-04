import type { FieldServiceView } from "./FieldServiceWorkspace";
import type { FieldWorkspaceBucket, FieldServiceWorkspaceResult } from "../../lib/portalTypes";

const fieldPages: Array<{
  view: FieldServiceView;
  href: string;
  label: string;
  shortLabel?: string;
  bucket: FieldWorkspaceBucket;
}> = [
  {
    view: "today",
    href: "/portal/buitendienst/vandaag",
    label: "Vandaag",
    bucket: "today"
  },
  {
    view: "measure",
    href: "/portal/buitendienst/inmeten",
    label: "Inmeten",
    bucket: "measure"
  },
  {
    view: "quote",
    href: "/portal/buitendienst/conceptoffertes",
    label: "Conceptoffertes",
    shortLabel: "Offertes",
    bucket: "quote"
  }
];

type FieldPageTabsProps = {
  activeView: FieldServiceView;
  counts: FieldServiceWorkspaceResult["counts"];
};

export function FieldPageTabs({ activeView, counts }: FieldPageTabsProps) {
  return (
    <nav className="field-page-tabs" aria-label="Buitendienst onderdelen">
      {fieldPages.map((page) => {
        const active = page.view === activeView;

        return (
          <a
            aria-current={active ? "page" : undefined}
            className={active ? "field-page-tab active" : "field-page-tab"}
            href={page.href}
            key={page.view}
          >
            <span>{page.label}</span>
            <strong>{counts[page.bucket]}</strong>
          </a>
        );
      })}
    </nav>
  );
}
