import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";
import type { ServiceCategory } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const auth = await requireOrgMember(orgId);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabase();

  // Fetch active subscriptions with member info
  const { data: subs, error: subsError } = await supabase
    .from("member_subscriptions")
    .select("*, org_members(id, name, email)")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (subsError) {
    console.error("[organizations/costs] Failed to fetch subscriptions:", subsError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const subscriptions = subs || [];

  // Total subscription cost
  const totalSubscriptionCost = subscriptions.reduce(
    (sum: number, s: Record<string, unknown>) => sum + (Number(s.monthly_amount) || 0),
    0,
  );

  // By service
  const serviceMap = new Map<string, { amount: number; members: Set<string> }>();
  for (const s of subscriptions) {
    const name = s.service_name as string;
    const entry = serviceMap.get(name) || { amount: 0, members: new Set<string>() };
    entry.amount += Number(s.monthly_amount) || 0;
    entry.members.add(s.member_id as string);
    serviceMap.set(name, entry);
  }
  const byService = Array.from(serviceMap.entries())
    .map(([serviceName, { amount, members }]) => ({
      serviceName,
      amount,
      memberCount: members.size,
    }))
    .sort((a, b) => b.amount - a.amount);

  // By member
  const memberMap = new Map<string, { name: string; email: string | null; totalCost: number; subscriptions: unknown[] }>();
  for (const s of subscriptions) {
    const mid = s.member_id as string;
    const memberInfo = s.org_members as { id: string; name: string; email: string | null } | null;
    const entry = memberMap.get(mid) || {
      name: memberInfo?.name || "Unknown",
      email: memberInfo?.email || null,
      totalCost: 0,
      subscriptions: [],
    };
    entry.totalCost += Number(s.monthly_amount) || 0;
    entry.subscriptions.push({
      id: s.id,
      serviceName: s.service_name,
      serviceCategory: s.service_category,
      monthlyAmount: s.monthly_amount,
      billingCycle: s.billing_cycle,
      autoDetected: s.auto_detected,
    });
    memberMap.set(mid, entry);
  }
  const byMember = Array.from(memberMap.entries())
    .map(([memberId, data]) => ({ memberId, ...data }))
    .sort((a, b) => b.totalCost - a.totalCost);

  // By category
  const byCategory: Record<ServiceCategory, number> = {
    ai_assistant: 0,
    code_editor: 0,
    image_gen: 0,
    api: 0,
    other: 0,
  };
  for (const s of subscriptions) {
    const cat = (s.service_category as ServiceCategory) || "other";
    byCategory[cat] = (byCategory[cat] || 0) + (Number(s.monthly_amount) || 0);
  }

  return NextResponse.json({
    totalSubscriptionCost,
    byService,
    byMember,
    byCategory,
  });
}
