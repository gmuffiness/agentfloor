import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/db/supabase";
import AuthNav from "@/app/_components/AuthNav";
import ForkButton from "./_components/ForkButton";

interface AgentSummary {
  id: string;
  name: string;
  description: string;
  vendor: string;
  model: string;
  status: string;
}

interface DepartmentDetail {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  agents: AgentSummary[];
}

interface OrgDetail {
  id: string;
  name: string;
  description: string;
  forkedFrom: string | null;
  departmentCount: number;
  agentCount: number;
  skillCount: number;
  mcpToolCount: number;
  vendors: string[];
  departments: DepartmentDetail[];
}

async function fetchOrgDetail(orgId: string): Promise<OrgDetail | null> {
  const supabase = getSupabase();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, description, visibility, forked_from")
    .eq("id", orgId)
    .eq("visibility", "public")
    .single();

  if (orgError || !org) return null;

  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, name, description")
    .eq("org_id", orgId);

  const deptIds = (deptRows ?? []).map((d) => d.id);

  if (deptIds.length === 0) {
    return {
      id: org.id,
      name: org.name,
      description: org.description ?? "",
      forkedFrom: org.forked_from ?? null,
      departmentCount: 0,
      agentCount: 0,
      skillCount: 0,
      mcpToolCount: 0,
      vendors: [],
      departments: [],
    };
  }

  const { data: agentRows } = await supabase
    .from("agents")
    .select("id, dept_id, name, description, vendor, model, status")
    .in("dept_id", deptIds);

  const agentIds = (agentRows ?? []).map((a) => a.id);
  const agentIdFilter = agentIds.length > 0 ? agentIds : ["__none__"];

  const vendorSet = new Set<string>();
  for (const agent of agentRows ?? []) vendorSet.add(agent.vendor);

  const [{ data: skillRows }, { data: mcpRows }] = await Promise.all([
    supabase.from("agent_skills").select("agent_id, skill_id").in("agent_id", agentIdFilter),
    supabase.from("mcp_tools").select("agent_id, name").in("agent_id", agentIdFilter),
  ]);

  const uniqueSkills = new Set((skillRows ?? []).map((r) => r.skill_id));
  const uniqueMcpTools = new Set((mcpRows ?? []).map((r) => r.name));

  const agentsByDept = new Map<string, AgentSummary[]>();
  for (const agent of agentRows ?? []) {
    if (!agentsByDept.has(agent.dept_id)) agentsByDept.set(agent.dept_id, []);
    agentsByDept.get(agent.dept_id)!.push({
      id: agent.id,
      name: agent.name,
      description: agent.description ?? "",
      vendor: agent.vendor,
      model: agent.model ?? "",
      status: agent.status,
    });
  }

  const departments: DepartmentDetail[] = (deptRows ?? []).map((dept) => {
    const agents = agentsByDept.get(dept.id) ?? [];
    return {
      id: dept.id,
      name: dept.name,
      description: dept.description ?? "",
      agentCount: agents.length,
      agents,
    };
  });

  return {
    id: org.id,
    name: org.name,
    description: org.description ?? "",
    forkedFrom: org.forked_from ?? null,
    departmentCount: deptIds.length,
    agentCount: (agentRows ?? []).length,
    skillCount: uniqueSkills.size,
    mcpToolCount: uniqueMcpTools.size,
    vendors: Array.from(vendorSet),
    departments,
  };
}

async function fetchForkedFromName(orgId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  return data?.name ?? null;
}

const VENDOR_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#16a34a",
  google: "#2563eb",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  idle: "bg-yellow-400",
  error: "bg-red-500",
};

export default async function ExploreOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await fetchOrgDetail(orgId);

  if (!org) notFound();

  const forkedFromName = org.forkedFrom ? await fetchForkedFromName(org.forkedFrom) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/agentfactorio_logo_no_title.png" alt="AgentFactorio" className="h-12 w-12" />
            <span className="text-lg font-bold tracking-tight">AgentFactorio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/explore"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              Explore
            </Link>
            <AuthNav />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/explore" className="transition-colors hover:text-slate-300">
            Explore
          </Link>
          <span>/</span>
          <span className="text-slate-300">{org.name}</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
            {org.description && (
              <p className="mt-2 max-w-2xl text-slate-400">{org.description}</p>
            )}
            {org.forkedFrom && forkedFromName && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5v4.5m0 0a3 3 0 103 3m-3-3h7.5M15.75 4.5v4.5m0 0a3 3 0 11-3 3" />
                </svg>
                <span>Forked from</span>
                <Link
                  href={`/explore/${org.forkedFrom}`}
                  className="font-medium text-emerald-400 hover:underline"
                >
                  {forkedFromName}
                </Link>
              </div>
            )}
          </div>
          <ForkButton orgId={org.id} orgName={org.name} />
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Departments", value: org.departmentCount },
            { label: "Agents", value: org.agentCount },
            { label: "Skills", value: org.skillCount },
            { label: "MCP Tools", value: org.mcpToolCount },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center"
            >
              <p className="text-3xl font-bold text-emerald-400">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Vendors */}
        {org.vendors.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {org.vendors.map((v) => (
              <span
                key={v}
                className="rounded-full px-3 py-1 text-xs font-semibold capitalize text-white"
                style={{ backgroundColor: VENDOR_COLORS[v] ?? "#475569" }}
              >
                {v}
              </span>
            ))}
          </div>
        )}

        {/* Departments & Agents */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Departments</h2>
          {org.departments.length === 0 ? (
            <p className="text-sm text-slate-500">No departments yet.</p>
          ) : (
            org.departments.map((dept) => (
              <div
                key={dept.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{dept.name}</h3>
                    {dept.description && (
                      <p className="mt-0.5 text-sm text-slate-500">{dept.description}</p>
                    )}
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                    {dept.agentCount} {dept.agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>

                {dept.agents.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {dept.agents.map((agent) => (
                      <div
                        key={agent.id}
                        className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-slate-500"}`}
                          />
                          <p className="truncate text-sm font-medium">{agent.name}</p>
                        </div>
                        {agent.description && (
                          <p className="mb-2 line-clamp-2 text-xs text-slate-500">
                            {agent.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
                            style={{ backgroundColor: VENDOR_COLORS[agent.vendor] ?? "#475569" }}
                          >
                            {agent.vendor}
                          </span>
                          {agent.model && (
                            <span className="rounded-full border border-slate-600 bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                              {agent.model}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
