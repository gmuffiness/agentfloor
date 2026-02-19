#!/usr/bin/env node
/**
 * Seed Supabase remote DB with mock data.
 * Usage: node scripts/seed-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error) { console.error(`Error inserting into ${table}:`, error.message); process.exit(1); }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeDailyUsage(agentId, baseTokens, baseCost, baseRequests) {
  const dates = ["2026-02-12","2026-02-13","2026-02-14","2026-02-15","2026-02-16","2026-02-17","2026-02-18"];
  const m = [0.9, 1.1, 0.95, 1.05, 1.0, 0.85, 1.15];
  return dates.map((date, i) => ({
    id: `usage-${agentId}-${i}`,
    agent_id: agentId,
    date,
    tokens: Math.round(baseTokens * m[i]),
    cost: Math.round(baseCost * m[i] * 100) / 100,
    requests: Math.round(baseRequests * m[i]),
  }));
}

function makeCostHistory(deptId, baseAmount, split) {
  const months = ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02"];
  const t = [0.85, 0.9, 0.95, 1.0, 1.05, 1.1];
  return months.map((month, i) => {
    const amount = Math.round(baseAmount * t[i]);
    return {
      id: `cost-${deptId}-${i}`,
      dept_id: deptId, month, amount,
      anthropic: Math.round(amount * split.anthropic),
      openai: Math.round(amount * split.openai),
      google: Math.round(amount * split.google),
    };
  });
}

// ── Data ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Seeding Supabase...\n");

  // Organization
  await insert("organizations", [{
    id: "org-1", name: "test", total_budget: 15000,
    invite_code: "TEST42", created_by: "system", created_at: "2025-01-01T00:00:00Z",
  }]);

  // Departments
  await insert("departments", [
    { id: "dept-1", org_id: "org-1", name: "Backend Team", description: "Core API and microservices development", budget: 4500, monthly_spend: 3800, primary_vendor: "anthropic", layout_x: 50, layout_y: 50, layout_w: 300, layout_h: 240, created_at: "2025-01-01T00:00:00Z" },
    { id: "dept-2", org_id: "org-1", name: "Frontend Team", description: "Web application UI/UX development", budget: 3000, monthly_spend: 2400, primary_vendor: "openai", layout_x: 400, layout_y: 50, layout_w: 270, layout_h: 220, created_at: "2025-01-01T00:00:00Z" },
    { id: "dept-3", org_id: "org-1", name: "Data Team", description: "Data engineering, analytics, and ML pipeline development", budget: 4000, monthly_spend: 3200, primary_vendor: "google", layout_x: 720, layout_y: 50, layout_w: 300, layout_h: 240, created_at: "2025-01-01T00:00:00Z" },
    { id: "dept-4", org_id: "org-1", name: "DevOps Team", description: "Infrastructure, CI/CD, and platform operations", budget: 1500, monthly_spend: 1100, primary_vendor: "anthropic", layout_x: 50, layout_y: 340, layout_w: 240, layout_h: 200, created_at: "2025-01-01T00:00:00Z" },
    { id: "dept-5", org_id: "org-1", name: "Security Team", description: "Application security, vulnerability assessment, and compliance", budget: 2000, monthly_spend: 1700, primary_vendor: "openai", layout_x: 340, layout_y: 340, layout_w: 270, layout_h: 200, created_at: "2025-01-01T00:00:00Z" },
  ]);

  // Skills
  await insert("skills", [
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
  ]);

  // Agents
  const agents = [
    { id: "agent-1", dept_id: "dept-1", name: "Claude Backend", description: "Primary backend code generation and architecture agent. Handles API design, database modeling, and microservice development.", vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active", monthly_cost: 1500, tokens_used: 2400000, pos_x: 80, pos_y: 100, last_active: "2026-02-18T09:34:00Z", created_at: "2025-11-01T00:00:00Z" },
    { id: "agent-2", dept_id: "dept-1", name: "GPT API Builder", description: "Specialized in REST API and GraphQL endpoint development. Handles route definitions, middleware, and request validation.", vendor: "openai", model: "GPT-4o", status: "active", monthly_cost: 1200, tokens_used: 1800000, pos_x: 200, pos_y: 100, last_active: "2026-02-18T08:15:00Z", created_at: "2025-12-15T00:00:00Z" },
    { id: "agent-3", dept_id: "dept-1", name: "Claude Debugger", description: "Debugging specialist. Analyzes stack traces, identifies root causes, and proposes fixes for production issues.", vendor: "anthropic", model: "Claude Haiku 4.5", status: "idle", monthly_cost: 1100, tokens_used: 1500000, pos_x: 140, pos_y: 190, last_active: "2026-02-17T22:45:00Z", created_at: "2025-10-20T00:00:00Z" },
    { id: "agent-4", dept_id: "dept-2", name: "GPT UI Designer", description: "Frontend component development and UI design implementation. Expert in React, Tailwind, and accessibility.", vendor: "openai", model: "GPT-4o", status: "active", monthly_cost: 1300, tokens_used: 2000000, pos_x: 440, pos_y: 100, last_active: "2026-02-18T10:02:00Z", created_at: "2025-09-15T00:00:00Z" },
    { id: "agent-5", dept_id: "dept-2", name: "Claude Frontend", description: "Handles complex state management, performance optimization, and cross-browser testing.", vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active", monthly_cost: 1100, tokens_used: 1600000, pos_x: 560, pos_y: 100, last_active: "2026-02-18T09:50:00Z", created_at: "2025-11-20T00:00:00Z" },
    { id: "agent-6", dept_id: "dept-3", name: "Gemini Analyst", description: "Data exploration and insight generation. Creates dashboards, queries datasets, and builds analytical reports.", vendor: "google", model: "Gemini 2.0 Flash", status: "active", monthly_cost: 1200, tokens_used: 2100000, pos_x: 760, pos_y: 100, last_active: "2026-02-18T10:10:00Z", created_at: "2025-10-01T00:00:00Z" },
    { id: "agent-7", dept_id: "dept-3", name: "Gemini Pipeline", description: "ETL pipeline development and orchestration. Manages data flow from ingestion to transformation.", vendor: "google", model: "Gemini 2.0 Flash", status: "active", monthly_cost: 1000, tokens_used: 1700000, pos_x: 880, pos_y: 100, last_active: "2026-02-18T07:30:00Z", created_at: "2025-11-10T00:00:00Z" },
    { id: "agent-8", dept_id: "dept-3", name: "Claude Data QA", description: "Data quality assurance. Validates data integrity, detects anomalies, and ensures pipeline reliability.", vendor: "anthropic", model: "Claude Haiku 4.5", status: "error", monthly_cost: 1000, tokens_used: 1400000, pos_x: 820, pos_y: 190, last_active: "2026-02-17T16:20:00Z", created_at: "2025-12-05T00:00:00Z" },
    { id: "agent-9", dept_id: "dept-4", name: "Claude DevOps", description: "Infrastructure automation and CI/CD pipeline management. Handles deployments, monitoring, and incident response.", vendor: "anthropic", model: "Claude Sonnet 4.5", status: "active", monthly_cost: 1100, tokens_used: 1900000, pos_x: 130, pos_y: 410, last_active: "2026-02-18T10:15:00Z", created_at: "2025-08-01T00:00:00Z" },
    { id: "agent-10", dept_id: "dept-5", name: "GPT Security", description: "Automated security scanning and vulnerability detection. Analyzes code for OWASP top-10, dependency risks, and secrets exposure.", vendor: "openai", model: "GPT-4o", status: "active", monthly_cost: 950, tokens_used: 1300000, pos_x: 400, pos_y: 400, last_active: "2026-02-18T09:00:00Z", created_at: "2025-09-01T00:00:00Z" },
    { id: "agent-11", dept_id: "dept-5", name: "Claude Auditor", description: "Compliance auditing and security posture assessment. Reviews access controls, data handling, and regulatory requirements.", vendor: "anthropic", model: "Claude Haiku 4.5", status: "idle", monthly_cost: 750, tokens_used: 1100000, pos_x: 520, pos_y: 400, last_active: "2026-02-17T18:00:00Z", created_at: "2025-10-15T00:00:00Z" },
  ];
  await insert("agents", agents);

  // Agent Skills
  const agentSkills = [
    ...["skill-1","skill-2","skill-5","skill-10"].map(s => ({ agent_id: "agent-1", skill_id: s })),
    ...["skill-1","skill-3","skill-10"].map(s => ({ agent_id: "agent-2", skill_id: s })),
    ...["skill-5","skill-3","skill-2"].map(s => ({ agent_id: "agent-3", skill_id: s })),
    ...["skill-1","skill-2","skill-4"].map(s => ({ agent_id: "agent-4", skill_id: s })),
    ...["skill-1","skill-3","skill-9"].map(s => ({ agent_id: "agent-5", skill_id: s })),
    ...["skill-7","skill-1","skill-4"].map(s => ({ agent_id: "agent-6", skill_id: s })),
    ...["skill-7","skill-8"].map(s => ({ agent_id: "agent-7", skill_id: s })),
    ...["skill-3","skill-7","skill-5"].map(s => ({ agent_id: "agent-8", skill_id: s })),
    ...["skill-8","skill-5","skill-4"].map(s => ({ agent_id: "agent-9", skill_id: s })),
    ...["skill-6","skill-2","skill-5"].map(s => ({ agent_id: "agent-10", skill_id: s })),
    ...["skill-6","skill-4","skill-2"].map(s => ({ agent_id: "agent-11", skill_id: s })),
  ];
  await insert("agent_skills", agentSkills);

  // Plugins
  let pc = 0;
  function p(agent_id, name, icon, description, version, enabled) {
    return { id: `plugin-${++pc}`, agent_id, name, icon, description, version, enabled };
  }
  const plugins = [
    p("agent-1", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true),
    p("agent-1", "Prettier", "✨", "Format code automatically on save", "4.0.1", true),
    p("agent-1", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true),
    p("agent-1", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true),
    p("agent-2", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true),
    p("agent-2", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true),
    p("agent-2", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true),
    p("agent-3", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true),
    p("agent-3", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true),
    p("agent-3", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", false),
    p("agent-4", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true),
    p("agent-4", "Prettier", "✨", "Format code automatically on save", "4.0.1", true),
    p("agent-4", "Storybook", "📖", "UI component development and documentation", "8.0.2", true),
    p("agent-5", "ESLint Integration", "📐", "Auto-fix lint errors and enforce code style", "3.2.0", true),
    p("agent-5", "Prettier", "✨", "Format code automatically on save", "4.0.1", true),
    p("agent-5", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true),
    p("agent-6", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", true),
    p("agent-7", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true),
    p("agent-7", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true),
    p("agent-7", "Terraform IaC", "🏗️", "Infrastructure as Code provisioning", "2.3.0", true),
    p("agent-8", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true),
    p("agent-8", "Jest Runner", "🃏", "Run and watch Jest test suites", "2.1.0", true),
    p("agent-9", "Docker Manager", "🐳", "Build, run, and manage Docker containers", "1.8.3", true),
    p("agent-9", "Terraform IaC", "🏗️", "Infrastructure as Code provisioning", "2.3.0", true),
    p("agent-9", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true),
    p("agent-9", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true),
    p("agent-9", "Datadog APM", "📈", "Application performance monitoring and tracing", "1.9.0", true),
    p("agent-10", "SonarQube Scanner", "📡", "Static analysis for code quality and security", "1.5.2", true),
    p("agent-10", "Sentry Error Tracking", "🚨", "Track and resolve production errors", "2.0.0", true),
    p("agent-10", "GitHub Actions", "⚙️", "Manage CI/CD workflows via GitHub Actions", "3.1.0", true),
    p("agent-11", "SonarQube Scanner", "📡", "Static analysis for code quality and security", "1.5.2", true),
  ];
  await insert("plugins", plugins);

  // MCP Tools
  let mc = 0;
  function m(agent_id, name, server, icon, description, category) {
    return { id: `mcp-${++mc}`, agent_id, name, server, icon, description, category };
  }
  const mcpTools = [
    m("agent-1", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-1", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database"),
    m("agent-1", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-1", "Redis", "mcp-server-redis", "🔴", "Manage Redis cache and data structures", "database"),
    m("agent-1", "Linear", "mcp-server-linear", "📋", "Manage Linear issues, projects, and sprints", "api"),
    m("agent-2", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-2", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-2", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database"),
    m("agent-3", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-3", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database"),
    m("agent-3", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication"),
    m("agent-3", "Redis", "mcp-server-redis", "🔴", "Manage Redis cache and data structures", "database"),
    m("agent-4", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-4", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-4", "Puppeteer", "mcp-server-puppeteer", "🌐", "Browser automation, screenshots, and web scraping", "browser"),
    m("agent-4", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api"),
    m("agent-5", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-5", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-5", "Puppeteer", "mcp-server-puppeteer", "🌐", "Browser automation, screenshots, and web scraping", "browser"),
    m("agent-6", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-6", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database"),
    m("agent-6", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database"),
    m("agent-6", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api"),
    m("agent-7", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-7", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database"),
    m("agent-7", "AWS", "mcp-server-aws", "☁️", "Manage AWS services (S3, Lambda, EC2, etc.)", "api"),
    m("agent-7", "Kubernetes", "mcp-server-kubernetes", "☸️", "Manage K8s clusters, pods, and deployments", "devtools"),
    m("agent-8", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-8", "PostgreSQL", "mcp-server-postgres", "🐘", "Query and manage PostgreSQL databases", "database"),
    m("agent-8", "BigQuery", "mcp-server-bigquery", "🔎", "Query and manage Google BigQuery datasets", "database"),
    m("agent-8", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication"),
    m("agent-9", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-9", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-9", "Kubernetes", "mcp-server-kubernetes", "☸️", "Manage K8s clusters, pods, and deployments", "devtools"),
    m("agent-9", "AWS", "mcp-server-aws", "☁️", "Manage AWS services (S3, Lambda, EC2, etc.)", "api"),
    m("agent-9", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication"),
    m("agent-10", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-10", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-10", "Slack", "mcp-server-slack", "💬", "Send messages and manage Slack channels", "communication"),
    m("agent-10", "Jira", "mcp-server-jira", "🎫", "Manage Jira tickets, sprints, and boards", "api"),
    m("agent-11", "Filesystem", "mcp-server-filesystem", "📁", "Read, write, and manage files and directories", "filesystem"),
    m("agent-11", "GitHub", "mcp-server-github", "🐙", "Manage repos, PRs, issues, and code reviews", "api"),
    m("agent-11", "Notion", "mcp-server-notion", "📓", "Read and update Notion pages and databases", "api"),
    m("agent-11", "Jira", "mcp-server-jira", "🎫", "Manage Jira tickets, sprints, and boards", "api"),
  ];
  await insert("mcp_tools", mcpTools);

  // Agent Resources
  let rc = 0;
  function r(agent_id, type, name, icon, description, url, access_level) {
    return { id: `res-${++rc}`, agent_id, type, name, icon, description, url, access_level, created_at: "2025-11-01T00:00:00Z" };
  }
  const resources = [
    r("agent-1", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "write"),
    r("agent-1", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read"),
    r("agent-1", "database", "acme-staging-db", "🐘", "PostgreSQL staging database", "postgresql://staging.acme.internal:5432/main", "write"),
    r("agent-2", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "write"),
    r("agent-2", "database", "acme-staging-db", "🐘", "PostgreSQL staging database", "postgresql://staging.acme.internal:5432/main", "write"),
    r("agent-3", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "read"),
    r("agent-3", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read"),
    r("agent-4", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "write"),
    r("agent-4", "storage", "acme-assets", "☁️", "S3 bucket for static assets and uploads", "s3://acme-assets-prod", "write"),
    r("agent-5", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "write"),
    r("agent-6", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "write"),
    r("agent-6", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "admin"),
    r("agent-6", "storage", "data-lake", "☁️", "S3 data lake for raw and processed data", "s3://acme-data-lake", "write"),
    r("agent-7", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "write"),
    r("agent-7", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "admin"),
    r("agent-7", "storage", "data-lake", "☁️", "S3 data lake for raw and processed data", "s3://acme-data-lake", "write"),
    r("agent-7", "storage", "acme-backups", "☁️", "S3 bucket for database backups", "s3://acme-db-backups", "read"),
    r("agent-8", "git_repo", "data-pipelines", "📦", "ETL pipelines and data processing", "https://github.com/acme/data-pipelines", "read"),
    r("agent-8", "database", "analytics-warehouse", "🔎", "BigQuery analytics data warehouse", "bigquery://acme-corp/analytics", "read"),
    r("agent-8", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read"),
    r("agent-9", "git_repo", "infra-config", "📦", "Infrastructure as Code repository", "https://github.com/acme/infra-config", "admin"),
    r("agent-9", "database", "acme-prod-db", "🐘", "Primary PostgreSQL production database", "postgresql://prod.acme.internal:5432/main", "read"),
    r("agent-9", "storage", "acme-backups", "☁️", "S3 bucket for database backups", "s3://acme-db-backups", "read"),
    r("agent-9", "storage", "acme-assets", "☁️", "S3 bucket for static assets and uploads", "s3://acme-assets-prod", "write"),
    r("agent-10", "git_repo", "security-policies", "📦", "Security policies and scanning configs", "https://github.com/acme/security-policies", "write"),
    r("agent-10", "git_repo", "backend-api", "📦", "Core backend API monorepo", "https://github.com/acme/backend-api", "read"),
    r("agent-10", "git_repo", "web-app", "📦", "Main frontend web application", "https://github.com/acme/web-app", "read"),
    r("agent-11", "git_repo", "security-policies", "📦", "Security policies and scanning configs", "https://github.com/acme/security-policies", "write"),
    r("agent-11", "git_repo", "infra-config", "📦", "Infrastructure as Code repository", "https://github.com/acme/infra-config", "read"),
  ];
  await insert("agent_resources", resources);

  // Cost History
  const costHistory = [
    ...makeCostHistory("dept-1", 3800, { anthropic: 0.6, openai: 0.25, google: 0.15 }),
    ...makeCostHistory("dept-2", 2400, { anthropic: 0.2, openai: 0.65, google: 0.15 }),
    ...makeCostHistory("dept-3", 3200, { anthropic: 0.15, openai: 0.2, google: 0.65 }),
    ...makeCostHistory("dept-4", 1100, { anthropic: 0.7, openai: 0.15, google: 0.15 }),
    ...makeCostHistory("dept-5", 1700, { anthropic: 0.25, openai: 0.55, google: 0.2 }),
  ];
  await insert("cost_history", costHistory);

  // Usage History
  const usageHistory = [
    ...makeDailyUsage("agent-1", 350000, 52, 180),
    ...makeDailyUsage("agent-2", 260000, 41, 150),
    ...makeDailyUsage("agent-3", 220000, 37, 120),
    ...makeDailyUsage("agent-4", 290000, 44, 160),
    ...makeDailyUsage("agent-5", 230000, 38, 130),
    ...makeDailyUsage("agent-6", 300000, 42, 170),
    ...makeDailyUsage("agent-7", 240000, 35, 140),
    ...makeDailyUsage("agent-8", 200000, 34, 110),
    ...makeDailyUsage("agent-9", 270000, 38, 145),
    ...makeDailyUsage("agent-10", 190000, 33, 100),
    ...makeDailyUsage("agent-11", 160000, 26, 85),
  ];
  await insert("usage_history", usageHistory);

  console.log("\nDone! Seeded all tables.");
}

seed().catch(console.error);
