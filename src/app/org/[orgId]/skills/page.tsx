"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import type { Skill, SkillCategory } from "@/types";
import { getVendorLabel } from "@/lib/utils";

interface SkillEntry {
  skill: Skill;
  agents: Array<{ name: string; department: string; vendor: string }>;
  departments: string[];
}

const categories: Array<{ label: string; value: SkillCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "Generation", value: "generation" },
  { label: "Review", value: "review" },
  { label: "Testing", value: "testing" },
  { label: "Documentation", value: "documentation" },
  { label: "Debugging", value: "debugging" },
  { label: "Deployment", value: "deployment" },
];

export default function SkillsPage() {
  const orgId = useOrgId();
  const organization = useAppStore((s) => s.organization);
  const [filter, setFilter] = useState<SkillCategory | "all">("all");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Collect all unique skills with their agents and departments
  const skillMap = new Map<string, SkillEntry>();
  for (const dept of organization.departments) {
    for (const agent of dept.agents) {
      for (const skill of agent.skills) {
        let entry = skillMap.get(skill.id);
        if (!entry) {
          entry = { skill, agents: [], departments: [] };
          skillMap.set(skill.id, entry);
        }
        entry.agents.push({
          name: agent.name,
          department: dept.name,
          vendor: getVendorLabel(agent.vendor),
        });
        if (!entry.departments.includes(dept.name)) {
          entry.departments.push(dept.name);
        }
      }
    }
  }

  const allSkillEntries = Array.from(skillMap.values());
  const filtered =
    filter === "all"
      ? allSkillEntries
      : allSkillEntries.filter((e) => e.skill.category === filter);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/org/${orgId}`}
            className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-100"
          >
            &larr; Back to Map
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Skill Catalog</h1>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === cat.value
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skill Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => {
            const isExpanded = expandedSkill === entry.skill.id;
            return (
              <div
                key={entry.skill.id}
                className="cursor-pointer rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                onClick={() =>
                  setExpandedSkill(isExpanded ? null : entry.skill.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{entry.skill.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {entry.skill.name}
                      </h3>
                      <span className="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                        {entry.skill.category}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {entry.agents.length} agent{entry.agents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  {entry.skill.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {entry.departments.map((dept) => (
                    <span
                      key={dept}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {dept}
                    </span>
                  ))}
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      Agents with this skill:
                    </p>
                    <ul className="space-y-1">
                      {entry.agents.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-gray-700">{a.name}</span>
                          <span className="text-gray-400">
                            {a.department} &middot; {a.vendor}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
