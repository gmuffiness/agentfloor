# Documentation Update

You are running a documentation sync check. Your job is to compare the project's documentation files against the actual codebase and update any outdated sections.

## Target Documentation Files

These are the documentation files to check and update:

1. `.claude/CLAUDE.md` — Project instructions (most critical, used by Claude Code)
2. `AGENTS.md` — Agent instructions for AI coding agents
3. `README.md` — Public-facing project README
4. `docs/architecture.md` — System design, tech stack, directory structure
5. `docs/data-model.md` — Entity hierarchy, types, database schema
6. `docs/api-reference.md` — All API endpoints with examples
7. `docs/cli.md` — CLI commands, config format, troubleshooting

## Step 1: Gather Current Codebase State

Silently gather the following information before touching any docs. Run these in parallel where possible.

### Routes (Pages)
- Glob for `src/app/**/page.tsx` to get all current page routes
- Note the route structure (flat vs org-scoped, any new pages)

### API Routes
- Glob for `src/app/api/**/route.ts` to get all current API endpoints
- Note the endpoint structure and any new resources

### Components
- Glob for `src/components/**/*.tsx` to get all component files
- Note the directory organization (ui/, spatial/, graph/, panels/, charts/, database/, chat/, org-chart/, etc.)

### Types
- Read `src/types/index.ts` to get all current type definitions
- Note any new types, enums, or modified fields

### Database Migrations
- Glob for `supabase/migrations/*.sql` to list all migrations
- Note any new tables or schema changes

### Store
- Read `src/stores/app-store.ts` to check state shape and actions

### Other Key Files
- Check `src/lib/` for utility files (auth.ts, utils.ts, etc.)
- Check `src/middleware.ts` if it exists
- Check `src/db/` for database layer files
- Check `cli/` directory structure

## Step 2: Read All Documentation Files

Read all 7 documentation files listed above in parallel.

## Step 3: Identify Discrepancies

Compare the gathered codebase state against each documentation file. Common things that go out of date:

### Route/Page changes
- New pages added but not listed in docs
- Route structure changed (e.g., flat `/agents` → org-scoped `/org/[orgId]/agents`)
- Pages removed or renamed

### API endpoint changes
- New endpoints not documented
- Endpoint paths changed (e.g., flat → org-scoped)
- Request/response body changes

### Component structure changes
- New component directories or files
- UI layout changes (e.g., TopBar → Sidebar navigation)
- Renamed or removed components

### Type/data model changes
- New types or interfaces added
- Fields added/removed from existing types
- New enums or enum values

### Database schema changes
- New migration files (new tables, columns)
- Schema doc only references old migrations

### Architecture changes
- Directory structure outdated
- Tech stack changes (e.g., SQLite → Supabase)
- Auth flow changes
- New patterns or conventions

### CLI changes
- New commands added
- Command behavior changes
- Config format changes

## Step 4: Update Documentation

For each discrepancy found, edit the relevant documentation file. Follow these rules:

- **Preserve the existing writing style** (Korean/English mix, formatting patterns)
- **Only update what's actually wrong** — don't rewrite sections that are still accurate
- **Keep descriptions concise** — match the brevity level of the existing docs
- **Update all references** — if a path changes, update it everywhere across all docs
- **Don't add commentary** — just fix the facts

## Step 5: Summary

After all updates, show a summary of changes:

```
Documentation Update Summary

[file]: [number of changes]
  - [brief description of each change]
```

If no changes were needed, say so:
```
All documentation is up to date. No changes needed.
```
