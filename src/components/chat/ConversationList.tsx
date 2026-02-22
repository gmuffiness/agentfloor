"use client";

import { cn } from "@/lib/utils";
import type { Conversation, Vendor } from "@/types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (convId: string) => void;
  onNew: () => void;
}

const vendorDotClass: Record<string, string> = {
  anthropic: "bg-orange-400",
  openai: "bg-emerald-400",
  google: "bg-blue-400",
};

export function ConversationList({ conversations, selectedId, onSelect, onNew }: ConversationListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Conversations
        </h3>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-white"
          title="New conversation"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>

      {/* Conversation items */}
      {conversations.map((conv) => {
        const date = new Date(conv.updatedAt);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const timeStr = isToday
          ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const participants = conv.participants ?? [];
        const displayParticipants = participants.slice(0, 3);
        const extraCount = participants.length - 3;
        const isSelected = selectedId === conv.id;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              "group flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-all",
              isSelected
                ? "bg-slate-700/80 shadow-sm ring-1 ring-slate-600/50"
                : "hover:bg-slate-700/40"
            )}
          >
            {/* Title + timestamp */}
            <div className="flex items-start justify-between gap-2">
              <p className={cn(
                "truncate text-sm font-medium leading-snug",
                isSelected ? "text-white" : "text-slate-200 group-hover:text-white"
              )}>
                {conv.title}
              </p>
              <span className={cn(
                "shrink-0 text-[10px] tabular-nums",
                isSelected ? "text-slate-400" : "text-slate-500"
              )}>
                {timeStr}
              </span>
            </div>

            {/* Participants */}
            {displayParticipants.length > 0 && (
              <div className="flex items-center gap-1">
                {displayParticipants.map((p) => (
                  <span
                    key={p.agentId}
                    title={p.agentName ?? p.agentId}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-600/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", vendorDotClass[p.agentVendor as string] ?? "bg-slate-500")} />
                    {p.agentName ?? "Agent"}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] text-slate-500">+{extraCount}</span>
                )}
              </div>
            )}

            {/* Last message preview */}
            {conv.lastMessage && (
              <p className={cn(
                "truncate text-[11px] leading-snug",
                isSelected ? "text-slate-400" : "text-slate-500"
              )}>
                {conv.lastMessage}
              </p>
            )}
          </button>
        );
      })}

      {conversations.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 px-2 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-xs text-slate-500">No conversations yet</p>
          <button
            onClick={onNew}
            className="rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/30 hover:text-blue-300"
          >
            Start a chat
          </button>
        </div>
      )}
    </div>
  );
}
