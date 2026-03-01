"use client";

import { useState, useEffect } from "react";

const shortcuts = [
  { key: "Esc", description: "Close drawer / clear selection" },
  { key: "?", description: "Toggle this help" },
  { key: "W A S D", description: "Move player on spatial map" },
  { key: "E", description: "Interact with nearby agent" },
];

export function KeyboardShortcutHelp() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = () => setVisible((v) => !v);
    window.addEventListener("toggle-shortcut-help", toggle);
    return () => window.removeEventListener("toggle-shortcut-help", toggle);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setVisible(false)}
    >
      <div
        className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Keyboard Shortcuts
        </h3>
        <div className="space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center gap-4">
              <kbd className="inline-flex min-w-[64px] items-center justify-center rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">
                {key}
              </kbd>
              <span className="text-sm text-slate-400">{description}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Press{" "}
          <kbd className="rounded border border-slate-600 bg-slate-800 px-1 font-mono text-xs">
            ?
          </kbd>{" "}
          or click outside to close
        </p>
      </div>
    </div>
  );
}
