import { LogOut } from "lucide-react";
import { useState } from "react";
import { classNames } from "../ui/classNames";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

function showLogoutOverlay() {
  window.dispatchEvent(
    new CustomEvent("henke:shell-loading", {
      detail: {
        mode: "blocking",
        title: "Veilig uitloggen",
        description: "Je sessie wordt afgesloten."
      }
    })
  );
}

export function LogoutButton({ className, label = "Uitloggen" }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    showLogoutOverlay();

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          accept: "application/json"
        }
      });
    } catch (error) {
      console.error("Uitloggen kon de server niet bereiken.", error);
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <button
      aria-busy={isLoggingOut || undefined}
      className={classNames("logout-button", className)}
      disabled={isLoggingOut}
      type="button"
      onClick={() => void logout()}
    >
      <LogOut size={16} aria-hidden="true" />
      <span>{isLoggingOut ? "Uitloggen..." : label}</span>
    </button>
  );
}
