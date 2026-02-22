"use client";

import { cn, getVendorLabel } from "@/lib/utils";
import type { Message, Vendor } from "@/types";

const vendorBadgeClass: Record<string, string> = {
  anthropic: "bg-orange-500/20 text-orange-300",
  openai: "bg-emerald-500/20 text-emerald-300",
  google: "bg-blue-500/20 text-blue-300",
};

interface MessageBubbleProps {
  message: Message;
}

function renderMarkdownLike(text: string) {
  // Simple inline markdown: **bold**, `code`, newlines
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-slate-600/60 px-1 py-0.5 font-mono text-[12px] text-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function AgentAvatar({ name, vendor }: { name: string; vendor?: string }) {
  const initials = name
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const bgColor =
    vendor === "anthropic"
      ? "bg-orange-500/20 text-orange-300 ring-orange-500/30"
      : vendor === "openai"
      ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
      : vendor === "google"
      ? "bg-blue-500/20 text-blue-300 ring-blue-500/30"
      : "bg-slate-600/40 text-slate-300 ring-slate-500/30";

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 text-[11px] font-bold",
        bgColor
      )}
    >
      {initials || "A"}
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="flex max-w-[75%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-white shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          </div>
          <span className="px-1 text-[10px] text-slate-500">{time}</span>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600/40 ring-1 ring-slate-500/30 text-[11px] font-bold text-slate-300">
          You
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2.5">
      <AgentAvatar name={message.agentName ?? "Agent"} vendor={message.agentVendor ?? undefined} />
      <div className="flex max-w-[75%] flex-col gap-1">
        {message.agentName && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-slate-200">{message.agentName}</span>
            {message.agentVendor && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  vendorBadgeClass[message.agentVendor] ?? "bg-slate-600/40 text-slate-300"
                )}
              >
                {getVendorLabel(message.agentVendor as Vendor)}
              </span>
            )}
          </div>
        )}
        <div className="rounded-2xl rounded-tl-sm bg-slate-700/70 px-4 py-2.5 text-slate-100 shadow-sm ring-1 ring-slate-600/30">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {renderMarkdownLike(message.content)}
          </p>
        </div>
        <span className="px-1 text-[10px] text-slate-500">{time}</span>
      </div>
    </div>
  );
}
