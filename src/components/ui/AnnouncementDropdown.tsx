"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { cn } from "@/lib/utils";
import type { AnnouncementTargetType, AnnouncementPriority } from "@/types";

export function AnnouncementDropdown() {
  const orgId = useOrgId();
  const announcements = useAppStore((s) => s.announcements);
  const fetchAnnouncements = useAppStore((s) => s.fetchAnnouncements);
  const createAnnouncement = useAppStore((s) => s.createAnnouncement);
  const deleteAnnouncement = useAppStore((s) => s.deleteAnnouncement);
  const organization = useAppStore((s) => s.organization);

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState<AnnouncementTargetType>("all");
  const [targetId, setTargetId] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (orgId) {
      fetchAnnouncements(orgId);
    }
  }, [orgId, fetchAnnouncements]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    if (!orgId || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    await createAnnouncement(orgId, {
      title: title.trim(),
      content: content.trim(),
      targetType,
      targetId: targetType === "all" ? null : targetId || null,
      priority,
    });
    setTitle("");
    setContent("");
    setTargetType("all");
    setTargetId("");
    setPriority("normal");
    setShowForm(false);
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!orgId) return;
    await deleteAnnouncement(orgId, id);
  };

  const departments = organization.departments ?? [];
  const allAgents = departments.flatMap((d) => d.agents ?? []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded p-1.5 text-slate-400 transition-colors hover:text-white"
        aria-label="Announcements"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {announcements.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
            {announcements.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Announcements</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              {showForm ? "Cancel" : "New"}
            </button>
          </div>

          {showForm && (
            <div className="border-b border-slate-700 p-4 space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded bg-slate-700 px-3 py-1.5 text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                placeholder="Content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                className="w-full rounded bg-slate-700 px-3 py-1.5 text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2">
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as AnnouncementTargetType);
                    setTargetId("");
                  }}
                  className="flex-1 rounded bg-slate-700 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="all">All agents</option>
                  <option value="department">Department</option>
                  <option value="agent">Agent</option>
                </select>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                  className="rounded bg-slate-700 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              {targetType === "department" && (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded bg-slate-700 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
              {targetType === "agent" && (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded bg-slate-700 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="">Select agent</option>
                  {allAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !content.trim()}
                className="w-full rounded bg-blue-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post Announcement"}
              </button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {announcements.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No announcements
              </p>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="border-b border-slate-700/50 px-4 py-3 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {a.title}
                        </span>
                        {a.priority === "urgent" && (
                          <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                        {a.content}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>
                          {a.targetType === "all"
                            ? "All"
                            : a.targetType === "department"
                              ? "Dept"
                              : "Agent"}
                        </span>
                        <span>
                          {a.ackCount ?? 0}/{a.targetCount ?? "?"} acked
                        </span>
                        <span>
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:text-red-400"
                      title="Delete"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
