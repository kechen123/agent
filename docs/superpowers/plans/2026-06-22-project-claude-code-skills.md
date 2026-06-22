# Project Claude Code Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-root Claude Code `skills/*/SKILL.md` support, safe Skills listing API, and a display-only frontend Skills panel.

**Architecture:** Keep the Skill registry as the in-memory source of truth, add a focused project Skill parser/loader, and register built-in Skills before project Skills so project files can override built-ins. Agents share one helper for selected Skill prompt injection, while Router only receives Skill names and descriptions. The frontend fetches `GET /skills` into app state and renders a lightweight panel from both Sidebar and Chat header.

**Tech Stack:** Node.js, TypeScript, Hono, LangGraph, LangChain, React, Vite, TailwindCSS, `gray-matter` for mature YAML frontmatter parsing.

---

## File Map

### Backend

- Modify `package.json`: add `gray-matter` dependency. Because commands are not run in this session, the implementer/user must run `pnpm install` manually before typecheck.
- Modify `src/types/agent.ts`: add `SkillSource`, `RegisteredSkill`, and `SkillSummary` types.
- Modify `src/skills/registry.ts`: store source metadata, expose enabled/all listing, summaries, and stable sorting.
- Create `src/skills/project-loader.ts`: scan project root `skills/*/SKILL.md`, size-check, parse frontmatter, validate, prevent path traversal, log per-file success/failure.
- Create `src/skills/prompt.ts`: shared helper to append a selected Skill prompt once per agent invocation.
- Modify `src/skills/index.ts`: register built-ins with `builtin` source, load project Skills after built-ins, export new helpers.
- Modify `src/runtime/index.ts`: call `loadProjectSkills()` after `registerBuiltinSkills()`.
- Modify `src/agents/planner/planner.ts`: inject selected Skill prompt.
- Modify `src/agents/executor/executor.ts`: inject selected Skill prompt.
- Modify `src/agents/tool/tool.ts`: inject selected Skill prompt.
- Confirm/keep `src/agents/reply/reply.ts`: switch to shared helper to avoid duplicate local logic.
- Modify `src/agents/router/router.ts`: keep catalog as name/description only and validate against enabled Skills.
- Create `src/routes/skills.route.ts`: implement `GET /skills` safe summary endpoint.
- Modify `src/app.ts`: mount Skills route.
- Modify `.env.example`: clarify `ENABLED_SKILLS`.
- Modify `README.md` and `AGENTS.md`: document project Skill format and limitations.

### Frontend

- Create `web/src/types/skills.ts`: frontend summary response types.
- Create `web/src/services/skillsApi.ts`: fetch `/skills` safely.
- Create `web/src/components/skills/SkillsPanel.tsx`: display-only panel with refresh/error/empty states.
- Modify `web/src/app/AssistantApp.tsx`: own Skills state, load on mount, pass panel open/count callbacks.
- Modify `web/src/components/layout/Sidebar.tsx`: add bottom Skills entry.
- Modify `web/src/components/agent/ChatView.tsx`: add enabled Skills header pill.
- Modify `web/vite.config.ts`: proxy `/skills` to backend.

---

## Task 1: Add Backend Skill Types and Registry Metadata

**Files:**
- Modify: `src/types/agent.ts`
- Modify: `src/skills/registry.ts`
- Modify: `src/skills/index.ts`

- [ ] **Step 1: Extend Skill types**

In `src/types/agent.ts`, replace the Skill section with:

```ts
// ─── 技能 ───────────────────────────────────────────────────────────────────

export type SkillSource = "builtin" | "project";

export interface Skill {
  name: string;
  description: string;
  systemPrompt: string;
  // 该技能允许使用的工具名称。
  tools?: string[];
}

export interface RegisteredSkill extends Skill {
  source: SkillSource;
}

export interface SkillSummary {
  name: string;
  description: string;
  source: SkillSource;
  enabled: boolean;
}
```

- [ ] **Step 2: Update registry implementation**

Replace `src/skills/registry.ts` with:

