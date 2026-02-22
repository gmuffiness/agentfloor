"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { cn } from "@/lib/utils";

const navItems = [
  {
    suffix: "",
    label: "Map",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l5-3 4 3 5-3v10l-5 3-4-3-5 3V7z" />
        <path d="M8 4v10" />
        <path d="M12 7v10" />
      </svg>
    ),
  },
  {
    suffix: "/overview",
    label: "Overview",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    suffix: "/graph",
    label: "Graph",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="10" r="2" />
        <circle cx="15" cy="5" r="2" />
        <circle cx="15" cy="15" r="2" />
        <path d="M7 9l6-3M7 11l6 3" />
      </svg>
    ),
  },
  {
    suffix: "/org-chart",
    label: "Org Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="6" height="4" rx="1" />
        <rect x="2" y="14" width="6" height="4" rx="1" />
        <rect x="12" y="14" width="6" height="4" rx="1" />
        <path d="M10 6v4M10 10H5v4M10 10h5v4" />
      </svg>
    ),
  },
  {
    suffix: "/agents",
    label: "Agents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    ),
  },
  {
    suffix: "/humans",
    label: "Humans",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="14" cy="8" r="2" />
        <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M12 17c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5" />
      </svg>
    ),
  },
  {
    suffix: "/departments",
    label: "Departments",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10h14M3 5h14M3 15h14" />
        <rect x="3" y="3" width="14" height="14" rx="2" />
      </svg>
    ),
  },
  {
    suffix: "/cost",
    label: "Cost",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    suffix: "/skills",
    label: "Skills",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8L10 2z" />
      </svg>
    ),
  },
  {
    suffix: "/chat",
    label: "Chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h12a2 2 0 012 2v7a2 2 0 01-2 2H7l-3 3V6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    suffix: "/settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
      </svg>
    ),
  },
] as const;

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const orgId = useOrgId();
  const pathname = usePathname();
  const orgBase = `/org/${orgId}`;

  const [currentUser, setCurrentUser] = useState<{ name: string; email: string | null } | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      if (!res.ok) return;
      const data = await res.json();
      const currentId = data.currentMemberId;
      const member = (data.members ?? []).find((m: { id: string; name: string; email: string | null }) => m.id === currentId);
      if (member) setCurrentUser({ name: member.name, email: member.email });
    } catch {
      // ignore
    }
  }, [orgId]);

  useEffect(() => { fetchCurrentUser(); }, [fetchCurrentUser]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-slate-900 border-r border-slate-700/50 transition-[width] duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-slate-700/50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 min-w-0">
          <img src="/agentfactorio_logo_no_title.png" alt="AgentFactorio" className="h-10 w-10 flex-shrink-0" />
          {!collapsed && (
            <span className="text-base font-bold text-white truncate">AgentFactorio</span>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <path d="M7 4l6 6-6 6" />
            ) : (
              <path d="M13 4l-6 6 6 6" />
            )}
          </svg>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map((item) => {
          const href = `${orgBase}${item.suffix}`;
          const isActive =
            item.suffix === ""
              ? pathname === orgBase
              : pathname.startsWith(`${orgBase}${item.suffix}`);

          return (
            <Link
              key={item.suffix || "map"}
              href={href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-slate-700/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Current User */}
      {currentUser && (
        <Link
          href={`${orgBase}/settings`}
          title={collapsed ? currentUser.name : "Settings"}
          className="block border-t border-slate-700/50 px-3 py-3 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{currentUser.name}</div>
                {currentUser.email && (
                  <div className="truncate text-xs text-slate-400">{currentUser.email}</div>
                )}
              </div>
            )}
          </div>
        </Link>
      )}
    </aside>
  );
}
