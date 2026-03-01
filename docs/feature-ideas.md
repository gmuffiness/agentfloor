# Feature Ideas & Enhancement Notes

> Collected ideas for future AgentFactorio improvements, drawn from internal brainstorming and analysis of related open-source projects in the AI agent tooling space.

## 1. Spatial Map Enhancements

### Agent State Machine (FSM) for Avatars

Currently avatars are static sprites. Introduce a lightweight finite state machine to make them feel alive:

- **States**: `idle` → `active` → `blocked` → `offline`
- **Visual cues**: Typing animation when an agent is running tools, reading animation during file scans, idle bounce when waiting
- **Blocked indicator**: Speech bubble overlay (amber for permission-pending, red for errors) — gives instant fleet-level awareness without opening drawers

### Layout Customization

Let org admins customize department room layouts beyond the current auto-placement:

- Tile-based floor painting (color per department)
- Drag-to-place furniture/desk items within rooms
- Export/import layouts as JSON for sharing across orgs
- Persist user-level layout preferences (per-member view customization)

### Rendering Architecture

Consider separating game state from React state for smoother Pixi.js animation:

- Maintain an imperative `SpatialState` class that owns positions, animations, and transitions
- React only pushes data updates (heartbeats, status changes) into the spatial state
- The Pixi.js game loop reads from spatial state at consistent FPS, avoiding React re-render overhead

## 2. Real-Time Activity & Heartbeat

### Enhanced Heartbeat Protocol

Current heartbeat is a one-shot PATCH on session start. Evolve it into a proper liveness system:

- **Periodic heartbeat**: Agent sends a ping every 5 minutes during active session
- **Server-side timeout ladder**: 15 min without ping → `idle`, 1 hour → `offline`
- **Activity metadata**: Include current tool/skill being used, file count modified, token consumption delta
- **Dashboard reflection**: Avatar opacity fades for idle agents, grays out for offline — all visible on spatial map without clicks

### Push-Based Updates

Replace polling with event-driven updates for the dashboard:

- Option A: Supabase Realtime subscriptions on `agents` table changes
- Option B: Server-Sent Events (SSE) from a lightweight endpoint
- Debounce rapid updates (0.2s window) to prevent UI thrashing during burst activity

## 3. Agent Performance Scoring

### Activity-Based Grading

Introduce a simple health/activity grade for each agent (calculated monthly):

| Grade | Criteria |
|-------|----------|
| A | 30+ active sessions, consistent daily usage |
| B | 15+ sessions, regular weekly usage |
| C | 5+ sessions, occasional usage |
| D | 1+ sessions, rarely used |
| F | No activity in the period |

Display as a compact badge on agent cards, spatial map avatars, and table rows. Helps teams quickly spot underutilized or abandoned agents.

### Monthly Trend Bucketing

Store activity snapshots by month (`YYYY-MM` keys) to enable:

- Month-over-month usage comparison charts
- "Most improved agent" highlights
- Seasonal usage pattern detection

## 4. Skill Catalog Evolution

### One-Click Skill Adoption

Transform the read-only skill catalog into an actionable tool:

- "Add to my agent" button that generates the CLI command or directly patches the agent config
- Popularity sorting (most-used skills bubble up)
- "Similar skills" recommendation based on shared usage patterns
- Skill compatibility tags (which vendors/models support it)

### Skill Quality Indicators

Track not just usage count but effectiveness signals:

- Success rate (did the skill complete without user correction?)
- Average token cost per invocation
- User satisfaction proxy (was the output accepted or re-prompted?)

## 5. Session & Workflow Observability

### Session Timeline View

Add a per-agent session history view that shows:

- Session start/end timestamps with duration
- Tools invoked during the session (sequence diagram style)
- Token consumption breakdown (input vs output vs cache hits)
- Git branch and working directory context

This goes beyond "is the agent alive" to "what is the agent doing and how efficiently."

### Discriminated Event Schema

