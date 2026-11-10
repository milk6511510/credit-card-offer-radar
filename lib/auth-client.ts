"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

export async function getSessionWithTimeout(timeoutMs = 8_000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      authClient.getSession(),
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
