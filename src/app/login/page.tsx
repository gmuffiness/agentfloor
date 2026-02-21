"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/db/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Parse error from URL hash fragment (Supabase redirects errors here)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        setError(decodeURIComponent(errorDesc));
      }
      // Clean up the URL
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  const handleOAuth = async (provider: "google" | "azure") => {
    setLoading(provider);
    setError("");
    const supabase = getSupabaseBrowser();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(null);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading("email");
    setError("");
    setMessage("");

    const supabase = getSupabaseBrowser();
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (magicError) {
      setError(magicError.message);
      setLoading(null);
      return;
    }

    setMessage("Check your email for the login link!");
    setLoading(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo */}
        <div className="text-center">
          <img src="/agentfactorio_logo_no_title.png" alt="AgentFactorio" className="h-24 w-24" />
          <h1 className="mt-3 text-2xl font-bold">AgentFactorio</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to manage your AI agent fleet
          </p>
        </div>

        {/* Email Magic Link */}
        <div className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            disabled={loading !== null}
          />
          <button
            onClick={handleMagicLink}
            disabled={loading !== null || !email.trim()}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading === "email" ? "Sending..." : "Continue with Email"}
          </button>
        </div>

        {message && (
          <p className="text-center text-sm text-emerald-400">{message}</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs text-slate-500">OR</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* SSO Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading === "google" ? "Redirecting..." : "Continue with Google"}
          </button>

          <button
            onClick={() => handleOAuth("azure")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            {loading === "azure" ? "Redirecting..." : "Continue with Microsoft"}
          </button>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-300">
            &larr; Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