```ts
import { config } from "../config";
import type { RegisteredSkill, Skill, SkillSource, SkillSummary } from "../types/agent";

const registry = new Map<string, RegisteredSkill>();

function isEnabled(name: string): boolean {
  const enabled = config.enabledSkills;
  return enabled.length === 0 || enabled.includes(name);
}

/** 注册一个 skill。同名 skill 会被覆盖。 */
export function registerSkill(skill: Skill, source: SkillSource = "builtin"): void {
  registry.set(skill.name, { ...skill, source });
}

export function getSkillByName(name: string): RegisteredSkill | undefined {
  const skill = registry.get(name);
  if (!skill || !isEnabled(skill.name)) return undefined;
  return skill;
}

export function listSkills(): RegisteredSkill[] {
  return Array.from(registry.values()).filter((skill) => isEnabled(skill.name));
}

export function listAllSkills(): RegisteredSkill[] {
  return Array.from(registry.values());
}

export function listSkillSummaries(): SkillSummary[] {
  return listAllSkills()
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      source: skill.source,
      enabled: isEnabled(skill.name),
    }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** 以简洁目录形式返回 skill 列表，供 router 提示词使用。 */
export function skillCatalogText(): string {
  const skills = listSkills();
  if (skills.length === 0) return "（暂无可用 skill）";
  return skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
}
```

- [ ] **Step 3: Update skill exports and built-in source**

In `src/skills/index.ts`, replace the file with:

```ts
import { registerSkill } from "./registry";
import { frontendSkill } from "./frontend.skill";

/** 注册内置 skills。启动时调用一次。 */
export function registerBuiltinSkills(): void {
  registerSkill(frontendSkill, "builtin");
}

export {
  registerSkill,
  getSkillByName,
  listSkills,
  listAllSkills,
  listSkillSummaries,
  skillCatalogText,
} from "./registry";
export { frontendSkill } from "./frontend.skill";
```

- [ ] **Step 4: Manual verification command**

Do not run automatically. When ready, user can run:

```bash
pnpm typecheck
```

Expected after only this task: may still pass because no new dependency is used yet.

---

## Task 2: Add Project Skill Loader

**Files:**
- Modify: `package.json`
- Create: `src/skills/project-loader.ts`
- Modify: `src/skills/index.ts`
- Modify: `src/runtime/index.ts`

- [ ] **Step 1: Add YAML frontmatter dependency**

In `package.json`, add `gray-matter` to `dependencies`:

```json
"gray-matter": "^4.0.3"
```

The dependencies block should include:

```json
"dependencies": {
  "@hono/node-server": "^2.0.5",
  "@langchain/core": "^1.1.49",
  "@langchain/langgraph": "^1.4.2",
  "@langchain/openai": "^1.4.7",
  "dotenv": "^17.4.2",
  "gray-matter": "^4.0.3",
  "hono": "^4.12.25",
  "zod": "^4.4.3"
}
```

- [ ] **Step 2: Create project loader**

Create `src/skills/project-loader.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { registerSkill } from "./registry";
import type { Skill } from "../types/agent";

const PROJECT_ROOT = path.resolve(process.cwd());
const PROJECT_SKILLS_DIR = path.join(PROJECT_ROOT, "skills");
const SKILL_FILE_NAME = "SKILL.md";
const MAX_SKILL_FILE_BYTES = 256 * 1024;
const SAFE_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSkillFile(filePath: string): Skill {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error("SKILL.md 不是文件");
  }
  if (stat.size > MAX_SKILL_FILE_BYTES) {
    throw new Error(`SKILL.md 超过大小限制 ${MAX_SKILL_FILE_BYTES} bytes`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);

  const name = asNonEmptyString(parsed.data.name);
  if (!name) throw new Error("frontmatter 缺少 name");
  if (!SAFE_SKILL_NAME.test(name)) {
    throw new Error(`frontmatter name 格式非法：${name}`);
  }

  const description = asNonEmptyString(parsed.data.description);
  if (!description) throw new Error("frontmatter 缺少 description");

  const systemPrompt = parsed.content.trim();
  if (!systemPrompt) throw new Error("SKILL.md 正文为空");

  return { name, description, systemPrompt };
}

export function loadProjectSkills(): void {
  if (!fs.existsSync(PROJECT_SKILLS_DIR)) {
    console.log(`[Skills] project skills directory not found: ${PROJECT_SKILLS_DIR}`);
    return;
  }

  const skillsDir = fs.realpathSync(PROJECT_SKILLS_DIR);
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, SKILL_FILE_NAME);

    try {
      const realSkillFile = fs.realpathSync(skillFile);
      if (!isInside(skillsDir, realSkillFile)) {
        throw new Error("SKILL.md 路径越过项目 skills 目录");
      }

      const skill = parseSkillFile(realSkillFile);
      registerSkill(skill, "project");
      console.log(`[Skills] loaded project skill: ${skill.name}`);
    } catch (err) {
      console.error(`[Skills] failed to load project skill from ${entry.name}/${SKILL_FILE_NAME}:`, err);
    }
  }
}
```

