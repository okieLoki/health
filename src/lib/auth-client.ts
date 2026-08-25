"use client";
import { createAuthClient } from "@neondatabase/auth/next";

/** Browser-side Neon Auth client, talks to our own /api/auth/[...path] proxy. */
export const authClient = createAuthClient();
