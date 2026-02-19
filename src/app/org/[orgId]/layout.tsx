"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { AppShell } from "@/components/ui/AppShell";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const setCurrentOrgId = useAppStore((s) => s.setCurrentOrgId);
  const fetchOrganization = useAppStore((s) => s.fetchOrganization);

  useEffect(() => {
    setCurrentOrgId(orgId);
    fetchOrganization(orgId);
    // Save last used org to cookie
    document.cookie = `agentfloor-last-org=${orgId};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, [orgId, setCurrentOrgId, fetchOrganization]);

  return <AppShell>{children}</AppShell>;
}
