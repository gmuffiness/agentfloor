"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  };

  const canSend = !!text.trim() && !disabled;

  return (
    <div className="border-t border-slate-700/60 bg-slate-900 px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-slate-800 px-4 py-3 transition-colors",
            disabled
              ? "border-slate-700/40 opacity-60"
              : "border-slate-600/60 focus-within:border-slate-500"
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder ?? "Message... (Enter to send, Shift+Enter for newline)"}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
              canSend
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
            title="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-600">
          Press <kbd className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[9px] text-slate-400">Enter</kbd> to send &middot; <kbd className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[9px] text-slate-400">Shift+Enter</kbd> for newline
        </p>
      </div>
    </div>
  );
}
