"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm">Hi, {session.user?.name}</span>
        <button onClick={() => signOut()} className="px-3 py-1 rounded border">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => signIn("google")} className="px-3 py-1 rounded border">
      Sign in with Google
    </button>
  );
}
