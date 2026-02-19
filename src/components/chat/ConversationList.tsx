"use client";

import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (convId: string) => void;
  onNew: () => void;
}

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
            <p className="truncate text-sm font-medium">{conv.title}</p>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="truncate text-[11px] text-slate-500">{conv.lastMessage ?? "No messages"}</p>
              <span className="ml-2 shrink-0 text-[10px] text-slate-600">{timeStr}</span>
            </div>
          </button>
        );
      })}
      {conversations.length === 0 && (
        <p className="px-2 text-xs text-slate-500">No conversations yet</p>
      )}
    </div>
  );
}
