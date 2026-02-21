import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const supabase = getSupabase();

  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  const { data: rows, error } = await supabase
    .from("departments")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deptIds = (rows ?? []).map((d) => d.id);
  const { data: agentRows } = deptIds.length > 0
    ? await supabase.from("agents").select("dept_id").in("dept_id", deptIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const a of agentRows ?? []) {
    countMap.set(a.dept_id, (countMap.get(a.dept_id) ?? 0) + 1);
  }

  const result = (rows ?? []).map((d) => ({
    ...d,
    parentId: d.parent_id ?? null,
    agentCount: countMap.get(d.id) ?? 0,
    layout: { x: d.layout_x, y: d.layout_y, width: d.layout_w, height: d.layout_h },
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const body = await request.json();
  const supabase = getSupabase();
  const id = `dept-${Date.now()}`;
  const now = new Date().toISOString();

  // Calculate grid layout position (3 columns)
  const deptW = body.layoutW ?? 300;
  const deptH = body.layoutH ?? 240;
  const GRID_COLS = 3;
  const GAP_X = 50;
  const GAP_Y = 80; // extra vertical gap for roof
  const START_X = 50;
  const START_Y = 50;

  const { data: existing } = await supabase
    .from("departments")
    .select("id")
    .eq("org_id", orgId);
  const count = (existing ?? []).length;
  const col = count % GRID_COLS;
  const row = Math.floor(count / GRID_COLS);

  const { error } = await supabase.from("departments").insert({
    id,
    org_id: orgId,
    parent_id: body.parentId ?? null,
    name: body.name,
    description: body.description ?? "",
    budget: body.budget ?? 0,
    monthly_spend: 0,
    primary_vendor: body.primaryVendor ?? "anthropic",
    layout_x: START_X + col * (deptW + GAP_X),
    layout_y: START_Y + row * (deptH + GAP_Y),
    layout_w: deptW,
    layout_h: deptH,
    created_at: now,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, message: "Department created" }, { status: 201 });
}
