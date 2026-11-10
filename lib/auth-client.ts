"use client";

import { createAuthClient } from "@neondatabase/auth";

const authBaseUrl = typeof window === "undefined" ? "http://localhost/api/auth" : `${window.location.origin}/api/auth`;

export const authClient = createAuthClient(authBaseUrl);
