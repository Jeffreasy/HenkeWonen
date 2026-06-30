import { useEffect, useState } from "react";
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

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

function isFieldPath(pathname: string) {
  return pathname === fieldPathPrefix || pathname.startsWith(`${fieldPathPrefix}/`);
}

/**
 * Een wissel tussen winkel- en buitendienstomgeving is een "zware" switch (andere
 * shell): toon dan een blokkerende overlay i.p.v. alleen de top-progressbar.
 */
function workspaceSwitchLoading(toPathname: string): ShellLoadingEventDetail | null {
  const currentIsField = isFieldPath(window.location.pathname);
  const targetIsField = isFieldPath(toPathname);

  if (currentIsField === targetIsField) {
    return null;
  }

  return targetIsField
    ? {
        mode: "blocking",
        title: "Buitendienst openen",
        description: "De buitendienstomgeving wordt klaargezet."
      }
    : {
        mode: "blocking",
        title: "Winkel openen",
        description: "De winkelomgeving wordt klaargezet."
      };
}

/**
 * Stuurt de navigatie-feedback (top-progressbar + blokkerende overlay) aan op basis
 * van Astro View Transitions: starten bij `astro:before-preparation`, opruimen na
 * `astro:after-swap`/`astro:page-load`. Zo krijgt élke navigatie (link, back/forward,
 * programmatisch) feedback — i.p.v. alleen herkende link-clicks — en loopt de bar niet
 * meer vast. De blokkerende overlay luistert daarnaast nog op het custom shell-event
 * (bv. uitloggen).
 */
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

    function handleBeforePreparation(event: TransitionBeforePreparationEvent) {
      showLoading(
        workspaceSwitchLoading(event.to.pathname) ?? {
          mode: "progress",
          title: "Pagina openen"
        }
      );
    }

    function handleNavigationDone() {
      setLoading({ mode: "idle", title: "Pagina openen" });
    }

    window.addEventListener(loadingEventName, handleShellLoading);
    document.addEventListener("astro:before-preparation", handleBeforePreparation);
    document.addEventListener("astro:after-swap", handleNavigationDone);
    document.addEventListener("astro:page-load", handleNavigationDone);

    return () => {
      window.removeEventListener(loadingEventName, handleShellLoading);
      document.removeEventListener("astro:before-preparation", handleBeforePreparation);
      document.removeEventListener("astro:after-swap", handleNavigationDone);
      document.removeEventListener("astro:page-load", handleNavigationDone);
    };
  }, []);

  return (
    <>
      <div
        className={loading.mode !== "idle" ? "shell-progress active" : "shell-progress"}
        aria-hidden="true"
      >
        <span />
      </div>
      {loading.mode === "blocking" ? (
        <output className="shell-loading-overlay" aria-live="polite" aria-busy="true">
          <div className="shell-loading-card">
            <span className="shell-loading-spinner" aria-hidden="true" />
            <p className="shell-loading-title">{loading.title}</p>
            {loading.description ? (
              <p className="shell-loading-description">{loading.description}</p>
            ) : null}
          </div>
        </output>
      ) : null}
    </>
  );
}
