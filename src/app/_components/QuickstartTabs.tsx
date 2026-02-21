"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

const tabs = ["Agent", "One-liner", "npm"] as const;
type Tab = (typeof tabs)[number];

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-300">
      <CopyButton text={children.replace(/^# .*\n?/gm, "").trim()} />
      <pre className="overflow-x-auto pr-12">{children}</pre>
    </div>
  );
}

export default function QuickstartTabs() {
  const [active, setActive] = useState<Tab>("Agent");

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Pill toggle */}
      <div className="flex items-center justify-center pt-6 pb-2">
        <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all ${
                active === tab
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6 sm:p-8">
        {active === "One-liner" && (
          <div className="space-y-4">
            <CodeBlock>{`curl -fsSL https://agent-factorio.vercel.app/install.sh | bash`}</CodeBlock>
            <p className="text-xs text-slate-500">
              Works on macOS &amp; Linux. Installs Node.js (if needed) and agent-factorio CLI, then starts login.
            </p>
          </div>
        )}

        {active === "npm" && (
          <div className="space-y-6">
            <div className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-sm font-bold text-emerald-400">
                01
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold">Install &amp; login</h3>
                <CodeBlock>{`npm i -g agent-factorio\nagent-factorio login`}</CodeBlock>
                <p className="text-sm text-slate-400">
                  Email verification, then create a new org or join one with an invite code.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-sm font-bold text-emerald-400">
                02
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold">Push your agent</h3>
                <CodeBlock>{`cd your-agent-project\nagent-factorio push`}</CodeBlock>
                <p className="text-sm text-slate-400">
                  Auto-detects git repo, skills, MCP tools, and CLAUDE.md from your project.
                </p>
              </div>
            </div>
          </div>
        )}

        {active === "Agent" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Tell your AI agent (Claude Code, Cursor, etc.) this prompt:
            </p>
            <CodeBlock>{`Read https://agent-factorio.vercel.app/setup.md and follow the instructions to join AgentFactorio`}</CodeBlock>
            <p className="text-xs text-slate-500">
              The agent will install the CLI, authenticate, and register itself automatically.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-6">
          <a
            href="https://github.com/gmuffiness/agent-factorio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
          <a
            href="https://github.com/gmuffiness/agent-factorio/blob/main/docs/cli.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800"
          >
            CLI Docs
            <span aria-hidden="true">&rarr;</span>
          </a>
          <a
            href="https://www.npmjs.com/package/agent-factorio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800"
          >
            npm
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-4.5h6m0 0v6m0-6L9.75 14.25" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
