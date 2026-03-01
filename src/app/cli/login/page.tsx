"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

type Status = "loading" | "sign-in" | "verifying" | "success" | "error";

export default function CliLoginPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loginToken, setLoginToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setStatus("error");
      setMessage("Missing Supabase configuration.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("loginToken");

    if (!token) {
      setStatus("error");
      setMessage("Missing login token. Please run `agent-factorio login` from your terminal.");
      return;
    }

    setLoginToken(token);
    const client = createClient(url, anonKey);
    setSupabase(client);

    // Check if user is already signed in
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Already signed in — verify immediately
        verifySession(token, session.user.id, session.user.email || "", session.access_token);
      } else {
        setStatus("sign-in");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifySession = useCallback(async (token: string, userId: string, userEmail: string, accessToken: string) => {
    setStatus("verifying");
    setMessage("Completing login...");

    try {
      const res = await fetch("/api/cli/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ loginToken: token, userId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setMessage(data?.error || "Verification failed. Please try again.");
        return;
      }

      setStatus("success");
      setMessage(userEmail);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }, []);

  // Listen for auth state changes (magic link callback)
  useEffect(() => {
    if (!supabase || !loginToken) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: { user?: { id: string; email?: string }; access_token: string } | null) => {
        if (event === "SIGNED_IN" && session?.user && status === "sign-in") {
          await verifySession(
            loginToken,
            session.user.id,
            session.user.email || "",
            session.access_token,
          );
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase, loginToken, status, verifySession]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email || !loginToken) return;

    setEmailSent(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/cli/login?loginToken=${loginToken}`,
      },
    });

    if (error) {
      setEmailSent(false);
      setMessage(`Failed to send email: ${error.message}`);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase || !loginToken) return;

    const nextPath = `/cli/login?loginToken=${loginToken}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8">

        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
            <p className="text-zinc-400">Loading...</p>
          </div>
        )}

        {/* Sign In Form */}
        {status === "sign-in" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold">AgentFactorio CLI</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Sign in to connect your terminal
              </p>
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs text-zinc-500">or</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* Email Magic Link */}
            {!emailSent ? (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Continue with Email
                </button>
              </form>
            ) : (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-center">
                <p className="text-sm text-zinc-300">Check your email for a sign-in link</p>
                <p className="mt-1 text-xs text-zinc-500">{email}</p>
              </div>
            )}
          </div>
        )}

        {/* Verifying */}
        {status === "verifying" && (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
            <p className="text-zinc-400">{message}</p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">You&apos;re all set!</h2>
              <p className="mt-1 text-sm text-zinc-400">
                You can now close this window.
              </p>
            </div>
            {message && (
              <p className="text-xs text-zinc-500">
                Signed in as {message}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
