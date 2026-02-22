"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Organization, Agent, Department } from "@/types";

type EventType = "status" | "deployed" | "budget" | "performer" | "idle" | "error";

interface FeedEvent {
  id: string;
  type: EventType;
  icon: string;
  message: string;
  timestamp: Date;
  fadingOut: boolean;
}

interface EventFeedProps {
  organization: Organization;
}

const EVENT_BORDER_COLORS: Record<EventType, string> = {
  status: "border-l-green-500",
  deployed: "border-l-blue-500",
  budget: "border-l-yellow-500",
  performer: "border-l-purple-500",
  idle: "border-l-gray-500",
  error: "border-l-red-500",
};

const EVENT_ICON_COLORS: Record<EventType, string> = {
  status: "text-green-400",
  deployed: "text-blue-400",
  budget: "text-yellow-400",
  performer: "text-purple-400",
  idle: "text-gray-400",
  error: "text-red-400",
};

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function generateInitialEvents(organization: Organization): FeedEvent[] {
  const events: FeedEvent[] = [];
  const now = Date.now();

  const allAgents: { agent: Agent; dept: Department }[] = [];
  for (const dept of organization.departments) {
    for (const agent of dept.agents) {
      allAgents.push({ agent, dept });
    }
  }

  if (allAgents.length === 0) return events;

  // Agent status events
  for (const { agent, dept } of allAgents.slice(0, 3)) {
    if (agent.status === "active") {
      events.push({
        id: `init-status-${agent.id}`,
        type: "status",
        icon: ">>",
        message: `${agent.name} is active in ${dept.name}`,
        timestamp: new Date(now - Math.random() * 120_000),
        fadingOut: false,
      });
    } else if (agent.status === "error") {
      events.push({
        id: `init-error-${agent.id}`,
        type: "error",
        icon: "!!",
        message: `${agent.name} encountered an error`,
        timestamp: new Date(now - Math.random() * 90_000),
        fadingOut: false,
      });
    }
  }

  // Budget warning events
  for (const dept of organization.departments) {
    if (dept.budget > 0) {
      const pct = Math.round((dept.monthlySpend / dept.budget) * 100);
      if (pct >= 75) {
        events.push({
          id: `init-budget-${dept.id}`,
          type: "budget",
          icon: "**",
          message: `${dept.name} at ${pct}% budget ($${dept.monthlySpend.toLocaleString()}/$${dept.budget.toLocaleString()})`,
          timestamp: new Date(now - Math.random() * 60_000),
          fadingOut: false,
        });
      }
    }
  }

  // High performer events
  const topAgent = [...allAgents].sort((a, b) => b.agent.tokensUsed - a.agent.tokensUsed)[0];
  if (topAgent) {
    events.push({
      id: `init-perf-${topAgent.agent.id}`,
      type: "performer",
      icon: "^^",
      message: `${topAgent.agent.name}: ${(topAgent.agent.tokensUsed / 1000).toFixed(0)}K tokens used this month`,
      timestamp: new Date(now - Math.random() * 180_000),
      fadingOut: false,
    });
  }

  // Idle agents
  const idleAgents = allAgents.filter(({ agent }) => agent.status === "idle");
  if (idleAgents.length > 0) {
    const { agent } = idleAgents[0];
    const lastActive = new Date(agent.lastActive);
    const idleMinutes = Math.round((now - lastActive.getTime()) / 60_000);
    const idleLabel = idleMinutes >= 60
      ? `${Math.floor(idleMinutes / 60)}h ago`
      : `${idleMinutes}m ago`;
    events.push({
      id: `init-idle-${agent.id}`,
      type: "idle",
      icon: "..",
      message: `${agent.name} has been idle since ${idleLabel}`,
      timestamp: new Date(now - Math.random() * 150_000),
      fadingOut: false,
    });
  }

  // Sort by timestamp ascending (oldest first, newest at bottom)
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return events.slice(-10);
}

