"use client";

import type { createAuthClient } from "@neondatabase/auth/next";

type AuthClient = ReturnType<typeof createAuthClient>;

let authClientPromise: Promise<AuthClient> | null = null;

export function getAuthClient() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Neon Auth is only available in the browser."));
  }
  authClientPromise ??= import("@neondatabase/auth/next").then(({ createAuthClient: createClient }) => createClient());
  return authClientPromise;
}

export async function getSessionWithTimeout(timeoutMs = 8_000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      getAuthClient().then((client) => client.getSession()),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Session request timed out.")), timeoutMs);
      }),
    ]);
    if (result.error) throw new Error(result.error.message || "Session request failed.");
    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
