import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; subId: string }> },
) {
  const { orgId, subId } = await params;
  const auth = await requireOrgMember(orgId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updated_at: now };
  if (body.monthlyAmount !== undefined) updates.monthly_amount = body.monthlyAmount;
  if (body.billingCycle !== undefined) updates.billing_cycle = body.billingCycle;
  if (body.serviceCategory !== undefined) updates.service_category = body.serviceCategory;
  if (body.costType !== undefined) updates.cost_type = body.costType;
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.serviceName !== undefined) updates.service_name = body.serviceName;

  const { data, error } = await supabase
    .from("member_subscriptions")
    .update(updates)
    .eq("id", subId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("[organizations/subscriptions/subId] Failed to update subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    memberId: data.member_id,
    orgId: data.org_id,
    serviceName: data.service_name,
    serviceCategory: data.service_category,
    costType: data.cost_type,
    monthlyAmount: data.monthly_amount,
    currency: data.currency,
    billingCycle: data.billing_cycle,
    autoDetected: data.auto_detected,
    detectionSource: data.detection_source,
    isActive: data.is_active,
    startedAt: data.started_at,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; subId: string }> },
) {
  const { orgId, subId } = await params;
  const auth = await requireOrgMember(orgId);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabase();

  const { error } = await supabase
    .from("member_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", subId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[organizations/subscriptions/subId] Failed to deactivate subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
