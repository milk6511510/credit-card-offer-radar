"use client";

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

const authBaseUrl = typeof window === "undefined" ? "http://localhost/api/auth" : `${window.location.origin}/api/auth`;

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [emailOTPClient()],
});

export async function getSessionWithTimeout(timeoutMs = 8_000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      authClient.getSession(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Session request timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
