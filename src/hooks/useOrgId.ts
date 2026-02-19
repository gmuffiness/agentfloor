"use client";

import { useParams } from "next/navigation";

export function useOrgId(): string {
  return useParams<{ orgId: string }>().orgId;
}
