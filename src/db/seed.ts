import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "agentfloor.db");
// Remove existing DB for clean seed
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// ── Create tables ───────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_budget REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    budget REAL NOT NULL DEFAULT 0,
    monthly_spend REAL NOT NULL DEFAULT 0,
    primary_vendor TEXT NOT NULL DEFAULT 'anthropic',
    layout_x REAL NOT NULL DEFAULT 0,
    layout_y REAL NOT NULL DEFAULT 0,
    layout_w REAL NOT NULL DEFAULT 300,
    layout_h REAL NOT NULL DEFAULT 240,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    dept_id TEXT NOT NULL REFERENCES departments(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    vendor TEXT NOT NULL DEFAULT 'anthropic',
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'idle',
    monthly_cost REAL NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    pos_x REAL NOT NULL DEFAULT 0,
    pos_y REAL NOT NULL DEFAULT 0,
    last_active TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'generation'
  );

  CREATE TABLE IF NOT EXISTS agent_skills (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '1.0.0',
    enabled INTEGER NOT NULL DEFAULT 1,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mcp_tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'api',
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cost_history (
    id TEXT PRIMARY KEY,
    dept_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    anthropic REAL NOT NULL DEFAULT 0,
    openai REAL NOT NULL DEFAULT 0,
    google REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS usage_history (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    requests INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS agent_resources (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('git_repo', 'database', 'storage')),
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
    created_at TEXT NOT NULL
  );
`);

// ── Seed data (from mock-data.ts) ───────────────────────────────────────────

// Organization
db.insert(schema.organizations).values({
  id: "org-1",
  name: "Acme Corp",
  totalBudget: 15000,
  createdAt: "2025-01-01T00:00:00Z",
}).run();

// Skills
const skillData = [
  { id: "skill-1", name: "Code Generation", category: "generation", icon: "⚡", description: "Generate code from natural language prompts and specifications" },
  { id: "skill-2", name: "Code Review", category: "review", icon: "🔍", description: "Review code for bugs, style issues, and improvements" },
  { id: "skill-3", name: "Testing", category: "testing", icon: "🧪", description: "Generate and run unit, integration, and e2e tests" },
  { id: "skill-4", name: "Documentation", category: "documentation", icon: "📝", description: "Generate and maintain project documentation" },
  { id: "skill-5", name: "Debugging", category: "debugging", icon: "🐛", description: "Identify and fix bugs in code" },
  { id: "skill-6", name: "Security Scan", category: "review", icon: "🛡️", description: "Scan code for security vulnerabilities and compliance issues" },
  { id: "skill-7", name: "Data Analysis", category: "generation", icon: "📊", description: "Analyze datasets and generate insights" },
  { id: "skill-8", name: "Deployment", category: "deployment", icon: "🚀", description: "Automate deployment pipelines and infrastructure setup" },
  { id: "skill-9", name: "Refactoring", category: "generation", icon: "♻️", description: "Restructure existing code for better maintainability" },
  { id: "skill-10", name: "API Design", category: "generation", icon: "🔗", description: "Design RESTful and GraphQL API schemas" },
];
for (const s of skillData) {
  db.insert(schema.skills).values(s).run();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeDailyUsage(agentId: string, baseTokens: number, baseCost: number, baseRequests: number) {
  const dates = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18"];
  const multipliers = [0.9, 1.1, 0.95, 1.05, 1.0, 0.85, 1.15];
  for (let i = 0; i < dates.length; i++) {
    db.insert(schema.usageHistory).values({
      id: `usage-${agentId}-${i}`,
      agentId,
      date: dates[i],
      tokens: Math.round(baseTokens * multipliers[i]),
      cost: Math.round(baseCost * multipliers[i] * 100) / 100,
      requests: Math.round(baseRequests * multipliers[i]),
    }).run();
  }
}

function makeCostHistory(deptId: string, baseAmount: number, vendorSplit: { anthropic: number; openai: number; google: number }) {
  const months = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
  const trends = [0.85, 0.9, 0.95, 1.0, 1.05, 1.1];
  for (let i = 0; i < months.length; i++) {
    const amount = Math.round(baseAmount * trends[i]);
    db.insert(schema.costHistory).values({
      id: `cost-${deptId}-${i}`,
      deptId,
      month: months[i],
      amount,
      anthropic: Math.round(amount * vendorSplit.anthropic),
      openai: Math.round(amount * vendorSplit.openai),
      google: Math.round(amount * vendorSplit.google),
    }).run();
  }
}

let pluginCounter = 0;
function addPlugin(agentId: string, name: string, icon: string, desc: string, version: string, enabled: boolean) {
  pluginCounter++;
  db.insert(schema.plugins).values({
    id: `plugin-${pluginCounter}`,
    agentId,
    name,
    icon,
    description: desc,
    version,
    enabled,
  }).run();
}

let mcpCounter = 0;
function addMcp(agentId: string, name: string, server: string, icon: string, desc: string, category: string) {
  mcpCounter++;
  db.insert(schema.mcpTools).values({
    id: `mcp-${mcpCounter}`,
    agentId,
    name,
    server,
    icon,
    description: desc,
    category,
  }).run();
}

let resCounter = 0;
function addResource(agentId: string, type: string, name: string, icon: string, desc: string, url: string, accessLevel: string) {
  resCounter++;
  db.insert(schema.agentResources).values({
    id: `res-${resCounter}`,
    agentId,
    type,
    name,
    icon,
    description: desc,
    url,
    accessLevel,
    createdAt: "2025-11-01T00:00:00Z",
  }).run();
}

function addSkills(agentId: string, skillIds: string[]) {
  for (const skillId of skillIds) {
    db.insert(schema.agentSkills).values({ agentId, skillId }).run();
  }
}

// ── Departments & Agents ────────────────────────────────────────────────────

// Backend Team
db.insert(schema.departments).values({
  id: "dept-1", orgId: "org-1", name: "Backend Team",
  description: "Core API and microservices development",
  budget: 4500, monthlySpend: 3800,
  primaryVendor: "anthropic",
  layoutX: 50, layoutY: 50, layoutW: 300, layoutH: 240,
  createdAt: "2025-01-01T00:00:00Z",
}).run();
makeCostHistory("dept-1", 3800, { anthropic: 0.6, openai: 0.25, google: 0.15 });

// Agent: Claude Backend
db.insert(schema.agents).values({
  id: "agent-1", deptId: "dept-1", name: "Claude Backend",
  description: "Primary backend code generation and architecture agent. Handles API design, database modeling, and microservice development.",
  vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active",
  monthlyCost: 1500, tokensUsed: 2400000, posX: 80, posY: 100,
  lastActive: "2026-02-18T09:34:00Z", createdAt: "2025-11-01T00:00:00Z",
}).run();
addSkills("agent-1", ["skill-1", "skill-2", "skill-5", "skill-10"]);
addPlugin("agent-1", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true);
addPlugin("agent-1", "Prettier", "✨", "Format code automatically on save", "4.0.1", true);
addPlugin("agent-1", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true);
addPlugin("agent-1", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true);
addMcp("agent-1", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-1", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database");
addMcp("agent-1", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-1", "Redis", "mcp-server-redis", "🔴", "Manage Redis cache and data structures", "database");
addMcp("agent-1", "Linear", "mcp-server-linear", "📋", "Manage Linear issues, projects, and sprints", "api");
makeDailyUsage("agent-1", 350000, 52, 180);
addResource("agent-1", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "write");
addResource("agent-1", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read");
addResource("agent-1", "database", "acme-staging-db", "🐘", "PostgreSQL staging database", "postgresql://staging.acme.internal:5432/main", "write");

// Agent: GPT API Builder
db.insert(schema.agents).values({
  id: "agent-2", deptId: "dept-1", name: "GPT API Builder",
  description: "Specialized in REST API and GraphQL endpoint development. Handles route definitions, middleware, and request validation.",
  vendor: "openai", model: "GPT-4o", status: "active",
  monthlyCost: 1200, tokensUsed: 1800000, posX: 200, posY: 100,
  lastActive: "2026-02-18T08:15:00Z", createdAt: "2025-12-15T00:00:00Z",
}).run();
addSkills("agent-2", ["skill-1", "skill-3", "skill-10"]);
addPlugin("agent-2", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true);
addPlugin("agent-2", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true);
addPlugin("agent-2", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true);
addMcp("agent-2", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-2", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-2", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database");
makeDailyUsage("agent-2", 260000, 41, 150);
addResource("agent-2", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "write");
addResource("agent-2", "database", "acme-staging-db", "🐘", "PostgreSQL staging database", "postgresql://staging.acme.internal:5432/main", "write");

// Agent: Claude Debugger
db.insert(schema.agents).values({
  id: "agent-3", deptId: "dept-1", name: "Claude Debugger",
  description: "Debugging specialist. Analyzes stack traces, identifies root causes, and proposes fixes for production issues.",
  vendor: "anthropic", model: "Claude Haiku 4.5", status: "idle",
  monthlyCost: 1100, tokensUsed: 1500000, posX: 140, posY: 190,
  lastActive: "2026-02-17T22:45:00Z", createdAt: "2025-10-20T00:00:00Z",
}).run();
addSkills("agent-3", ["skill-5", "skill-3", "skill-2"]);
addPlugin("agent-3", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true);
addPlugin("agent-3", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true);
addPlugin("agent-3", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", false);
addMcp("agent-3", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-3", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database");
addMcp("agent-3", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication");
addMcp("agent-3", "Redis", "mcp-server-redis", "🔴", "Manage Redis cache and data structures", "database");
makeDailyUsage("agent-3", 220000, 37, 120);
addResource("agent-3", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "read");
addResource("agent-3", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read");

// Frontend Team
db.insert(schema.departments).values({
  id: "dept-2", orgId: "org-1", name: "Frontend Team",
  description: "Web application UI/UX development",
  budget: 3000, monthlySpend: 2400,
  primaryVendor: "openai",
  layoutX: 400, layoutY: 50, layoutW: 270, layoutH: 220,
  createdAt: "2025-01-01T00:00:00Z",
}).run();
makeCostHistory("dept-2", 2400, { anthropic: 0.2, openai: 0.65, google: 0.15 });

// Agent: GPT UI Designer
db.insert(schema.agents).values({
  id: "agent-4", deptId: "dept-2", name: "GPT UI Designer",
  description: "Frontend component development and UI design implementation. Expert in React, Tailwind, and accessibility.",
  vendor: "openai", model: "GPT-4o", status: "active",
  monthlyCost: 1300, tokensUsed: 2000000, posX: 440, posY: 100,
  lastActive: "2026-02-18T10:02:00Z", createdAt: "2025-09-15T00:00:00Z",
}).run();
addSkills("agent-4", ["skill-1", "skill-2", "skill-4"]);
addPlugin("agent-4", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true);
addPlugin("agent-4", "Prettier", "✨", "Format code automatically on save", "4.0.1", true);
addPlugin("agent-4", "Storybook", "📖", "UI component development and documentation", "8.0.2", true);
addMcp("agent-4", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-4", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-4", "Puppeteer", "mcp-server-puppeteer", "🌐", "Browser automation, screenshots, and web scraping", "browser");
addMcp("agent-4", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api");
makeDailyUsage("agent-4", 290000, 44, 160);
addResource("agent-4", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "write");
addResource("agent-4", "storage", "acme-assets", "☁️", "S3 bucket for static assets and uploads", "s3://acme-assets-prod", "write");

// Agent: Claude Frontend
db.insert(schema.agents).values({
  id: "agent-5", deptId: "dept-2", name: "Claude Frontend",
  description: "Handles complex state management, performance optimization, and cross-browser testing.",
  vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active",
  monthlyCost: 1100, tokensUsed: 1600000, posX: 560, posY: 100,
  lastActive: "2026-02-18T09:50:00Z", createdAt: "2025-11-20T00:00:00Z",
}).run();
addSkills("agent-5", ["skill-1", "skill-3", "skill-9"]);
addPlugin("agent-5", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true);
addPlugin("agent-5", "Prettier", "✨", "Format code automatically on save", "4.0.1", true);
addPlugin("agent-5", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true);
addMcp("agent-5", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-5", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-5", "Puppeteer", "mcp-server-puppeteer", "🌐", "Browser automation, screenshots, and web scraping", "browser");
makeDailyUsage("agent-5", 230000, 38, 130);
addResource("agent-5", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "write");

// Data Team
db.insert(schema.departments).values({
  id: "dept-3", orgId: "org-1", name: "Data Team",
  description: "Data engineering, analytics, and ML pipeline development",
  budget: 4000, monthlySpend: 3200,
  primaryVendor: "google",
  layoutX: 720, layoutY: 50, layoutW: 300, layoutH: 240,
  createdAt: "2025-01-01T00:00:00Z",
}).run();
makeCostHistory("dept-3", 3200, { anthropic: 0.15, openai: 0.2, google: 0.65 });

// Agent: Gemini Analyst
db.insert(schema.agents).values({
  id: "agent-6", deptId: "dept-3", name: "Gemini Analyst",
  description: "Data exploration and insight generation. Creates dashboards, queries datasets, and builds analytical reports.",
  vendor: "google", model: "Gemini 2.0 Flash", status: "active",
  monthlyCost: 1200, tokensUsed: 2100000, posX: 760, posY: 100,
  lastActive: "2026-02-18T10:10:00Z", createdAt: "2025-10-01T00:00:00Z",
}).run();
addSkills("agent-6", ["skill-7", "skill-1", "skill-4"]);
addPlugin("agent-6", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", true);
addMcp("agent-6", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-6", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database");
addMcp("agent-6", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database");
addMcp("agent-6", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api");
makeDailyUsage("agent-6", 300000, 42, 170);
addResource("agent-6", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "write");
addResource("agent-6", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "admin");
addResource("agent-6", "storage", "data-lake", "☁️", "S3 data lake for raw and processed data", "s3://acme-data-lake", "write");

// Agent: Gemini Pipeline
db.insert(schema.agents).values({
  id: "agent-7", deptId: "dept-3", name: "Gemini Pipeline",
  description: "ETL pipeline development and orchestration. Manages data flow from ingestion to transformation.",
  vendor: "google", model: "Gemini 2.0 Flash", status: "active",
  monthlyCost: 1000, tokensUsed: 1700000, posX: 880, posY: 100,
  lastActive: "2026-02-18T07:30:00Z", createdAt: "2025-11-10T00:00:00Z",
}).run();
addSkills("agent-7", ["skill-7", "skill-8"]);
addPlugin("agent-7", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true);
addPlugin("agent-7", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true);
addPlugin("agent-7", "Terraform IaC", "🏗️", "Infrastructure as Code provisioning", "2.3.0", true);
addMcp("agent-7", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-7", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database");
addMcp("agent-7", "AWS", "mcp-server-aws", "☁️", "Manage AWS services (S3, Lambda, EC2, etc.)", "api");
addMcp("agent-7", "Kubernetes", "mcp-server-kubernetes", "☸️", "Manage K8s clusters, pods, and deployments", "devtools");
makeDailyUsage("agent-7", 240000, 35, 140);
addResource("agent-7", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "write");
addResource("agent-7", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "admin");
addResource("agent-7", "storage", "data-lake", "☁️", "S3 data lake for raw and processed data", "s3://acme-data-lake", "write");
addResource("agent-7", "storage", "acme-backups", "☁️", "S3 bucket for database backups", "s3://acme-db-backups", "read");

// Agent: Claude Data QA
db.insert(schema.agents).values({
  id: "agent-8", deptId: "dept-3", name: "Claude Data QA",
  description: "Data quality assurance. Validates data integrity, detects anomalies, and ensures pipeline reliability.",
  vendor: "anthropic", model: "Claude Haiku 4.5", status: "error",
  monthlyCost: 1000, tokensUsed: 1400000, posX: 820, posY: 190,
  lastActive: "2026-02-17T16:20:00Z", createdAt: "2025-12-05T00:00:00Z",
}).run();
addSkills("agent-8", ["skill-3", "skill-7", "skill-5"]);
addPlugin("agent-8", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true);
addPlugin("agent-8", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true);
addMcp("agent-8", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-8", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database");
addMcp("agent-8", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database");
addMcp("agent-8", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication");
makeDailyUsage("agent-8", 200000, 34, 110);
addResource("agent-8", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "read");
addResource("agent-8", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "read");
addResource("agent-8", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read");

// DevOps Team
db.insert(schema.departments).values({
  id: "dept-4", orgId: "org-1", name: "DevOps Team",
  description: "Infrastructure, CI/CD, and platform operations",
  budget: 1500, monthlySpend: 1100,
  primaryVendor: "anthropic",
  layoutX: 50, layoutY: 340, layoutW: 240, layoutH: 200,
  createdAt: "2025-01-01T00:00:00Z",
}).run();
makeCostHistory("dept-4", 1100, { anthropic: 0.7, openai: 0.15, google: 0.15 });

// Agent: Claude DevOps
db.insert(schema.agents).values({
  id: "agent-9", deptId: "dept-4", name: "Claude DevOps",
  description: "Infrastructure automation and CI/CD pipeline management. Handles deployments, monitoring, and incident response.",
  vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active",
  monthlyCost: 1100, tokensUsed: 1900000, posX: 130, posY: 410,
  lastActive: "2026-02-18T10:15:00Z", createdAt: "2025-08-01T00:00:00Z",
}).run();
addSkills("agent-9", ["skill-8", "skill-5", "skill-4"]);
addPlugin("agent-9", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true);
addPlugin("agent-9", "Terraform IaC", "🏗️", "Infrastructure as Code provisioning", "2.3.0", true);
addPlugin("agent-9", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true);
addPlugin("agent-9", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true);
addPlugin("agent-9", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", true);
addMcp("agent-9", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-9", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-9", "Kubernetes", "mcp-server-kubernetes", "☸️", "Manage K8s clusters, pods, and deployments", "devtools");
addMcp("agent-9", "AWS", "mcp-server-aws", "☁️", "Manage AWS services (S3, Lambda, EC2, etc.)", "api");
addMcp("agent-9", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication");
makeDailyUsage("agent-9", 270000, 38, 145);
addResource("agent-9", "git_repo", "infra-config", "📦", "Infrastructure as Code repository", "https://github.com/acme/infra-config", "admin");
addResource("agent-9", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read");
addResource("agent-9", "storage", "acme-backups", "☁️", "S3 bucket for database backups", "s3://acme-db-backups", "read");
addResource("agent-9", "storage", "acme-assets", "☁️", "S3 bucket for static assets and uploads", "s3://acme-assets-prod", "write");

// Security Team
db.insert(schema.departments).values({
  id: "dept-5", orgId: "org-1", name: "Security Team",
  description: "Application security, vulnerability assessment, and compliance",
  budget: 2000, monthlySpend: 1700,
  primaryVendor: "openai",
  layoutX: 340, layoutY: 340, layoutW: 270, layoutH: 200,
  createdAt: "2025-01-01T00:00:00Z",
}).run();
makeCostHistory("dept-5", 1700, { anthropic: 0.25, openai: 0.55, google: 0.2 });

// Agent: GPT Security
db.insert(schema.agents).values({
  id: "agent-10", deptId: "dept-5", name: "GPT Security",
  description: "Automated security scanning and vulnerability detection. Analyzes code for OWASP top-10, dependency risks, and secrets exposure.",
  vendor: "openai", model: "GPT-4o", status: "active",
  monthlyCost: 950, tokensUsed: 1300000, posX: 400, posY: 400,
  lastActive: "2026-02-18T09:00:00Z", createdAt: "2025-09-01T00:00:00Z",
}).run();
addSkills("agent-10", ["skill-6", "skill-2", "skill-5"]);
addPlugin("agent-10", "SonarQube Scanner", "📡", "Static analysis for code quality and security", "1.5.2", true);
addPlugin("agent-10", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true);
addPlugin("agent-10", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true);
addMcp("agent-10", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-10", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-10", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication");
addMcp("agent-10", "Jira", "mcp-server-jira", "🎫", "Manage Jira tickets, sprints, and boards", "api");
makeDailyUsage("agent-10", 190000, 33, 100);
addResource("agent-10", "git_repo", "security-policies", "📦", "Security policies and scanning configs", "https://github.com/acme/security-policies", "write");
addResource("agent-10", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "read");
addResource("agent-10", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "read");

// Agent: Claude Auditor
db.insert(schema.agents).values({
  id: "agent-11", deptId: "dept-5", name: "Claude Auditor",
  description: "Compliance auditing and security posture assessment. Reviews access controls, data handling, and regulatory requirements.",
  vendor: "anthropic", model: "Claude Haiku 4.5", status: "idle",
  monthlyCost: 750, tokensUsed: 1100000, posX: 520, posY: 400,
  lastActive: "2026-02-17T18:00:00Z", createdAt: "2025-10-15T00:00:00Z",
}).run();
addSkills("agent-11", ["skill-6", "skill-4", "skill-2"]);
addPlugin("agent-11", "SonarQube Scanner", "📡", "Static analysis for code quality and security", "1.5.2", true);
addMcp("agent-11", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem");
addMcp("agent-11", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api");
addMcp("agent-11", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api");
addMcp("agent-11", "Jira", "mcp-server-jira", "🎫", "Manage Jira tickets, sprints, and boards", "api");
makeDailyUsage("agent-11", 160000, 26, 85);
addResource("agent-11", "git_repo", "security-policies", "📦", "Security policies and scanning configs", "https://github.com/acme/security-policies", "write");
addResource("agent-11", "git_repo", "infra-config", "📦", "Infrastructure as Code repository", "https://github.com/acme/infra-config", "read");

console.log("Database seeded successfully!");
console.log(`  - 1 organization`);
console.log(`  - 5 departments`);
console.log(`  - 11 agents`);
console.log(`  - 10 skills`);
console.log(`  - ${pluginCounter} plugin assignments`);
console.log(`  - ${mcpCounter} MCP tool assignments`);
console.log(`  - ${resCounter} resource assignments`);
console.log(`  - 30 cost history records`);
console.log(`  - 77 usage history records`);

sqlite.close();
