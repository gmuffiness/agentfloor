"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { Agent } from "@/types";
import { getVendorColor, getVendorLabel } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useRouter } from "next/navigation";

export interface DialogueOption {
  label: string;
  key: string; // "1", "2", "3"
  action: () => void;
}

interface DialogueOverlayProps {
  agent: Agent;
  orgId: string;
  onClose: () => void;
}

function getActivityText(agent: Agent): string {
  const statusMessages: Record<string, string> = {
    active: "I'm currently working on tasks. Things are running smoothly.",
    idle: "Standing by and ready for new assignments.",
    error: "I've encountered an issue and need some attention.",
  };

  const lines: string[] = [];
  lines.push(statusMessages[agent.status] || "Standing by.");

  if (agent.skills.length > 0) {
    const skillNames = agent.skills.slice(0, 3).map((s) => s.name);
    const suffix = agent.skills.length > 3 ? ` and ${agent.skills.length - 3} more` : "";
    lines.push(`My skills: ${skillNames.join(", ")}${suffix}.`);
  }

  if (agent.monthlyCost > 0) {
    lines.push(`Monthly cost so far: $${agent.monthlyCost.toLocaleString()}.`);
  }

  const lastActive = new Date(agent.lastActive);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    lines.push(`Last active: ${diffMin}m ago.`);
  } else if (diffMin < 1440) {
    lines.push(`Last active: ${Math.floor(diffMin / 60)}h ago.`);
  } else {
    lines.push(`Last active: ${Math.floor(diffMin / 1440)}d ago.`);
  }

  return lines.join(" ");
}

export default function DialogueOverlay({ agent, orgId, onClose }: DialogueOverlayProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const fullText = getActivityText(agent);
  const vendorColor = getVendorColor(agent.vendor);

  const options: DialogueOption[] = [
    {
      label: "View Details",
      key: "1",
      action: () => {
        onClose();
        useAppStore.getState().selectAgent(agent.id);
      },
    },
    {
      label: "Send Message",
      key: "2",
      action: () => {
        onClose();
        router.push(`/org/${orgId}/chat`);
      },
    },
    {
      label: "Dismiss",
      key: "3",
      action: onClose,
    },
  ];

  // Typewriter effect
  useEffect(() => {
    setDisplayedText("");
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= fullText.length) {
        setDisplayedText(fullText);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedText(fullText.slice(0, i));
      }
    }, 18);
    return () => clearInterval(interval);
  }, [fullText]);

  // Keyboard handler
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Skip typewriter on any key
      if (isTyping) {
        setDisplayedText(fullText);
        setIsTyping(false);
        e.preventDefault();
        return;
      }

      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        options[parseInt(e.key) - 1].action();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
        return;
      }

      if (e.key === "Enter" || e.key === "e" || e.key === "E") {
        e.preventDefault();
        options[selectedIndex].action();
        return;
      }
    },
    [isTyping, fullText, onClose, options, selectedIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey, { capture: true });
    return () => window.removeEventListener("keydown", handleKey, { capture: true });
  }, [handleKey]);

  const statusDot: Record<string, string> = {
    active: "bg-green-400",
    idle: "bg-yellow-400",
    error: "bg-red-400",
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main dialogue box */}
        <div className="bg-gray-900/95 border-2 border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] font-mono">
          {/* Top accent bar */}
          <div className="h-1" style={{ backgroundColor: vendorColor }} />

          <div className="flex gap-4 p-4">
            {/* Agent portrait area */}
            <div className="flex-shrink-0 w-20 flex flex-col items-center gap-2">
              {/* Avatar placeholder with vendor color border */}
              <div
                className="w-16 h-16 border-2 bg-gray-800 flex items-center justify-center text-2xl"
                style={{ borderColor: vendorColor }}
              >
                <span className="text-gray-300 text-lg font-bold">
                  {agent.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              {/* Status indicator */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusDot[agent.status] || "bg-gray-400"}`} />
                <span className="text-[10px] text-gray-400 uppercase">{agent.status}</span>
              </div>
            </div>

            {/* Text area */}
            <div className="flex-1 min-w-0">
              {/* Agent name + model badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white font-bold text-sm">{agent.name}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                  style={{ backgroundColor: vendorColor + "22", color: vendorColor }}
                >
                  {getVendorLabel(agent.vendor)} / {agent.model}
                </span>
              </div>

              {/* Dialogue text with typewriter */}
              <div className="text-gray-300 text-xs leading-relaxed min-h-[3rem]">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-1.5 h-3 bg-gray-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Options bar */}
          <div className="border-t border-gray-700 px-4 py-2.5 flex gap-3">
            {options.map((opt, i) => (
              <button
                key={opt.key}
                onClick={opt.action}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  selectedIndex === i
                    ? "bg-blue-600/30 border border-blue-500/60 text-blue-200"
                    : "bg-gray-800/60 border border-gray-600 text-gray-300 hover:bg-gray-700/60 hover:text-white"
                }`}
              >
                <kbd className="bg-gray-700 border border-gray-500 px-1 py-0.5 text-[10px] text-amber-200 rounded-sm">
                  {opt.key}
                </kbd>
                <span>{opt.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-gray-500 self-center">ESC to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
