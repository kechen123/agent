# Frontend Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login-only JWT auth to the web app, support username login for `kechen`, and provide seed SQL for the fixed user.

**Architecture:** Backend login accepts either email or username while keeping the existing users table. Frontend stores the JWT in localStorage, validates it with `/api/auth/me`, renders a login view when unauthenticated, and sends `Authorization` on chat SSE requests.

**Tech Stack:** Node.js, TypeScript, Hono, PostgreSQL, React, Vite, TailwindCSS, browser localStorage.

---

## Task 1: Backend username login and seed SQL

**Files:**
- Modify: `src/db/schema.sql`
- Create: `src/db/seed-kechen.sql`
- Modify: `src/auth/routes.ts`
- Modify: `src/auth/authService.ts`

- [ ] Add unique index for `users.name`.
- [ ] Add repeatable seed SQL for user `kechen` with password `qwe123`.
- [ ] Change login schema label from strict email to account string.
- [ ] Change `loginUser` to search by `email` when account contains `@`, otherwise by `name`.
- [ ] Run `pnpm typecheck`.

## Task 2: Frontend auth services and login view

**Files:**
- Create: `web/src/services/authStorage.ts`
- Create: `web/src/services/authApi.ts`
- Create: `web/src/components/auth/LoginView.tsx`

- [ ] Add localStorage helpers for token/user.
- [ ] Add login/me API helpers.
- [ ] Add login form with default account `kechen` and password `qwe123`.
- [ ] Run `cd web && pnpm typecheck`.

## Task 3: Wire auth into chat app

**Files:**
- Modify: `web/src/services/agentSseAdapter.ts`
- Modify: `web/src/hooks/useAgentRuntime.ts`
- Modify: `web/src/app/AssistantApp.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`
- Modify: `web/src/components/layout/MobileSidebar.tsx`

- [ ] Add optional token parameter to `openAgentStream` and set Authorization header.
- [ ] Pass token from `useAgentRuntime` into chat/resume streams.
- [ ] Load auth session at app startup and verify `/api/auth/me`.
- [ ] Render `LoginView` when unauthenticated.
- [ ] Show logged-in user and logout action in sidebars.
- [ ] Run `cd web && pnpm typecheck`.

## Task 4: Final verification

- [ ] Run `pnpm typecheck`.
- [ ] Run `cd web && pnpm typecheck`.
- [ ] Report seed SQL path and copy-paste SQL.

## Self-Review

- Spec coverage: username login, seed SQL, frontend login page, localStorage token, chat auth headers, logout, verification are covered.
- Placeholder scan: no unresolved placeholders.
- Type consistency: frontend uses `AuthUser`, `AuthSession`, `token`; backend keeps login request field `email` while treating it as account.
