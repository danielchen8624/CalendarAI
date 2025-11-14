import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const scopes = [
  "openid","email","profile",
  "https://www.googleapis.com/auth/calendar" // read/write
].join(" ");

async function refreshAccessToken(refresh_token: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token,
    }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  return {
    access_token: t.access_token as string,
    expires_at: Date.now() + (t.expires_in as number) * 1000,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes,
          access_type: "offline",
          prompt: "consent",                 // one-time to get refresh_token
          include_granted_scopes: "true",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: stash tokens on the JWT (cookie)
      if (account?.access_token) {
        token.access_token = account.access_token as string;
        token.expires_at = Date.now() + (account.expires_in as number) * 1000;
        if (account.refresh_token) token.refresh_token = account.refresh_token as string;
      }
      // Auto-refresh when expired
      if (token.expires_at && Date.now() > (token.expires_at as number) && token.refresh_token) {
        const refreshed = await refreshAccessToken(token.refresh_token as string);
        if (refreshed) {
          token.access_token = refreshed.access_token;
          token.expires_at = refreshed.expires_at;
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).access_token = token.access_token;
      (session as any).expires_at = token.expires_at;
      (session as any).google_refresh = token.refresh_token; // not used client-side, but handy if needed
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
