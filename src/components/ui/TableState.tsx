import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

type TableStateProps = {
  state: "loading" | "error" | "empty";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function TableState({ state, title, description, action }: TableStateProps) {
  if (state === "loading") {
    return <LoadingState title={title} description={description} />;
  }

  if (state === "error") {
    return <ErrorState title={title} description={description} retryAction={action} />;
  }

  return <EmptyState title={title} description={description} action={action} />;
}
