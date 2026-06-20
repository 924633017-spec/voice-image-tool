import NextAuth from "next-auth";

// Lightweight edge-compatible auth for middleware.
// No database adapter — only JWT verification for route protection.
export const { auth, handlers } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuth = !!auth?.user;
      const { pathname } = nextUrl;

      // Public routes
      const publicPaths = ["/", "/login", "/register"];
      if (
        publicPaths.includes(pathname) ||
        pathname.startsWith("/play/") ||
        pathname.startsWith("/uploads/") ||
        pathname.startsWith("/image/") ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/_next/")
      ) {
        return true;
      }

      // Protected routes
      if (!isAuth) {
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
});
