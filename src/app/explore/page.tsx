import Link from "next/link";
import { Suspense } from "react";
import { getSupabase } from "@/db/supabase";
import AuthNav from "@/app/_components/AuthNav";
import SearchBar from "./_components/SearchBar";

interface PublicOrg {
  id: string;
  name: string;
  description: string;
  departmentCount: number;
  agentCount: number;
  skillCount: number;
  mcpToolCount: number;
  vendors: string[];
  forkCount: number;
}

async function fetchPublicOrgs(search?: string): Promise<PublicOrg[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("organizations")
    .select("id, name, description, visibility")
    .eq("visibility", "public");

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: orgs, error } = await query;

  if (error || !orgs || orgs.length === 0) return [];

  const orgIds = orgs.map((o) => o.id);

  // Fork counts: count rows where forked_from is one of our org IDs
  const { data: forkRows } = await supabase
    .from("organizations")
    .select("forked_from")
    .in("forked_from", orgIds);

  const forkCountByOrg = new Map<string, number>();
  for (const row of forkRows ?? []) {
    if (!row.forked_from) continue;
    forkCountByOrg.set(row.forked_from, (forkCountByOrg.get(row.forked_from) ?? 0) + 1);
  }

  // Departments
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, org_id")
    .in("org_id", orgIds);

  const deptToOrg = new Map<string, string>();
  const deptsByOrg = new Map<string, number>();
  for (const dept of deptRows ?? []) {
    deptToOrg.set(dept.id, dept.org_id);
    deptsByOrg.set(dept.org_id, (deptsByOrg.get(dept.org_id) ?? 0) + 1);
  }

  const deptIds = (deptRows ?? []).map((d) => d.id);
  if (deptIds.length === 0) {
    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      description: org.description ?? "",
      departmentCount: 0,
      agentCount: 0,
      skillCount: 0,
      mcpToolCount: 0,
      vendors: [],
      forkCount: forkCountByOrg.get(org.id) ?? 0,
    }));
  }

  // Agents
  const { data: agentRows } = await supabase
    .from("agents")
    .select("id, dept_id, vendor")
    .in("dept_id", deptIds);

  const agentToOrg = new Map<string, string>();
  const agentsByOrg = new Map<string, number>();
  const vendorsByOrg = new Map<string, Set<string>>();
  for (const agent of agentRows ?? []) {
    const orgId = deptToOrg.get(agent.dept_id);
    if (!orgId) continue;
    agentToOrg.set(agent.id, orgId);
    agentsByOrg.set(orgId, (agentsByOrg.get(orgId) ?? 0) + 1);
    if (!vendorsByOrg.has(orgId)) vendorsByOrg.set(orgId, new Set());
    vendorsByOrg.get(orgId)!.add(agent.vendor);
  }

  const agentIds = (agentRows ?? []).map((a) => a.id);
  const agentIdFilter = agentIds.length > 0 ? agentIds : ["__none__"];

  const [{ data: skillRows }, { data: mcpRows }] = await Promise.all([
    supabase.from("agent_skills").select("agent_id, skill_id").in("agent_id", agentIdFilter),
    supabase.from("mcp_tools").select("agent_id, name").in("agent_id", agentIdFilter),
  ]);

  const skillCountByOrg = new Map<string, Set<string>>();
  for (const row of skillRows ?? []) {
    const orgId = agentToOrg.get(row.agent_id);
    if (!orgId) continue;
    if (!skillCountByOrg.has(orgId)) skillCountByOrg.set(orgId, new Set());
    skillCountByOrg.get(orgId)!.add(row.skill_id);
  }

  const mcpCountByOrg = new Map<string, Set<string>>();
  for (const row of mcpRows ?? []) {
    const orgId = agentToOrg.get(row.agent_id);
    if (!orgId) continue;
    if (!mcpCountByOrg.has(orgId)) mcpCountByOrg.set(orgId, new Set());
    mcpCountByOrg.get(orgId)!.add(row.name);
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    description: org.description ?? "",
    departmentCount: deptsByOrg.get(org.id) ?? 0,
    agentCount: agentsByOrg.get(org.id) ?? 0,
    skillCount: skillCountByOrg.get(org.id)?.size ?? 0,
    mcpToolCount: mcpCountByOrg.get(org.id)?.size ?? 0,
    vendors: Array.from(vendorsByOrg.get(org.id) ?? []),
    forkCount: forkCountByOrg.get(org.id) ?? 0,
  }));
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const orgs = await fetchPublicOrgs(q);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/agentfactorio_logo.png" alt="AgentFactorio" className="h-9 w-9" />
              <span className="text-lg font-bold tracking-tight">AgentFactorio</span>
            </Link>
            <Link
              href="/explore"
              className="text-sm font-medium text-emerald-400"
              aria-current="page"
            >
              Explore
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <AuthNav />
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-20 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Organizations
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-slate-400">
            Browse public AI agent organizations. Use them as templates to bootstrap your own fleet.
          </p>
          <div className="mt-8 flex justify-center">
            <Suspense fallback={null}>
              <SearchBar defaultValue={q} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        {orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-medium text-slate-400">No organizations found</p>
            {q && (
              <p className="mt-2 text-sm text-slate-500">
                Try a different search term or{" "}
                <Link href="/explore" className="text-emerald-400 hover:underline">
                  browse all
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
              {q ? ` matching "${q}"` : ""}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/explore/${org.id}`}
                  className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-emerald-500/40 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold group-hover:text-emerald-400">
                      {org.name}
                    </h3>
                    {org.forkCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h.01M16 7h.01M8 17h.01M12 12h.01M16 17h.01M7 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-5 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 17a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                        </svg>
                        {org.forkCount}
                      </span>
                    )}
                  </div>
                  {org.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
                      {org.description}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{org.agentCount}</p>
                      <p className="text-slate-500">Agents</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{org.departmentCount}</p>
                      <p className="text-slate-500">Departments</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{org.skillCount}</p>
                      <p className="text-slate-500">Skills</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{org.mcpToolCount}</p>
                      <p className="text-slate-500">MCP Tools</p>
                    </div>
                  </div>
                  {org.vendors.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {org.vendors.map((v) => (
                        <span
                          key={v}
                          className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs capitalize text-slate-300"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View &amp; Fork
                    <span aria-hidden="true">&rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/agentfactorio_logo.png" alt="AgentFactorio" className="h-7 w-7" />
            <span>AgentFactorio</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/gmuffiness/agent-factorio"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-300"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/agent-factorio"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-300"
            >
              npm
            </a>
          </div>
          <p>&copy; {new Date().getFullYear()} AgentFactorio. Open source under MIT.</p>
        </div>
      </footer>
    </div>
  );
}
