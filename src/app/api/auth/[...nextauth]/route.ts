import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // include Calendar-ready scopes now so you don’t have to re-consent later
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          prompt: "consent", // forces refresh_token on each consent
          access_type: "offline", // needed for refresh_token
          response_type: "code",
        },
      },
      httpOptions: { timeout: 15000 },
    }),
  ],
  session: { strategy: "jwt" }, // simple to start; no DB adapter needed yet
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      // First login: persist provider tokens if present
      if (account) {
        token.provider = account.provider;
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at; // seconds since epoch
      }
      // Basic example: attach name/email/photo
      if (profile) {
        token.name = profile.name ?? token.name;
        token.email = profile.email ?? token.email;
        // @ts-ignore
        token.picture = profile.picture ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose bits of the JWT to the client session
      (session as any).provider = token.provider;
      (session as any).access_token = token.access_token;
      (session as any).refresh_token = token.refresh_token;
      (session as any).expires_at = token.expires_at;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
