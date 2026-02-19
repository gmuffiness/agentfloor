export type Vendor = "anthropic" | "openai" | "google";
export type AgentStatus = "active" | "idle" | "error";
export type ResourceType = "git_repo" | "database" | "storage";
export type AccessLevel = "read" | "write" | "admin";
export type SkillCategory = "generation" | "review" | "testing" | "documentation" | "debugging" | "deployment";

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  icon: string;
  description: string;
}

export interface Plugin {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: string;
  enabled: boolean;
}

export interface McpTool {
  id: string;
  name: string;
  server: string;
  icon: string;
  description: string;
  category: "filesystem" | "database" | "api" | "browser" | "communication" | "devtools";
}

export interface AgentResource {
  id: string;
  type: ResourceType;
  name: string;
  icon: string;
  description: string;
  url: string;
  accessLevel: AccessLevel;
  createdAt: string;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

export interface MonthlyCost {
  month: string;
  amount: number;
  byVendor: Record<Vendor, number>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  vendor: Vendor;
  model: string;
  status: AgentStatus;
  monthlyCost: number;
  tokensUsed: number;
  position: { x: number; y: number };
  skills: Skill[];
  plugins: Plugin[];
  mcpTools: McpTool[];
  resources: AgentResource[];
  usageHistory: DailyUsage[];
  lastActive: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  budget: number;
  monthlySpend: number;
  layout: { x: number; y: number; width: number; height: number };
  primaryVendor: Vendor;
  agents: Agent[];
  costHistory: MonthlyCost[];
}

export interface Organization {
  id: string;
  name: string;
  totalBudget: number;
  inviteCode?: string;
  createdBy?: string;
  departments: Department[];
}

export type OrgMemberRole = "admin" | "member";
export type OrgMemberStatus = "active" | "pending";

export interface OrgMember {
  id: string;
  orgId: string;
  name: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  joinedAt: string;
}
