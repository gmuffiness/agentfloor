export type Vendor = "anthropic" | "openai" | "google";
export type AgentStatus = "active" | "idle" | "error";
export type RuntimeType = "openclaw" | "cloud" | "api";
export type ResourceType = "git_repo" | "database" | "storage";
export type AccessLevel = "read" | "write" | "admin";
export type OrgVisibility = "public" | "private";
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
  humanId: string | null;
  registeredBy: string | null;
  registeredByMember?: OrgMember | null;
  context?: AgentContext[];
  runtimeType: RuntimeType;
  gatewayUrl: string;
  /** ID of the parent agent if this is a sub-agent */
  parent_agent_id?: string | null;
  /** Sub-agents spawned by this agent */
  sub_agents?: Agent[];
  /** Whether this agent is a sub-agent of another agent */
  is_subagent?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
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
  domain: string;
  totalBudget: number;
  visibility: OrgVisibility;
  inviteCode?: string;
  createdBy?: string;
  departments: Department[];
}

export interface AgentContext {
  id: string;
  agentId: string;
  type: "claude_md" | "readme" | "custom";
  content: string;
  sourceFile: string | null;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  agentId: string;
  agentName?: string;
  agentVendor?: Vendor;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  orgId: string;
  agentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  participants?: ConversationParticipant[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  agentId?: string | null;
  agentName?: string | null;
  agentVendor?: Vendor | null;
}

export type AnnouncementTargetType = "all" | "department" | "agent";
export type AnnouncementPriority = "normal" | "urgent";

export interface Announcement {
  id: string;
  orgId: string;
  title: string;
  content: string;
  targetType: AnnouncementTargetType;
  targetId: string | null;
  priority: AnnouncementPriority;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
  ackCount?: number;
  targetCount?: number;
}

export type CostType = "subscription" | "api" | "hybrid";
export type BillingCycle = "monthly" | "annual" | "pay_as_you_go";
export type ServiceCategory = "ai_assistant" | "code_editor" | "image_gen" | "api" | "other";

export interface MemberSubscription {
  id: string;
  memberId: string;
  orgId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  costType: CostType;
  monthlyAmount: number;
  currency: string;
  billingCycle: BillingCycle;
  autoDetected: boolean;
  detectionSource: string | null;
  isActive: boolean;
  startedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const SERVICE_PRESETS = [
  { name: "Claude Max", category: "ai_assistant" as const, costType: "subscription" as const, defaultAmount: 200, billingCycle: "monthly" as const },
  { name: "Claude Pro", category: "ai_assistant" as const, costType: "subscription" as const, defaultAmount: 20, billingCycle: "monthly" as const },
  { name: "ChatGPT Plus", category: "ai_assistant" as const, costType: "subscription" as const, defaultAmount: 20, billingCycle: "monthly" as const },
  { name: "ChatGPT Pro", category: "ai_assistant" as const, costType: "subscription" as const, defaultAmount: 200, billingCycle: "monthly" as const },
  { name: "Cursor Pro", category: "code_editor" as const, costType: "subscription" as const, defaultAmount: 20, billingCycle: "monthly" as const },
  { name: "GitHub Copilot", category: "code_editor" as const, costType: "subscription" as const, defaultAmount: 10, billingCycle: "monthly" as const },
  { name: "Windsurf Pro", category: "code_editor" as const, costType: "subscription" as const, defaultAmount: 15, billingCycle: "monthly" as const },
  { name: "Midjourney", category: "image_gen" as const, costType: "subscription" as const, defaultAmount: 30, billingCycle: "monthly" as const },
  { name: "Anthropic API", category: "api" as const, costType: "api" as const, defaultAmount: 0, billingCycle: "pay_as_you_go" as const },
  { name: "OpenAI API", category: "api" as const, costType: "api" as const, defaultAmount: 0, billingCycle: "pay_as_you_go" as const },
  { name: "Google AI API", category: "api" as const, costType: "api" as const, defaultAmount: 0, billingCycle: "pay_as_you_go" as const },
] as const;

export type QueueItemStatus = "pending" | "processing" | "completed" | "failed";

export interface AgentMessageQueueItem {
  id: string;
  agentId: string;
  conversationId: string;
  orgId: string;
  messageContent: string;
  userMessageId: string | null;
  status: QueueItemStatus;
  createdAt: string;
  processingStartedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export type OrgMemberRole = "admin" | "member";
export type OrgMemberStatus = "active" | "pending";

export interface OrgMember {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  avatarUrl: string;
  joinedAt: string;
}
