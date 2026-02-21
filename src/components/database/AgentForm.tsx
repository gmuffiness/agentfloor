"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Vendor, AgentStatus } from "@/types";

interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  owner: { login: string; avatar_url: string };
}

export interface AgentFormData {
  name: string;
  description: string;
  vendor: Vendor;
  model: string;
  status: AgentStatus;
  monthlyCost: number;
  deptId: string;
  humanId: string | null;
  runtimeType?: string;
  resources?: { type: string; name: string; url: string; accessLevel: string }[];
}

interface AgentFormProps {
  departments: { id: string; name: string }[];
  members: { id: string; name: string }[];
  orgId: string;
  hasGitHub?: boolean;
  defaultOwnerId?: string | null;
  onSubmit: (data: AgentFormData) => void;
  onCancel: () => void;
}

export function AgentForm({ departments, members, orgId, hasGitHub, defaultOwnerId, onSubmit, onCancel }: AgentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState<Vendor>("anthropic");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [humanId, setHumanId] = useState<string | null>(defaultOwnerId ?? null);

  // GitHub repo search state
  const [repoQuery, setRepoQuery] = useState("");
  const [repoResults, setRepoResults] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchRepos = useCallback(async (query: string) => {
    if (!query.trim()) {
      setRepoResults([]);
      return;
    }
    setRepoLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/github/repos?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setRepoResults(data.repos ?? []);
        setShowRepoDropdown(true);
      }
    } finally {
      setRepoLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!hasGitHub || selectedRepo) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRepos(repoQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [repoQuery, hasGitHub, selectedRepo, searchRepos]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRepoDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setRepoQuery(repo.full_name);
    setShowRepoDropdown(false);
    setName(repo.name);
    setDescription(repo.description ?? "");
  };

  const handleClearRepo = () => {
    setSelectedRepo(null);
    setRepoQuery("");
    setRepoResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !deptId) return;
    const data: AgentFormData = { name, description, vendor, model, status, monthlyCost, deptId, humanId };
    if (selectedRepo) {
      data.runtimeType = "cloud";
      data.resources = [{
        type: "git_repo",
        name: selectedRepo.full_name,
        url: selectedRepo.html_url,
        accessLevel: "read",
      }];
    }
    onSubmit(data);
  };

  const inputClass = "w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-slate-900 p-6 border border-slate-700">
        <h2 className="mb-4 text-lg font-bold text-white">Add Agent</h2>

        <div className="flex flex-col gap-3">
          {hasGitHub && (
            <div ref={dropdownRef} className="relative">
              <label className={labelClass}>Import from GitHub</label>
              {selectedRepo ? (
                <div className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                  <span className="flex-1 truncate">{selectedRepo.full_name}</span>
                  {selectedRepo.private && (
                    <span className="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">Private</span>
                  )}
                  <button type="button" onClick={handleClearRepo} className="shrink-0 text-slate-400 hover:text-white">&times;</button>
                </div>
              ) : (
                <input
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  onFocus={() => { if (repoResults.length > 0) setShowRepoDropdown(true); }}
                  className={inputClass}
                  placeholder="Search repositories..."
                />
              )}
              {repoLoading && (
                <div className="absolute right-3 top-8 text-xs text-slate-400">Searching...</div>
              )}
              {showRepoDropdown && repoResults.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-600 bg-slate-800 shadow-lg">
                  {repoResults.map((repo) => (
                    <button
                      key={repo.full_name}
                      type="button"
                      onClick={() => handleSelectRepo(repo)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-white hover:bg-slate-700"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{repo.full_name}</span>
                          {repo.private && (
                            <span className="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">Private</span>
                          )}
                        </div>
                        {repo.description && (
                          <div className="truncate text-xs text-slate-400">{repo.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showRepoDropdown && repoResults.length === 0 && repoQuery.trim() && !repoLoading && (
                <div className="absolute z-50 mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-400 shadow-lg">
                  No repositories found
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
          </div>
          <div>
            <label className={labelClass}>Department *</label>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputClass} required>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Owner</label>
            <select
              value={humanId ?? ""}
              onChange={(e) => setHumanId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">None</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vendor</label>
              <select value={vendor} onChange={(e) => setVendor(e.target.value as Vendor)} className={inputClass}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} placeholder="e.g. Claude Sonnet 4.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AgentStatus)} className={inputClass}>
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Monthly Cost ($)</label>
              <input type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(Number(e.target.value))} className={inputClass} min={0} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white">
            Cancel
          </button>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Create Agent
          </button>
        </div>
      </form>
    </div>
  );
}
