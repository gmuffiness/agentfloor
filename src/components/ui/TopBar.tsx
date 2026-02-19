"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency, cn } from "@/lib/utils";

const navSuffixes = [
  { suffix: "", label: "Map" },
  { suffix: "/graph", label: "Graph" },
  { suffix: "/agents", label: "Agents" },
  { suffix: "/departments", label: "Departments" },
  { suffix: "/cost", label: "Cost" },
  { suffix: "/skills", label: "Skills" },
] as const;

export function TopBar() {
  const orgId = useOrgId();
  const organization = useAppStore((s) => s.organization);
  const getTotalMonthlyCost = useAppStore((s) => s.getTotalMonthlyCost);
  const pathname = usePathname();
  const orgBase = `/org/${orgId}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-slate-900 px-4 text-white">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <span className="text-xl" role="img" aria-label="factory">
            🏘️
          </span>
          <span className="text-lg font-bold">AgentFloor</span>
        </Link>
      </div>

      <div className="text-sm font-medium text-slate-300">
        {organization.name}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-300">
          {formatCurrency(getTotalMonthlyCost())}/mo
        </span>
        <nav className="flex items-center gap-1">
          {navSuffixes.map((link) => {
            const href = `${orgBase}${link.suffix}`;
            const isActive =
              link.suffix === ""
                ? pathname === orgBase
                : pathname.startsWith(`${orgBase}${link.suffix}`);
            return (
              <Link
                key={link.suffix}
                href={href}
                className={cn(
                  "rounded px-3 py-1 text-sm transition-colors",
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
