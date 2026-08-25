import { auth } from "@/lib/auth";

// Proxies the browser's auth calls through to Neon Auth, attaching the
// signed session cookie. Sign-in, sign-up, sign-out and session refresh
// all flow through here.
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
