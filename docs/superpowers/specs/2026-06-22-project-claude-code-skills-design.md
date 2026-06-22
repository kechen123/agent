# Project Claude Code Skill Format Support Design

Date: 2026-06-22

## Goal

Add project-level Claude Code Skill format support to agent4. Users will manually copy skills into `skills/<skill-name>/SKILL.md` under the project root. The runtime must load only those project-root skills, preserve existing TypeScript built-in skills, expose a safe read-only `GET /skills` summary, and provide a lightweight frontend Skills panel.

## Scope

In scope:

- Backend Skill registry metadata for `builtin` and `project` sources.
- Project Skill loader for `skills/*/SKILL.md`.
- YAML frontmatter parsing and validation.
- Project Skill override of same-name built-in Skill.
- `ENABLED_SKILLS` whitelist behavior.
- Skill prompt injection into Planner, Executor, Tool, and Reply agents when Router selects a Skill.
- `GET /skills` read-only summary endpoint.
- Frontend Skills display only: no install, edit, delete, or enable/disable operations.
- README and AGENTS documentation updates.

Out of scope:

- Reading or copying `C:\Users\Administrator\.claude\skills` or any user-level `.claude/skills` directory.
- Hot reload of Skill files without backend restart.
- Automatic `references/` ingestion.
- Automatic `scripts/` execution.
- Direct migration of Claude Code-only tools or slash-command capabilities.

## Backend Design

### Registry

The existing registry remains the authoritative in-memory store. It will retain the current TypeScript registration ability and add source metadata so each registered Skill can be summarized as either `builtin` or `project`.

Registration order:

1. Register built-in TypeScript Skills from `src/skills`.
2. Load project Skills from project root `skills/*/SKILL.md`.
3. If a project Skill has the same name as a built-in Skill, register it under the same key and overwrite the built-in entry.
4. Apply `ENABLED_SKILLS` only when listing enabled Skills for Router/agents and when computing the `enabled` field for `GET /skills`.

### Project Skill Loader

A dedicated loader/parser module will scan only the project root `skills` directory. For each first-level child directory, it will look for a fixed `SKILL.md` filename. It will not recurse to discover nested Skills.

Safety rules:

- Resolve paths from the project root, not from user input.
- Validate the final `SKILL.md` path remains under the project `skills` directory.
- Validate Skill names with a conservative format such as letters, digits, `_`, and `-`, starting with an alphanumeric character.
- Enforce a single-file size limit before reading content.
- Log one clear success or failure per Skill file.
- A parse or validation failure for one Skill must not stop other Skills from loading.

Parsing:

- Use a mature frontmatter/YAML package, planned as `gray-matter`, to support quoted strings, multiline `description`, and block scalar `|` YAML.
- Extract `name`, `description`, and Markdown body.
- Convert to the existing Skill shape:

```ts
{
  name,
  description,
  systemPrompt: markdownBody
}
```

Validation:

- `name`: required, non-empty string, safe format.
- `description`: required, non-empty string after trimming.
- body: required, non-empty Markdown after trimming.
- file size: below the configured constant limit.

### Agent Prompt Injection

Router behavior remains intentionally narrow:

- Router sees only `name` and `description` through the skill catalog.
- Router never receives the full `SKILL.md` body.

When Router returns a valid `skillName`, the selected Skill's `systemPrompt` is appended once to the local system prompt of:

- PlannerAgent
- ExecutorAgent
- ToolAgent
- ReplyAgent

A small shared helper will build the combined prompt. If no Skill is selected or the selected Skill is disabled/missing, each agent uses its current system prompt unchanged.

### Skills API

Add read-only endpoint:

```http
GET /skills
```

Response:

```json
{
  "skills": [
    {
      "name": "frontend-design",
      "description": "创建高质量前端界面",
      "source": "project",
      "enabled": true
    }
  ]
}
```

Rules:

- Return all successfully registered Skills, not failed files.
- Include `name`, `description`, `source`, and `enabled`.
- Never return `systemPrompt`, Markdown body, or local file paths.
- Stable sort: enabled Skills first, then name ascending.

## Frontend Design

The frontend adds a display-only Skills surface.

Components and data:

- Add a small API function that fetches `GET /skills`.
- Add frontend types for `SkillSummary` and response shape.
- Add a `SkillsPanel` component with a lightweight overlay or side panel.
- Keep failures local to the panel so chat remains usable if `/skills` fails.

UI behavior:

- On app load, request `/skills` once.
- Provide a refresh button for users to re-fetch after backend restart.
- Sidebar bottom gets a `Skills` entry styled consistently with the current dark ChatGPT-like sidebar.
- Chat header can show `已启用 N 个 Skills`; clicking opens the same panel.
- Empty state text: `当前没有可用 Skill`.
- Each Skill displays name, short description, enabled/disabled state, and project/builtin source.
- No install/delete/edit/enable actions are exposed.

## Documentation Design

Update `README.md` and `AGENTS.md` to explain:

- Users manually copy Claude Code Skills into project root `skills/<skill-name>/SKILL.md`.
- The project does not read local `.claude/skills` directories.
- Directory example with optional `references/` and `scripts/`.
- Standard `SKILL.md` frontmatter format.
- Backend restart is required after adding or modifying `SKILL.md`.
- `ENABLED_SKILLS` is a comma-separated whitelist; empty means all registered Skills are enabled.
- `references/` are not automatically read in this first version.
- `scripts/` are never automatically executed; scripts require explicit LangChain Tool wrapping to actually run.
- Claude Code-specific tool capabilities do not directly migrate into this runtime.

## Validation Plan

The implementation should be checked by manually running, when desired:

```bash
pnpm typecheck
cd web && pnpm typecheck
cd web && pnpm build
```

Manual browser checks after starting the services manually:

- Skills panel opens from sidebar and chat header.
- Desktop and mobile layouts remain usable.
- `/skills` failure does not break chat.
- The frontend does not expose `systemPrompt` or local paths.

Code-level loading checks should cover:

- Load `skills/<name>/SKILL.md`.
- Parse `name`, `description`, and Markdown body.
- Support multiline YAML.
- Ignore damaged Skill while loading valid ones.
- Apply `ENABLED_SKILLS` filtering.
- Let project Skill override same-name built-in Skill.
- Never access `C:\Users\Administrator\.claude\skills`.
