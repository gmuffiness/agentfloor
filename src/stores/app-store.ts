import { create } from "zustand";
import type { Organization, Department, Agent, Vendor, Announcement, AnnouncementTargetType, AnnouncementPriority } from "@/types";

interface AppState {
  organization: Organization;
  currentOrgId: string | null;
  selectedDepartmentId: string | null;
  selectedAgentId: string | null;
  viewMode: "map" | "cost" | "skills";
  zoomLevel: number;
  isLoaded: boolean;
  // Actions
  setCurrentOrgId: (orgId: string) => void;
  selectDepartment: (id: string | null) => void;
  selectAgent: (id: string | null) => void;
  setViewMode: (mode: "map" | "cost" | "skills") => void;
  setZoomLevel: (level: number) => void;
  clearSelection: () => void;
  fetchOrganization: (orgId: string) => Promise<void>;
  // Announcements
  announcements: Announcement[];
  fetchAnnouncements: (orgId: string) => Promise<void>;
  createAnnouncement: (orgId: string, data: {
    title: string;
    content: string;
    targetType?: AnnouncementTargetType;
    targetId?: string | null;
    priority?: AnnouncementPriority;
    expiresAt?: string | null;
  }) => Promise<void>;
  deleteAnnouncement: (orgId: string, id: string) => Promise<void>;
  // Computed helpers
  getSelectedDepartment: () => Department | null;
  getSelectedAgent: () => Agent | null;
  getTotalMonthlyCost: () => number;
  getVendorCostBreakdown: () => Record<Vendor, number>;
}

export const useAppStore = create<AppState>((set, get) => ({
  organization: {
    id: "",
    name: "",
    totalBudget: 0,
    departments: [],
  },
  currentOrgId: null,
  selectedDepartmentId: null,
  selectedAgentId: null,
  viewMode: "map",
  zoomLevel: 1,
  isLoaded: false,
  announcements: [],

  setCurrentOrgId: (orgId) => set({ currentOrgId: orgId }),

  selectDepartment: (id) =>
    set({ selectedDepartmentId: id, selectedAgentId: null }),

  selectAgent: (id) =>
    set({ selectedAgentId: id, selectedDepartmentId: null }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setZoomLevel: (level) => set({ zoomLevel: level }),

  clearSelection: () =>
    set({ selectedDepartmentId: null, selectedAgentId: null }),

  fetchAnnouncements: async (orgId: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/announcements`);
      if (res.ok) {
        const data: Announcement[] = await res.json();
        set({ announcements: data });
      }
    } catch {
      console.warn("Failed to fetch announcements");
    }
  },

  createAnnouncement: async (orgId: string, data) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await get().fetchAnnouncements(orgId);
      }
    } catch {
      console.warn("Failed to create announcement");
    }
  },

  deleteAnnouncement: async (orgId: string, id: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/announcements/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        set({ announcements: get().announcements.filter((a) => a.id !== id) });
      }
    } catch {
      console.warn("Failed to delete announcement");
    }
  },

  fetchOrganization: async (orgId: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}`);
      if (res.ok) {
        const data: Organization = await res.json();
        set({ organization: data, currentOrgId: orgId, isLoaded: true });
      }
    } catch {
      console.warn("Failed to fetch organization from API");
    }
  },

  getSelectedDepartment: () => {
    const { organization, selectedDepartmentId } = get();
    if (!selectedDepartmentId) return null;
    return (
      organization.departments.find((d) => d.id === selectedDepartmentId) ??
      null
    );
  },

  getSelectedAgent: () => {
    const { organization, selectedAgentId } = get();
    if (!selectedAgentId) return null;
    for (const dept of organization.departments) {
      const agent = dept.agents.find((a) => a.id === selectedAgentId);
      if (agent) return agent;
    }
    return null;
  },

  getTotalMonthlyCost: () => {
    const { organization } = get();
    return organization.departments.reduce(
      (sum, dept) => sum + dept.monthlySpend,
      0,
    );
  },

  getVendorCostBreakdown: () => {
    const { organization } = get();
    const breakdown: Record<Vendor, number> = {
      anthropic: 0,
      openai: 0,
      google: 0,
    };
    for (const dept of organization.departments) {
      for (const agent of dept.agents) {
        breakdown[agent.vendor] += agent.monthlyCost;
      }
    }
    return breakdown;
  },
}));
