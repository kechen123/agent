# RAG Command UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/rag` knowledge command behavior and improve empty chat/knowledge count UI.

**Architecture:** Backend rewrites `/rag` messages before graph routing so Router/ToolAgent select `searchKnowledge`. Frontend adds command suggestions in Composer, moves Composer to center while the thread is empty, and tracks ready document count in AssistantApp.

**Tech Stack:** Hono, LangGraph, React, TypeScript, TailwindCSS.

---

## Task 1: Backend /rag command

- Modify `src/routes/chat.route.ts` to detect `/rag` and rewrite the message.
- Modify router/tool prompts if needed to route forced RAG to tools.
- Run `pnpm typecheck`.

## Task 2: Composer command suggestions and empty layout

- Modify `web/src/components/agent/Composer.tsx` to show command suggestions and support suggestion clicks.
- Modify `web/src/components/agent/ChatView.tsx` to remove EmptyState cards and center Composer when empty.
- Run `cd web && pnpm typecheck`.

## Task 3: Knowledge count badge

- Modify `web/src/app/AssistantApp.tsx` to load ready document count.
- Modify `KnowledgePanel` to notify document changes.
- Modify Sidebar/MobileSidebar props to show count instead of KB.
- Run both typechecks.

## Self-Review

- Covers /rag, command suggestions, centered empty composer, and knowledge count.
- No placeholders.