- [ ] **Step 3: Export loader**

In `src/skills/index.ts`, add:

```ts
export { loadProjectSkills } from "./project-loader";
```

The final file should be:

```ts
import { registerSkill } from "./registry";
import { frontendSkill } from "./frontend.skill";

/** 注册内置 skills。启动时调用一次。 */
export function registerBuiltinSkills(): void {
  registerSkill(frontendSkill, "builtin");
}

export {
  registerSkill,
  getSkillByName,
  listSkills,
  listAllSkills,
  listSkillSummaries,
  skillCatalogText,
} from "./registry";
export { loadProjectSkills } from "./project-loader";
export { frontendSkill } from "./frontend.skill";
```

- [ ] **Step 4: Load project Skills after built-ins**

In `src/runtime/index.ts`, update imports and registration:

```ts
import { registerBuiltinSkills, loadProjectSkills } from "../skills";

// 模块加载时一次性注册内置工具和 skills。
registerBuiltinTools();
registerBuiltinSkills();
loadProjectSkills();
```

- [ ] **Step 5: Manual dependency install**

Do not run automatically. User should run:

```bash
pnpm install
```

Expected: `gray-matter` is installed and lockfile is updated.

---

## Task 3: Add Shared Skill Prompt Injection to Agents

**Files:**
- Create: `src/skills/prompt.ts`
- Modify: `src/skills/index.ts`
- Modify: `src/agents/planner/planner.ts`
- Modify: `src/agents/executor/executor.ts`
- Modify: `src/agents/tool/tool.ts`
- Modify: `src/agents/reply/reply.ts`

- [ ] **Step 1: Create prompt helper**

Create `src/skills/prompt.ts`:

