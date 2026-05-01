/// <reference types="astro/client" />

import type { AppSession } from "./lib/auth/session";

declare global {
  namespace App {
    interface Locals {
      session: AppSession | null;
    }
  }
}

export {};
