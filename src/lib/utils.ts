import type { Vendor, AgentStatus } from "@/types";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getVendorColor(vendor: Vendor): string {
  const colors: Record<Vendor, string> = {
    anthropic: "#F97316",
    openai: "#22C55E",
    google: "#3B82F6",
  };
  return colors[vendor];
}

export function getVendorBgColor(vendor: Vendor): string {
  const colors: Record<Vendor, string> = {
    anthropic: "#FFF7ED",
    openai: "#F0FDF4",
    google: "#EFF6FF",
  };
  return colors[vendor];
}

export function getVendorLabel(vendor: Vendor): string {
  const labels: Record<Vendor, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
  };
  return labels[vendor];
}

export function getStatusColor(status: AgentStatus): string {
  const colors: Record<AgentStatus, string> = {
    active: "#22C55E",
    idle: "#EAB308",
    error: "#EF4444",
  };
  return colors[status];
}

export function getServiceColor(serviceName: string): string {
  const known: Record<string, string> = {
    "Claude Max": "#F97316",
    "Claude Pro": "#F97316",
    "Claude Code": "#F97316",
    "Anthropic API": "#F97316",
    "ChatGPT Plus": "#22C55E",
    "ChatGPT Pro": "#22C55E",
    "OpenAI API": "#22C55E",
    "Cursor Pro": "#8B5CF6",
    "Cursor": "#8B5CF6",
    "GitHub Copilot": "#6366F1",
    "Windsurf Pro": "#06B6D4",
    "Windsurf": "#06B6D4",
    "Midjourney": "#EC4899",
    "Google AI API": "#3B82F6",
  };
  if (known[serviceName]) return known[serviceName];
  // Hash-based HSL for unknown services
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type ActivityGrade = "A" | "B" | "C" | "D" | "F";

/** Compute an activity grade based on how recently the agent was active */
export function getActivityGrade(lastActive: string | null): ActivityGrade {
  if (!lastActive) return "F";
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "A";        // Active within the last hour
  if (diffHours < 24) return "B";       // Active today
  if (diffHours < 24 * 7) return "C";   // Active this week
  if (diffHours < 24 * 30) return "D";  // Active this month
  return "F";                            // Inactive for over a month
}

export function getGradeColor(grade: ActivityGrade): string {
  const colors: Record<ActivityGrade, string> = {
    A: "#22C55E",  // green
    B: "#3B82F6",  // blue
    C: "#EAB308",  // yellow
    D: "#F97316",  // orange
    F: "#6B7280",  // gray
  };
  return colors[grade];
}

export function getGradeBgClass(grade: ActivityGrade): string {
  const classes: Record<ActivityGrade, string> = {
    A: "bg-green-500/20 text-green-400",
    B: "bg-blue-500/20 text-blue-400",
    C: "bg-yellow-500/20 text-yellow-400",
    D: "bg-orange-500/20 text-orange-400",
    F: "bg-slate-500/20 text-slate-400",
  };
  return classes[grade];
}
