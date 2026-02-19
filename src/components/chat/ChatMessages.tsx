"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface ChatMessagesProps {
  messages: Message[];
  streamingText?: string;
}

export function ChatMessages({ messages, streamingText }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <p className="text-sm">Send a message to start the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl bg-slate-700 px-4 py-2.5 text-slate-100">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamingText}</p>
              <span className="inline-block h-4 w-1 animate-pulse bg-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
