"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { AppShell } from "@/components/ui/AppShell";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutHelp } from "@/components/ui/KeyboardShortcutHelp";

function OrgLoadingSpinner() {
  return (
    <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        <p className="text-sm text-slate-400">Loading organization...</p>
      </div>
    </div>
  );
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const setCurrentOrgId = useAppStore((s) => s.setCurrentOrgId);
  const fetchOrganization = useAppStore((s) => s.fetchOrganization);
  const isLoaded = useAppStore((s) => s.isLoaded);
  const currentOrgId = useAppStore((s) => s.currentOrgId);

  useKeyboardShortcuts();

  useEffect(() => {
    setCurrentOrgId(orgId);
    fetchOrganization(orgId);
    // Save last used org to cookie
    document.cookie = `agent-factorio-last-org=${orgId};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, [orgId, setCurrentOrgId, fetchOrganization]);

  return (
    <AppShell>
      {isLoaded && currentOrgId === orgId ? children : <OrgLoadingSpinner />}
      <KeyboardShortcutHelp />
    </AppShell>
  );
}
