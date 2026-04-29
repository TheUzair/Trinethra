import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config used by the middleware.
 * Does NOT import bcrypt, Prisma, or anything else that requires Node.js APIs.
 * Providers with database/crypto access live in `src/auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register") ||
        nextUrl.pathname.startsWith("/forgot-password") ||
        nextUrl.pathname.startsWith("/reset-password");

      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/analyze") ||
        nextUrl.pathname.startsWith("/history");

      if (isProtected && !isLoggedIn) {
        const url = new URL("/login", nextUrl);
        url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
        return Response.redirect(url);
      }

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days (default; sign-in form can request shorter for non-remember)
  },
} satisfies NextAuthConfig;