Structure session events with a typed union for rich replay:

- `HumanMessage`: User input blocks
- `AgentResponse`: Model output with token usage and cache metrics
- `ToolExecution`: Tool name, input, result, duration, approval status
- `ProgressEvent`: Real-time execution updates

Enables future features like session replay, cost attribution per action, and anomaly detection.

## 6. CLI & Developer Experience

### Project Auto-Discovery

Instead of requiring explicit `push` for every project, offer an opt-in watcher mode:

- Daemon watches `~/.claude` directories for new JSONL session logs
- Auto-registers agents when new projects are detected
- Git-aware watching: detect all worktrees for a repo, not just the main checkout
- Configurable: explicit-only, auto-detect-and-confirm, or full-auto

### Quick Operations

Add streamlined CLI commands for common workflows:

- `agent-factorio status --watch` — Live terminal dashboard (like `htop` for agents)
- `agent-factorio recommend` — Suggest skills based on team's popular configurations
- `agent-factorio clone <agent-id>` — Copy another agent's skill/MCP setup to your project

## 7. Team & Organization Features

### RBAC Refinement

Current model has admin/member roles. Consider a lightweight permission layer:

- **Viewer**: Read-only access (good for stakeholders, PMs)
- **Member**: Can register/update own agents
- **Admin**: Full org management (members, departments, settings)
- Viewer role would replace the current template org read-only check with a first-class concept

### Keyboard-First Navigation

For power users who live in the dashboard, add vim-style shortcuts:

- `j/k` for list navigation
- `/` to trigger search mode
- `Enter` to open detail drawer
- `Escape` to close modals/drawers
- `?` for shortcut help overlay

### Cross-Org Insights (Future)

For companies running multiple orgs, provide a meta-dashboard:

- Aggregate agent count, cost, and activity across all orgs
- Benchmark departments against each other
- Identify skill/tool overlap and consolidation opportunities

## 8. Infrastructure & Architecture

### Feature-Based Module Organization

As the codebase grows, consider reorganizing from current component-type grouping to feature-based:

```
src/features/
  spatial-map/     # Pixi.js canvas, avatar rendering, layout editor
  graph/           # React Flow nodes, edges, relationship viz
  agents/          # Agent table, CRUD, detail drawer
  skills/          # Skill catalog, recommendation engine
  cost/            # Cost charts, budget alerts, trend analysis
  chat/            # Chat interface, message history
  settings/        # Org settings, member management
```

Each feature owns its components, hooks, types, and API calls — reduces cross-feature coupling.

### Type-Safe API Layer

Consider adopting Protocol Buffers or a similar IDL for CLI-to-API communication:

- Auto-generate TypeScript types from the schema (no manual `types/index.ts` maintenance)
- Version API contracts explicitly (breaking changes become compile errors)
- Enables future multi-language CLI support (Go, Python) with shared contracts

### Service Layer Abstraction

Centralize all external API calls through a single service module:

- Makes it trivial to add caching, retry logic, or mock implementations
- Enables easy protocol swaps (REST → gRPC, polling → WebSocket) without touching components
- Single point for auth token injection and error handling

---

## Priority Matrix

| Idea | Impact | Effort | Suggested Phase |
|------|--------|--------|-----------------|
| Enhanced heartbeat protocol | High | Low | Phase 1 |
| Agent activity grading | Medium | Low | Phase 1 |
| Push-based dashboard updates | High | Medium | Phase 1 |
| Avatar FSM animation | High | Medium | Phase 2 |
| Skill adoption actions | High | Medium | Phase 2 |
| Session timeline view | High | High | Phase 2 |
| Keyboard navigation | Medium | Low | Phase 2 |
| Layout customization | Medium | High | Phase 3 |
| Feature-based module reorg | Medium | High | Phase 3 |
| CLI auto-discovery daemon | Medium | High | Phase 3 |
| Type-safe API layer | Medium | High | Phase 3 |
| Cross-org insights | Low | High | Future |
