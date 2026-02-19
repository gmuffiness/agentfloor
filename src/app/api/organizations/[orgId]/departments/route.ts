import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from("departments")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = await Promise.all(
    (rows ?? []).map(async (d) => {
      const { count } = await supabase
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("dept_id", d.id);

      return {
        ...d,
        agentCount: count ?? 0,
        layout: { x: d.layout_x, y: d.layout_y, width: d.layout_w, height: d.layout_h },
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const id = `dept-${Date.now()}`;
  const now = new Date().toISOString();

  // Calculate layout position (stack below existing departments)
  const { data: existing } = await supabase
    .from("departments")
    .select("layout_y, layout_h")
    .eq("org_id", orgId);
  const maxY = (existing ?? []).reduce((max, d) => Math.max(max, d.layout_y + d.layout_h), 0);

  const { error } = await supabase.from("departments").insert({
    id,
    org_id: orgId,
    name: body.name,
    description: body.description ?? "",
    budget: body.budget ?? 0,
    monthly_spend: 0,
    primary_vendor: body.primaryVendor ?? "anthropic",
    layout_x: 50,
    layout_y: maxY + 50,
    layout_w: body.layoutW ?? 300,
    layout_h: body.layoutH ?? 240,
    created_at: now,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, message: "Department created" }, { status: 201 });
}