```ts
import { getSkillByName } from "./registry";
import type { AgentRuntimeState } from "../runtime/state";

export function skillPromptForState(state: AgentRuntimeState): string {
  if (!state.skillName) return "";
  return getSkillByName(state.skillName)?.systemPrompt ?? "";
}

export function withSkillPrompt(basePrompt: string, skillPrompt: string): string {
  const trimmed = skillPrompt.trim();
  return trimmed ? `${basePrompt}\n\n# 领域 Skill 提示\n${trimmed}` : basePrompt;
}
```

- [ ] **Step 2: Export prompt helper**

In `src/skills/index.ts`, add:

```ts
export { skillPromptForState, withSkillPrompt } from "./prompt";
```

- [ ] **Step 3: Inject Skill prompt into PlannerAgent**

In `src/agents/planner/planner.ts`, add import:

```ts
import { skillPromptForState, withSkillPrompt } from "../../skills";
```

Change `buildChain` to accept a prompt:

```ts
const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{messages}"],
  ]);
  return prompt.pipe(plannerModel);
};
```

Change invoke chain creation:

```ts
const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
```

- [ ] **Step 4: Inject Skill prompt into ExecutorAgent**

In `src/agents/executor/executor.ts`, add import:

```ts
import { skillPromptForState, withSkillPrompt } from "../../skills";
```

Change `buildChain` to:

```ts
const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    [
      "human",
      `目标：{goal}
当前步骤（第 {stepId} 步）：{task}
已执行结果：{previousResults}

请用一句话给出该步骤的执行结果。`,
    ],
  ]);
  return prompt.pipe(model);
};
```

Change invoke chain creation:

```ts
const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
```

- [ ] **Step 5: Inject Skill prompt into ToolAgent**

In `src/agents/tool/tool.ts`, add import:

```ts
import { skillPromptForState, withSkillPrompt } from "../../skills";
```

Change `buildChain` to:

```ts
const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{messages}"],
  ]);
  // 从注册表绑定所有启用的工具（graph.ts 不硬编码工具）。
  return prompt.pipe(model.bindTools(getTools()));
};
```

Change invoke chain creation:

```ts
const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
```

- [ ] **Step 6: Use shared helper in ReplyAgent**

In `src/agents/reply/reply.ts`, replace:

```ts
import { getSkillByName } from "../../skills";
```

with:

```ts
import { skillPromptForState, withSkillPrompt } from "../../skills";
```

Remove the local `withSkillPrompt` function.

In `invoke`, replace:

```ts
const skill = state.skillName ? getSkillByName(state.skillName) : undefined;
const skillPrompt = skill?.systemPrompt ?? "";
```

with:

```ts
const skillPrompt = skillPromptForState(state);
```

Leave `buildChatChain` and `buildTaskChain` using the imported `withSkillPrompt`.

---

## Task 4: Add Safe Skills API

**Files:**
- Create: `src/routes/skills.route.ts`
- Modify: `src/app.ts`
- Modify: `web/vite.config.ts`

- [ ] **Step 1: Create Hono route**

Create `src/routes/skills.route.ts`:

```ts
import { Hono } from "hono";
import { listSkillSummaries } from "../skills";

export const skillsRoute = new Hono();

/** GET /skills — 返回安全的 Skill 摘要，不包含 systemPrompt 或本地路径。 */
skillsRoute.get("/skills", (c) => {
  return c.json({ skills: listSkillSummaries() });
});
```

- [ ] **Step 2: Mount route**

In `src/app.ts`, add import:

```ts
import { skillsRoute } from "./routes/skills.route";
```

Then mount it after health and before/after chat route:

```ts
app.route("/", skillsRoute);
app.route("/", chatRoute);
```

- [ ] **Step 3: Proxy `/skills` in Vite**

In `web/vite.config.ts`, add to `server.proxy`:

```ts
"/skills": {
  target: proxyTarget,
  changeOrigin: true,
},
```

Final proxy should include `/chat`, `/health`, and `/skills`.

---

## Task 5: Add Frontend Skills API and Panel

**Files:**
- Create: `web/src/types/skills.ts`
- Create: `web/src/services/skillsApi.ts`
- Create: `web/src/components/skills/SkillsPanel.tsx`

- [ ] **Step 1: Add frontend types**

Create `web/src/types/skills.ts`:

```ts
export type SkillSource = "builtin" | "project";

export interface SkillSummary {
  name: string;
  description: string;
  source: SkillSource;
  enabled: boolean;
}

export interface SkillsResponse {
  skills: SkillSummary[];
}
```

- [ ] **Step 2: Add API client**

Create `web/src/services/skillsApi.ts`:

```ts
import type { SkillsResponse } from "../types/skills";

