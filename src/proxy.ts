import { auth } from "@/lib/auth";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
// Page routes redirect to the sign-in screen when signed out. API routes are
// deliberately excluded: they enforce auth themselves via requireUser() so an
// unauthenticated fetch gets a 401 JSON body instead of a login page.
export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
