import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Home,
  PackageSearch,
  Receipt,
  Ruler,
  Settings,
  type LucideIcon
} from "lucide-react";
import { canManage, canViewFinancials, type AppSession } from "../../lib/auth/session";

export type NavMatch = {
  path: string;
  exact?: boolean;
};

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matches?: NavMatch[];
  adminOnly?: boolean;
  quickbar?: boolean;
  /**
   * Verbergen voor buitendienst-sessies (workspaceMode "field"), ook in de
   * winkel-weergave (?full=1): de backend weigert deze domeinen voor het veld
   * (ensureNotFieldMode), dus de link zou een gegarandeerd dood eind zijn.
   */
  hiddenInFieldMode?: boolean;
  /** Alleen tonen aan rollen die financiële data mogen zien (geen kijker). */
  requiresFinancials?: boolean;
};

export type PortalNavGroup = {
  id: string;
  label: string;
  items: PortalNavItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
};

export const portalNavGroups: PortalNavGroup[] = [
  {
    id: "daily",
    label: "Dagelijks",
    items: [
      { href: "/portal", label: "Start", icon: Home, quickbar: true },
      {
        href: "/portal/dossiers",
        label: "Dossiers",
        icon: BriefcaseBusiness,
        quickbar: true,
        matches: [
          { path: "/portal/dossiers" },
          { path: "/portal/klanten" },
          { path: "/portal/projecten" }
        ]
      },
      { href: "/portal/offertes", label: "Offertes", icon: FileText, quickbar: true },
      {
        href: "/portal/facturen",
        label: "Facturen",
        icon: Receipt,
        matches: [{ path: "/portal/facturen" }],
        hiddenInFieldMode: true,
        requiresFinancials: true
      },
      {
        href: "/portal/catalogus",
        label: "Catalogus",
        icon: PackageSearch,
        matches: [{ path: "/portal/catalogus", exact: true }]
      },
      {
        href: "/portal/buitendienst/vandaag",
        label: "Buitendienst",
        icon: Ruler,
        matches: [{ path: "/portal/buitendienst" }]
      },
      {
        href: "/portal/agenda",
        label: "Agenda",
        icon: CalendarDays,
        quickbar: true,
        matches: [{ path: "/portal/agenda" }]
      }
    ]
  },
  {
    id: "admin",
    label: "Beheer",
    adminOnly: true,
    collapsible: true,
    items: [
      { href: "/portal/beheer", label: "Beheer", icon: Settings, matches: [{ path: "/portal/beheer" }] },
      { href: "/portal/imports", label: "Prijslijsten", icon: ClipboardCheck, matches: [{ path: "/portal/imports" }] },
      {
        href: "/portal/import-profielen",
        label: "Btw controle",
        icon: ClipboardCheck,
        matches: [{ path: "/portal/import-profielen" }]
      },
      {
        href: "/portal/catalogus/data-issues",
        label: "Productcontrole",
        icon: PackageSearch,
        matches: [{ path: "/portal/catalogus/data-issues" }]
      },
      {
        href: "/portal/leveranciers",
        label: "Leveranciers",
        icon: BriefcaseBusiness,
        matches: [{ path: "/portal/leveranciers" }]
      },
      {
        href: "/portal/instellingen/werkzaamheden",
        label: "Werkzaamheden",
        icon: Settings,
        matches: [{ path: "/portal/instellingen/werkzaamheden" }]
      },
      {
        href: "/portal/instellingen/categorieen",
        label: "Productgroepen",
        icon: PackageSearch,
        matches: [{ path: "/portal/instellingen/categorieen" }]
      },
      {
        href: "/portal/instellingen/offertetemplates",
        label: "Offerteteksten",
        icon: FileText,
        matches: [{ path: "/portal/instellingen/offertetemplates" }]
      }
    ]
  }
];

export function getCurrentPathname(pathname?: string) {
  if (pathname) {
    return pathname;
  }

  if (typeof window !== "undefined") {
    return window.location.pathname;
  }

  return "/portal";
}

export function isActiveMatch(currentPathname: string, match: NavMatch) {
  if (match.exact) {
    return currentPathname === match.path;
  }

  return currentPathname === match.path || currentPathname.startsWith(`${match.path}/`);
}

export function isActivePortalItem(currentPathname: string, item: PortalNavItem) {
  const matches = item.matches ?? [{ path: item.href }];

  if (item.href === "/portal" && !item.matches) {
    return currentPathname === item.href;
  }

  return matches.some((match) => isActiveMatch(currentPathname, match));
}

export function visiblePortalNavGroups(session: AppSession) {
  return portalNavGroups
    .filter((group) => !group.adminOnly || canManage(session.role))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.adminOnly || canManage(session.role)) &&
          (!item.hiddenInFieldMode || session.workspaceMode !== "field") &&
          (!item.requiresFinancials || canViewFinancials(session.role))
      )
    }))
    .filter((group) => group.items.length > 0);
}

export function activePortalNavItem(currentPathname: string, groups: PortalNavGroup[]) {
  return groups.flatMap((group) => group.items).find((item) => isActivePortalItem(currentPathname, item));
}

export function activePortalNavGroup(currentPathname: string, groups: PortalNavGroup[]) {
  return groups.find((group) => group.items.some((item) => isActivePortalItem(currentPathname, item)));
}

export function quickbarPortalItems(groups: PortalNavGroup[]) {
  return groups.flatMap((group) => group.items).filter((item) => item.quickbar);
}

export function groupHasActiveItem(group: PortalNavGroup, currentPathname: string) {
  return group.items.some((item) => isActivePortalItem(currentPathname, item));
}

/**
 * Eén bron-van-waarheid voor "staat deze navigatiegroep open": een EXPLICIETE
 * gebruikerskeuze (openGroups) wint altijd; zonder keuze valt 'ie terug op
 * "bevat de actieve pagina". Voorheen won de actieve pagina áltijd, waardoor de
 * Beheer-groep op een beheer-pagina nooit dicht kon — de toggle leek kapot.
 */
export function isPortalGroupOpen(
  group: PortalNavGroup,
  currentPathname: string,
  openGroups: Record<string, boolean>
) {
  if (!group.collapsible) {
    return true;
  }
  return openGroups[group.id] ?? groupHasActiveItem(group, currentPathname);
}

export function roleLabel(role: AppSession["role"]) {
  const labels: Record<AppSession["role"], string> = {
    viewer: "Kijker",
    user: "Gebruiker",
    editor: "Bewerker",
    admin: "Beheerder"
  };

  return labels[role];
}