function generateRandomEvent(organization: Organization): FeedEvent | null {
  const allAgents: { agent: Agent; dept: Department }[] = [];
  for (const dept of organization.departments) {
    for (const agent of dept.agents) {
      allAgents.push({ agent, dept });
    }
  }

  if (allAgents.length === 0) return null;

  const pick = Math.random();
  const idx = Math.floor(Math.random() * allAgents.length);
  const { agent, dept } = allAgents[idx];
  const now = new Date();

  if (pick < 0.25) {
    const isActive = Math.random() > 0.3;
    return {
      id: `evt-${Date.now()}-status`,
      type: isActive ? "status" : "error",
      icon: isActive ? ">>" : "!!",
      message: isActive
        ? `${agent.name} is now active`
        : `${agent.name} encountered an error`,
      timestamp: now,
      fadingOut: false,
    };
  } else if (pick < 0.45) {
    const deptIdx = Math.floor(Math.random() * organization.departments.length);
    const d = organization.departments[deptIdx];
    return {
      id: `evt-${Date.now()}-deploy`,
      type: "deployed",
      icon: "++",
      message: `New agent deployed to ${d.name}`,
      timestamp: now,
      fadingOut: false,
    };
  } else if (pick < 0.65) {
    const d = organization.departments[Math.floor(Math.random() * organization.departments.length)];
    if (d.budget <= 0) return null;
    const pct = Math.round((d.monthlySpend / d.budget) * 100);
    return {
      id: `evt-${Date.now()}-budget`,
      type: "budget",
      icon: "**",
      message: `${d.name} at ${pct}% budget ($${d.monthlySpend.toLocaleString()}/$${d.budget.toLocaleString()})`,
      timestamp: now,
      fadingOut: false,
    };
  } else if (pick < 0.80) {
    return {
      id: `evt-${Date.now()}-perf`,
      type: "performer",
      icon: "^^",
      message: `${agent.name}: ${(agent.tokensUsed / 1000).toFixed(0)}K tokens used this month`,
      timestamp: now,
      fadingOut: false,
    };
  } else {
    return {
      id: `evt-${Date.now()}-idle`,
      type: "idle",
      icon: "..",
      message: `${agent.name} has been idle since ${dept.name}`,
      timestamp: now,
      fadingOut: false,
    };
  }
}

export default function EventFeed({ organization }: EventFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [visible, setVisible] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<FeedEvent[]>([]);

  // Keep ref in sync
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Initialize events from org data
  useEffect(() => {
    if (!organization.id) return;
    const initial = generateInitialEvents(organization);
    setEvents(initial);
  }, [organization.id]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length]);

  // Age out events: fade after 10s, remove after 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setEvents((prev) => {
        const updated = prev
          .map((evt) => {
            const age = now - evt.timestamp.getTime();
            if (age >= 10_000 && !evt.fadingOut) {
              return { ...evt, fadingOut: true };
            }
            return evt;
          })
          .filter((evt) => {
            const age = now - evt.timestamp.getTime();
            return age < 30_000;
          });
        return updated;
      });
    }, 2_000);
    return () => clearInterval(interval);
  }, []);

  // Simulate new events every 15-20 seconds
  useEffect(() => {
    if (!organization.id) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = 15_000 + Math.random() * 5_000;
      timeoutId = setTimeout(() => {
        const evt = generateRandomEvent(organization);
        if (evt) {
          setEvents((prev) => {
            const updated = [...prev, evt];
            return updated.slice(-10);
          });
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [organization.id]);

  const toggleVisible = useCallback(() => setVisible((v) => !v), []);

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1">
      {/* Toggle button */}
      <button
        onClick={toggleVisible}
        className="bg-gray-900/80 border border-gray-600 px-2 py-1 font-mono text-[9px] text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors cursor-pointer select-none shadow-[1px_1px_0px_0px_rgba(0,0,0,0.6)]"
        title={visible ? "Hide event feed" : "Show event feed"}
      >
        {visible ? "[--]" : "[>>]"} FEED
      </button>

      {/* Feed panel */}
      {visible && (
        <div className="w-[300px] pointer-events-none">
          <div
            ref={listRef}
            className="pointer-events-auto flex flex-col gap-0.5 max-h-[280px] overflow-y-auto scrollbar-thin"
            style={{ scrollbarWidth: "none" }}
          >
            {events.length === 0 && (
              <div className="bg-gray-900/60 border-l-2 border-l-gray-700 px-2 py-1 font-mono text-[8px] text-gray-600">
                -- no events --
              </div>
            )}
            {events.map((evt) => (
              <div
                key={evt.id}
                className={cn(
                  "border-l-2 px-2 py-1 font-mono text-[8px] leading-relaxed bg-gray-900/70",
                  "animate-[slideInRight_0.2s_ease-out]",
                  EVENT_BORDER_COLORS[evt.type],
                  evt.fadingOut ? "opacity-40" : "opacity-100",
                  "transition-opacity duration-1000",
                )}
              >
                <span className="text-gray-500 mr-1.5">{formatTimestamp(evt.timestamp)}</span>
                <span className={cn("mr-1.5 font-bold", EVENT_ICON_COLORS[evt.type])}>
                  {evt.icon}
                </span>
                <span className="text-gray-200 break-words">{evt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
