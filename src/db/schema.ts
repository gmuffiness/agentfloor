import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ── Organizations ───────────────────────────────────────────────────────────
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  totalBudget: real("total_budget").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ── Departments ─────────────────────────────────────────────────────────────
export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  budget: real("budget").notNull().default(0),
  monthlySpend: real("monthly_spend").notNull().default(0),
  primaryVendor: text("primary_vendor").notNull().default("anthropic"),
  layoutX: real("layout_x").notNull().default(0),
  layoutY: real("layout_y").notNull().default(0),
  layoutW: real("layout_w").notNull().default(300),
  layoutH: real("layout_h").notNull().default(240),
  createdAt: text("created_at").notNull(),
});

// ── Agents ──────────────────────────────────────────────────────────────────
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  deptId: text("dept_id").notNull().references(() => departments.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  vendor: text("vendor").notNull().default("anthropic"),
  model: text("model").notNull().default(""),
  status: text("status").notNull().default("idle"),
  monthlyCost: real("monthly_cost").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(0),
  lastActive: text("last_active").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Skills ──────────────────────────────────────────────────────────────────
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("generation"),
});

// ── Agent ↔ Skill (many-to-many) ────────────────────────────────────────────
export const agentSkills = sqliteTable("agent_skills", {
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
});

// ── Plugins ─────────────────────────────────────────────────────────────────
export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default(""),
  description: text("description").notNull().default(""),
  version: text("version").notNull().default("1.0.0"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "cascade" }),
});

// ── MCP Tools ───────────────────────────────────────────────────────────────
export const mcpTools = sqliteTable("mcp_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  server: text("server").notNull().default(""),
  icon: text("icon").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("api"),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "cascade" }),
});

// ── Agent Resources ────────────────────────────────────────────────────────
export const agentResources = sqliteTable("agent_resources", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default(""),
  description: text("description").notNull().default(""),
  url: text("url").notNull().default(""),
  accessLevel: text("access_level").notNull().default("read"),
  createdAt: text("created_at").notNull(),
});

// ── Cost History ────────────────────────────────────────────────────────────
export const costHistory = sqliteTable("cost_history", {
  id: text("id").primaryKey(),
  deptId: text("dept_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  amount: real("amount").notNull().default(0),
  anthropic: real("anthropic").notNull().default(0),
  openai: real("openai").notNull().default(0),
  google: real("google").notNull().default(0),
});

// ── Usage History ───────────────────────────────────────────────────────────
export const usageHistory = sqliteTable("usage_history", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  tokens: integer("tokens").notNull().default(0),
  cost: real("cost").notNull().default(0),
  requests: integer("requests").notNull().default(0),
});
