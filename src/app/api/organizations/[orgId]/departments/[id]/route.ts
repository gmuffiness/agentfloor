import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("departments")
    .select("id")
    .eq("id", id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.budget !== undefined) updates.budget = body.budget;
  if (body.primaryVendor !== undefined) updates.primary_vendor = body.primaryVendor;

  if (Object.keys(updates).length > 0) {
    await supabase.from("departments").update(updates).eq("id", id);
  }

  return NextResponse.json({ message: "Department updated" });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("departments")
    .select("id")
    .eq("id", id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }

  // Check for agents
  const { count } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("dept_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Cannot delete department with agents. Remove agents first." },
      { status: 400 }
    );
  }

  await supabase.from("departments").delete().eq("id", id);
  return NextResponse.json({ message: "Department deleted" });
}
