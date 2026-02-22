import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";
import { getInstallationToken } from "@/lib/github-app";

interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  owner: { login: string; avatar_url: string };
}

/**
 * GET — List accessible repos from all GitHub installations for this org.
 * Query param: ?q=search_term (optional, filters by repo name)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const supabase = getSupabase();

  const { data: installations, error } = await supabase
    .from("github_installations")
    .select("installation_id")
    .eq("org_id", orgId);

  if (error) {
    console.error("[organizations/github/repos] Failed to fetch GitHub installations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!installations || installations.length === 0) {
    return NextResponse.json({ repos: [] });
  }

  const allRepos: GitHubRepo[] = [];

  for (const inst of installations) {
    try {
      const token = await getInstallationToken(inst.installation_id);

      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(
          `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "AgentFactorio-GitHub-App",
            },
          }
        );

        if (!res.ok) break;

        const data = await res.json();
        const repos = (data.repositories ?? []) as GitHubRepo[];
        allRepos.push(...repos);

        if (repos.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch {
      // Skip installations that fail token generation
    }
  }

  const filtered = q
    ? allRepos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q)
      )
    : allRepos;

  // Deduplicate by full_name
  const seen = new Set<string>();
  const unique = filtered.filter((r) => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });

  const repos = unique.map((r) => ({
    full_name: r.full_name,
    name: r.name,
    private: r.private,
    description: r.description,
    html_url: r.html_url,
    owner: { login: r.owner.login, avatar_url: r.owner.avatar_url },
  }));

  return NextResponse.json({ repos });
}
