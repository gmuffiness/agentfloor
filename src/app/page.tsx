"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/db/supabase-browser";

const FEATURES = [
  {
    icon: "🗺️",
    title: "Spatial Map",
    desc: "Gather.town-style canvas where departments are rooms and agents are avatars moving in real time.",
  },
  {
    icon: "🔗",
    title: "Relationship Graph",
    desc: "Interactive node graph showing how agents, skills, MCP tools, and plugins connect across your org.",
  },
  {
    icon: "🤖",
    title: "Agent Registry",
    desc: "Register any Claude Code agent with one command. Track vendor, model, skills, and MCP servers.",
  },
  {
    icon: "💬",
    title: "Agent Chat",
    desc: "Talk directly to any agent through a built-in chat interface with full conversation history.",
  },
  {
    icon: "📊",
    title: "Cost Analytics",
    desc: "Per-department and per-vendor cost breakdowns with trend charts and budget tracking.",
  },
  {
    icon: "🔌",
    title: "Plugin System",
    desc: "One-command setup. Agents self-register and send heartbeats on every session start.",
  },
];

const STEPS = [
  { step: "01", title: "Create an org", desc: "Sign in and create your organization in one click." },
  { step: "02", title: "Share the invite code", desc: "Give your team the 6-character code to join." },
  { step: "03", title: "Register agents", desc: "Run /agentfloor:setup in Claude Code to register." },
  { step: "04", title: "Monitor everything", desc: "See all agents on the spatial map, graph, and dashboards." },
];

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const authHref = isLoggedIn ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-2xl">🏘️</span>
            <span className="text-lg font-bold tracking-tight">AgentFloor</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-emerald-500"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-emerald-500"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-24 text-center sm:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Open-source AI fleet management
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
            See every AI agent<br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              on one floor
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            AgentFloor is a centralized monitoring hub for distributed Claude Code agents.
            Departments are rooms, agents are avatars, skills are equipment &mdash;
            giving your entire AI fleet a single pane of glass.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={authHref}
              className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold transition-colors hover:bg-emerald-500"
            >
              Start your project
            </Link>
            <a
              href="https://github.com/gmuffiness/agentfloor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium transition-colors hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything you need to manage your AI fleet</h2>
            <p className="mt-4 text-lg text-slate-400">
              From spatial visualization to cost analytics &mdash; all in one place.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-slate-700 hover:bg-slate-900"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-800/60 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Up and running in minutes</h2>
            <p className="mt-4 text-lg text-slate-400">
              Four steps from zero to full fleet visibility.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-sm font-bold text-emerald-400">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to see your agents?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Create your organization, share the invite code, and start monitoring in minutes.
          </p>
          <Link
            href={authHref}
            className="mt-8 inline-block rounded-lg bg-emerald-600 px-8 py-3.5 text-sm font-semibold transition-colors hover:bg-emerald-500"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span>🏘️</span>
            <span>AgentFloor</span>
          </div>
          <p>&copy; {new Date().getFullYear()} AgentFloor. Open source under MIT.</p>
        </div>
      </footer>
    </div>
  );
}
