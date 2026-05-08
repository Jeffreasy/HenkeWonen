import { useEffect, useState } from "react";

type ShellLoadingMode = "idle" | "progress" | "blocking";

type ShellLoadingState = {
  mode: ShellLoadingMode;
  title: string;
  description?: string;
};

type ShellLoadingEventDetail = Partial<Omit<ShellLoadingState, "mode">> & {
  mode?: Exclude<ShellLoadingMode, "idle">;
};

const loadingEventName = "henke:shell-loading";
const fieldPathPrefix = "/portal/buitendienst";

declare global {
  interface WindowEventMap {
    [loadingEventName]: CustomEvent<ShellLoadingEventDetail>;
  }
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function internalNavigationTarget(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");

  if (!href || href.startsWith("#") || anchor.hasAttribute("download")) {
    return null;
  }

  if (anchor.target && anchor.target !== "_self") {
    return null;
  }

  const url = new URL(href, window.location.href);

  if (url.origin !== window.location.origin) {
    return null;
  }

  const isSamePage =
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash !== window.location.hash;

  if (isSamePage) {
    return null;
  }

  if (!url.pathname.startsWith("/portal") && url.pathname !== "/login") {
    return null;
  }

  return url;
}

function isFieldPath(pathname: string) {
  return pathname === fieldPathPrefix || pathname.startsWith(`${fieldPathPrefix}/`);
}

function workspaceSwitchLoading(targetUrl: URL): ShellLoadingEventDetail | null {
  const currentPathname = window.location.pathname;
  const targetPathname = targetUrl.pathname;
  const currentIsField = isFieldPath(currentPathname);
  const targetIsField = isFieldPath(targetPathname);

  if (currentIsField === targetIsField) {
    return null;
  }

  if (targetIsField) {
    return {
      mode: "blocking",
      title: "Buitendienst openen",
      description: "De buitendienstomgeving wordt klaargezet."
    };
  }

  return {
    mode: "blocking",
    title: "Winkel openen",
    description: "De winkelomgeving wordt klaargezet."
  };
}

export function ShellLoadingController() {
  const [loading, setLoading] = useState<ShellLoadingState>({
    mode: "idle",
    title: "Pagina openen"
  });

  useEffect(() => {
    function showLoading(detail: ShellLoadingEventDetail) {
      setLoading({
        mode: detail.mode ?? "progress",
        title: detail.title ?? "Bezig met verwerken",
        description: detail.description
      });
    }

    function handleShellLoading(event: WindowEventMap[typeof loadingEventName]) {
      showLoading(event.detail);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const url = internalNavigationTarget(anchor);

      if (!url) {
        return;
      }

      showLoading(
        workspaceSwitchLoading(url) ?? {
          mode: "progress",
          title: "Pagina openen",
          description: "De winkel wordt bijgewerkt."
        }
      );
    }

    function handlePageShow() {
      setLoading({ mode: "idle", title: "Pagina openen" });
    }

    window.addEventListener(loadingEventName, handleShellLoading);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener(loadingEventName, handleShellLoading);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <>
      <div className={loading.mode !== "idle" ? "shell-progress active" : "shell-progress"} aria-hidden="true">
        <span />
      </div>
      {loading.mode === "blocking" ? (
        <div className="shell-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="shell-loading-card">
            <span className="shell-loading-spinner" aria-hidden="true" />
            <p className="shell-loading-title">{loading.title}</p>
            {loading.description ? <p className="shell-loading-description">{loading.description}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
