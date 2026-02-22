"use client";

import { cn, getVendorLabel } from "@/lib/utils";
import type { Conversation, Vendor } from "@/types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (convId: string) => void;
  onNew: () => void;
}

const vendorDotClass: Record<string, string> = {
  anthropic: "bg-orange-400",
  openai: "bg-green-400",
  google: "bg-blue-400",
};

export function ConversationList({ conversations, selectedId, onSelect, onNew }: ConversationListProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Conversations
        </h3>
        <button
          onClick={onNew}
          className="rounded px-2 py-0.5 text-xs text-blue-400 hover:bg-slate-800"
        >
          + New
        </button>
      </div>
      {conversations.map((conv) => {
        const date = new Date(conv.updatedAt);
        const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const participants = conv.participants ?? [];
        const displayParticipants = participants.slice(0, 3);
        const extraCount = participants.length - 3;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-left transition-colors",
              selectedId === conv.id
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800"
            )}
          >
            <p className={cn(
              "truncate text-sm font-medium",
              selectedId === conv.id ? "text-white" : "text-slate-300"
            )}>{conv.title}</p>
            {participants.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                {displayParticipants.map((p) => (
                  <span
                    key={p.agentId}
                    title={p.agentName ?? p.agentId}
                    className={cn(
                      "inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium",
                      "bg-slate-600/80 text-slate-200"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", vendorDotClass[p.agentVendor as string] ?? "bg-slate-500")} />
                    {p.agentName ?? "Agent"}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] text-slate-400">+{extraCount}</span>
                )}
              </div>
            )}
            <div className="mt-0.5 flex items-center justify-between">
              <p className="truncate text-[11px] text-slate-400">{conv.lastMessage ?? "No messages"}</p>
              <span className="ml-2 shrink-0 text-[10px] text-slate-400">{timeStr}</span>
            </div>
          </button>
        );
      })}
      {conversations.length === 0 && (
        <p className="px-2 text-xs text-slate-400">No conversations yet</p>
      )}
    </div>
  );
}
