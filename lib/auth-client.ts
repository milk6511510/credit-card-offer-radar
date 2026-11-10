"use client";

import { createAuthClient } from "better-auth/client";

const authBaseUrl = typeof window === "undefined" ? "http://localhost/api/auth" : `${window.location.origin}/api/auth`;

export const authClient = createAuthClient({ baseURL: authBaseUrl });
