# Knowledge UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a logged-in knowledge management panel for upload, list, delete, and search testing.

**Architecture:** Add one API service for `/api/knowledge/*`, one right-side panel component, and wire a Sidebar entry through AssistantApp. The panel receives the current JWT token and owns its own loading/error/list/search state.

**Tech Stack:** React, TypeScript, Vite, TailwindCSS, Hono backend knowledge APIs.

---

## Task 1: Knowledge API service

**Files:**
- Create: `web/src/services/knowledgeApi.ts`

- [ ] Define document/search result types.
- [ ] Implement list/upload/delete/search with Authorization header and shared error parsing.

## Task 2: Knowledge panel component

**Files:**
- Create: `web/src/components/knowledge/KnowledgePanel.tsx`

- [ ] Implement right-side drawer shell.
- [ ] Load documents when opened.
- [ ] Add upload form, list/delete controls, search test controls.
- [ ] Show loading and errors.

## Task 3: App and sidebar wiring

**Files:**
- Modify: `web/src/app/AssistantApp.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`
- Modify: `web/src/components/layout/MobileSidebar.tsx`

- [ ] Add KnowledgePanel state and render.
- [ ] Add Sidebar knowledge button.
- [ ] Add MobileSidebar close-on-open behavior.

## Task 4: Verification

- [ ] Run `cd web && pnpm typecheck`.
- [ ] Report how to access the panel and test upload/search/delete.

## Self-Review

- Spec coverage: covers entry, panel, upload/list/delete/search, JWT, and verification.
- Placeholder scan: no unresolved placeholders.
- Type consistency: token is passed as string, document fields match backend JSON shape.