export async function fetchSkills(signal?: AbortSignal): Promise<SkillsResponse> {
  const res = await fetch("/skills", { signal });
  if (!res.ok) {
    throw new Error(`Skill 列表请求失败：${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SkillsResponse;
}
```

- [ ] **Step 3: Add SkillsPanel component**

Create `web/src/components/skills/SkillsPanel.tsx`:

```tsx
import type { SkillSummary } from "../../types/skills";

interface SkillsPanelProps {
  open: boolean;
  skills: SkillSummary[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

const sourceLabel: Record<SkillSummary["source"], string> = {
  builtin: "内置 Skill",
  project: "项目 Skill",
};

export function SkillsPanel({
  open,
  skills,
  isLoading,
  error,
  onClose,
  onRefresh,
}: SkillsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭 Skills 面板"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:rounded-l-3xl">
        <header className="flex items-start justify-between gap-4 px-5 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Skills</h2>
            <p className="mt-1 text-sm text-neutral-500">当前项目已注册的 Skill，仅用于查看。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="flex items-center justify-between px-5 pb-3">
          <div className="text-sm text-neutral-500">
            已启用 {skills.filter((skill) => skill.enabled).length} 个 Skills
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "刷新中" : "刷新"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && isLoading && skills.length === 0 && (
            <div className="rounded-3xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              正在加载 Skills…
            </div>
          )}

          {!isLoading && skills.length === 0 && (
            <div className="rounded-3xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              当前没有可用 Skill
            </div>
          )}

          {skills.length > 0 && (
            <div className="space-y-3">
              {skills.map((skill) => (
                <article key={skill.name} className="rounded-3xl bg-neutral-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-neutral-950">{skill.name}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">
                        {skill.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        skill.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {skill.enabled ? "已启用" : "未启用"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-medium text-neutral-500">{sourceLabel[skill.source]}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
```

---

## Task 6: Wire Skills State Into Frontend App

**Files:**
- Modify: `web/src/app/AssistantApp.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`
- Modify: `web/src/components/agent/ChatView.tsx`

- [ ] **Step 1: Update Sidebar props and bottom entry**

In `web/src/components/layout/Sidebar.tsx`, extend props:

```ts
interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
  onAfterSelect?: () => void;
  enabledSkillsCount: number;
  onOpenSkills: () => void;
}
```

Add destructured props:

```ts
enabledSkillsCount,
onOpenSkills,
```

Replace the closing part after `</nav>` with:

```tsx
      <div className="mt-3 pt-3">
        <button
          type="button"
          onClick={onOpenSkills}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <span>Skills</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {enabledSkillsCount}
          </span>
        </button>
      </div>
    </aside>
```

- [ ] **Step 2: Update ChatView props and header pill**

In `web/src/components/agent/ChatView.tsx`, extend props:

```ts
  enabledSkillsCount: number;
  onOpenSkills: () => void;
```

Destructure them.

Replace the right-side header button with a small group:

```tsx
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSkills}
            className="hidden rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:inline-flex"
          >
            已启用 {enabledSkillsCount} 个 Skills
          </button>
          <button
            type="button"
            onClick={onNewThread}
            className="hidden h-9 rounded-full px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:inline-flex sm:items-center"
          >
            新建会话
          </button>
        </div>
```

- [ ] **Step 3: Update AssistantApp imports and state**

In `web/src/app/AssistantApp.tsx`, add imports:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
import { SkillsPanel } from "../components/skills/SkillsPanel";
import { useAgentRuntime } from "../hooks/useAgentRuntime";
import { fetchSkills } from "../services/skillsApi";
import type { SkillSummary } from "../types/skills";
```

If existing imports differ, preserve any existing imports and add these as needed.

Inside `AssistantApp`, add state:

```tsx
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const enabledSkillsCount = useMemo(
    () => skills.filter((skill) => skill.enabled).length,
    [skills],
  );

  const loadSkills = useCallback(async (signal?: AbortSignal) => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const res = await fetchSkills(signal);
      setSkills(res.skills);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setSkillsError((err as Error).message || "Skill 列表加载失败");
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSkills(controller.signal);
    return () => controller.abort();
  }, [loadSkills]);
```

- [ ] **Step 4: Pass props and render panel**

In `AssistantApp` JSX, pass to `Sidebar`:

```tsx
enabledSkillsCount={enabledSkillsCount}
onOpenSkills={() => setSkillsOpen(true)}
```

Pass to `ChatView`:

```tsx
enabledSkillsCount={enabledSkillsCount}
onOpenSkills={() => setSkillsOpen(true)}
```

Render `SkillsPanel` once near the root of the returned JSX:

```tsx
      <SkillsPanel
        open={skillsOpen}
        skills={skills}
        isLoading={skillsLoading}
        error={skillsError}
        onClose={() => setSkillsOpen(false)}
        onRefresh={() => void loadSkills()}
      />
```

Because the exact file was not fully listed in this plan, preserve existing mobile Sidebar/open-menu behavior while adding these props.

---

## Task 7: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.env.example`

- [ ] **Step 1: Update environment descriptions**

In `.env.example`, replace the whitelist comment with:

```dotenv
# 逗号分隔的 Tool / Skill 白名单；留空表示启用所有已注册项。
# ENABLED_SKILLS 会影响 Router 可选 Skill、Agent 注入和 GET /skills 的 enabled 字段。
ENABLED_TOOLS=
ENABLED_SKILLS=
```

- [ ] **Step 2: Add README Skill section**

In `README.md`, replace the current `## 新增 Skill` section with:

```md
## 新增 Skill

本项目支持两类 Skill：

1. **内置 TypeScript Skill**：位于 `src/skills`，适合随代码发布的能力。
2. **项目级 Claude Code Skill 格式**：由用户手动复制到项目根目录 `skills/<skill-name>/SKILL.md`，后端启动时加载。

### 项目级 Claude Code Skill

目录示例：

```text
skills/
└─ frontend-design/
   ├─ SKILL.md
   ├─ references/
   └─ scripts/
```

当前只会加载：

```text
skills/*/SKILL.md
```

不会读取或复制：

```text
C:\Users\Administrator\.claude\skills
```

也不会扫描任何用户目录下的 `.claude/skills`。如需使用 Claude Code Skill，请手动复制到本项目根目录的 `skills/` 中。

`SKILL.md` 使用 Claude Code 标准 frontmatter 格式：

```md
---
name: frontend-design
description: |
  Create production-grade frontend interfaces with strong visual craft.
---

# Frontend Design

Skill 正文会作为 agent4 的 Skill systemPrompt 使用。
```

加载规则：

- 后端启动时先注册 `src/skills` 内置 Skill，再加载项目根目录 `skills/*/SKILL.md`。
- 项目级 Skill 与内置 Skill 同名时，项目级 Skill 覆盖内置 Skill。
- 新增或修改 `SKILL.md` 后，需要重启后端生效。
- `ENABLED_SKILLS` 是逗号分隔白名单；留空表示启用全部已成功注册的 Skill。
- Router 只读取 Skill 的 `name` 和 `description`，不会读取完整正文。
- 命中 Skill 后，Skill 正文会注入 Planner、Executor、Tool 和 Reply Agent。

`references/` 与 `scripts/` 说明：

- 第一版不会自动读取 `references/`。如果需要引用资料，请把必要内容写进 `SKILL.md` 正文，或后续实现受限的 Markdown 引用加载。
- `scripts/` 可以随 Skill 放在目录中，但绝不会自动执行。
- 如果脚本需要真正执行，必须额外封装成项目的 LangChain Tool。
- Claude Code 专属工具、Slash Command、MCP 或本机权限能力不能直接迁移到 agent4 Runtime；只能迁移可表达为提示词、项目 Tool 或后端能力的部分。

### 内置 TypeScript Skill

1. 新建 `src/skills/<name>.skill.ts`。
2. 创建 `Skill` 对象，包含 `name`、`description`、`systemPrompt` 等字段。
3. 在 `src/skills/index.ts` 注册。
```

- [ ] **Step 3: Update API list in README**

In README available interfaces list, add:

```md
- `GET /skills`：返回已成功注册 Skill 的安全摘要，不包含 systemPrompt 或本地路径。
```

In Vite proxy list, add:

```md
- `/skills` → `http://localhost:3000/skills`
```

- [ ] **Step 4: Update AGENTS.md Skill section**

In `AGENTS.md`, replace `### 新增 Skill` with the same content style as README, shortened if needed, including:

```md
### 新增 Skill

支持两类 Skill：

1. 内置 TypeScript Skill：在 `src/skills/<name>.skill.ts` 创建并在 `src/skills/index.ts` 注册。
2. 项目级 Claude Code Skill：用户手动复制到项目根目录 `skills/<skill-name>/SKILL.md`。

项目级目录示例：

```text
skills/
└─ frontend-design/
   ├─ SKILL.md
   ├─ references/
   └─ scripts/
```

只加载 `skills/*/SKILL.md`，不读取、不扫描、不复制 `C:\Users\Administrator\.claude\skills` 或任何用户目录下的 `.claude/skills`。

`SKILL.md` 格式：

```md
---
name: frontend-design
description: |
  Create production-grade frontend interfaces...
---

# Frontend Design

Skill 正文……
```

启动顺序：先注册内置 Skill，再加载项目级 Skill；同名时项目级覆盖内置。`ENABLED_SKILLS` 为空表示启用全部，非空时作为逗号分隔白名单。新增或修改 `SKILL.md` 后必须重启后端。

Router 只读取 `name` 和 `description`。命中 Skill 后，正文会注入 PlannerAgent、ExecutorAgent、ToolAgent 和 ReplyAgent。

第一版不会自动读取 `references/`。`scripts/` 绝不会自动执行；要真正执行脚本，必须封装为项目 LangChain Tool。Claude Code 专属工具能力不能直接迁移。
```

Also update line mentioning only ReplyAgent injection to include all four agents.

---

## Task 8: Manual Validation Checklist

**Files:**
- No code changes required.

- [ ] **Step 1: Install dependency manually**

User runs:

```bash
pnpm install
```

Expected: `gray-matter` is installed and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Backend typecheck manually**

User runs:

```bash
pnpm typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 3: Frontend typecheck manually**

User runs:

```bash
cd web && pnpm typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 4: Frontend build manually**

User runs:

```bash
cd web && pnpm build
```

Expected: Vite build exits successfully.

- [ ] **Step 5: Manual loading checks**

User may create temporary project Skill files manually, then restart backend manually:

```text
skills/frontend-design/SKILL.md
skills/broken/SKILL.md
skills/frontend/SKILL.md
```

Expected checks:

- Valid `skills/<name>/SKILL.md` loads and logs success.
- `name`, multiline YAML `description`, and Markdown body parse correctly.
- Broken Skill logs failure and does not prevent valid Skills from loading.
- `ENABLED_SKILLS=frontend-design` marks only that Skill enabled in `GET /skills`.
- Project `skills/frontend/SKILL.md` overrides built-in `frontend` source as `project`.
- No code path references `C:\Users\Administrator\.claude\skills` except documentation stating it is not read.

- [ ] **Step 6: Manual browser checks**

After user manually starts backend and frontend:

- Desktop Sidebar bottom has `Skills` entry.
- Chat header shows `已启用 N 个 Skills`.
- Skills panel opens from both entries.
- Mobile layout can open the panel and close it.
- If backend `/skills` is unavailable, panel shows an error but chat UI remains usable.
- Browser network response for `/skills` contains no `systemPrompt` and no local file paths.

---

## Self-Review

Spec coverage:

- Project root `skills/*/SKILL.md` loading: Task 2.
- No user `.claude/skills` access/copy: Task 2 and Task 7.
- YAML frontmatter, multiline support, validation, file size, per-file failures: Task 2.
- Built-in registration plus project override: Task 1 and Task 2.
- `ENABLED_SKILLS`: Task 1.
- Router name/description only: preserved in Task 1 and Task 3.
- Planner/Executor/Tool/Reply injection: Task 3.
- references/scripts limitations: Task 7.
- README/AGENTS docs: Task 7.
- `GET /skills`: Task 4.
- Frontend Skills panel: Task 5 and Task 6.
- Manual verification without running commands automatically: Task 8.

Placeholder scan: no TBD/TODO placeholders are present. Each code-changing task includes concrete code or exact replacement guidance.

Type consistency: backend uses `SkillSource`, `RegisteredSkill`, `SkillSummary`, `listSkillSummaries`, `loadProjectSkills`, `skillPromptForState`, and `withSkillPrompt` consistently across tasks. Frontend uses `SkillSummary`, `SkillsResponse`, `fetchSkills`, and `SkillsPanel` consistently.
