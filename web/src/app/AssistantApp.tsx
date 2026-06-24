import { useCallback, useEffect, useMemo, useState } from "react";
import { LoginView } from "../components/auth/LoginView";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { KnowledgePanel } from "../components/knowledge/KnowledgePanel";
import { SkillsPanel } from "../components/skills/SkillsPanel";
import { getMe, login } from "../services/authApi";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from "../services/authStorage";
import { listDocuments, type KnowledgeDocument } from "../services/knowledgeApi";
import { fetchSkills } from "../services/skillsApi";
import type { SkillSummary } from "../types/skills";
import { AgentActionsContext, type AgentActions } from "./agentActions";
import { useAgentRuntime } from "../hooks/useAgentRuntime";

type ActiveSurface = "chat" | "knowledge";

export function AssistantApp() {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [authLoading, setAuthLoading] = useState(() => Boolean(getAuthSession()));
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    threads,
    currentThread,
    currentThreadId,
    setCurrentThreadId,
    newThread,
    sendMessage,
    resume,
    cancel,
    isRunning,
  } = useAgentRuntime(session?.token ?? null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>("chat");
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    const initialSession = getAuthSession();
    if (!initialSession) {
      setAuthLoading(false);
      return;
    }

    const controller = new AbortController();
    void getMe(initialSession.token, controller.signal)
      .then((user) => {
        const next = { token: initialSession.token, user };
        setAuthSession(next);
        setSession(next);
      })
      .catch(() => {
        clearAuthSession();
        setSession(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false);
      });

    return () => controller.abort();
  }, []);

  const enabledSkillsCount = useMemo(
    () => skills.filter((skill) => skill.enabled).length,
    [skills],
  );

  const updateKnowledgeCount = useCallback((documents: KnowledgeDocument[]) => {
    setKnowledgeCount(documents.filter((document) => document.status === "ready").length);
  }, []);

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
      if (!signal?.aborted) {
        setSkillsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void loadSkills(controller.signal);
    void listDocuments(session.token)
      .then(updateKnowledgeCount)
      .catch(() => setKnowledgeCount(null));
    return () => controller.abort();
  }, [loadSkills, session, updateKnowledgeCount]);

  const actions = useMemo<AgentActions>(
    () => ({ resume, isRunning }),
    [isRunning, resume],
  );

  const handleLogin = useCallback(async (account: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const next = await login(account.trim(), password);
      setAuthSession(next);
      setSession(next);
    } catch (err) {
      setLoginError((err as Error).message || "登录失败");
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    cancel();
    clearAuthSession();
    setSession(null);
    setSkills([]);
    setKnowledgeCount(null);
    setSkillsOpen(false);
    setActiveSurface("chat");
    setMobileSidebarOpen(false);
  }, [cancel]);

  const handleOpenSkills = useCallback(() => {
    setSkillsOpen(true);
    if (!skillsLoading && (skills.length === 0 || skillsError)) {
      void loadSkills();
    }
  }, [loadSkills, skills.length, skillsError, skillsLoading]);

  const handleOpenKnowledge = useCallback(() => {
    setActiveSurface("knowledge");
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setActiveSurface("chat");
  }, [setCurrentThreadId]);

  const handleNewThread = useCallback(() => {
    newThread();
    setActiveSurface("chat");
  }, [newThread]);

  if (authLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 text-sm text-neutral-300">
        正在恢复登录状态…
      </main>
    );
  }

  if (!session) {
    return <LoginView isLoading={loginLoading} error={loginError} onLogin={handleLogin} />;
  }

  return (
    <AgentActionsContext.Provider value={actions}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-white text-neutral-950">
        <Sidebar
          className="hidden md:flex"
          threads={threads}
          currentThreadId={currentThreadId}
          activeSurface={activeSurface}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          enabledSkillsCount={enabledSkillsCount}
          onOpenSkills={handleOpenSkills}
          onOpenKnowledge={handleOpenKnowledge}
          knowledgeCount={knowledgeCount}
          user={session.user}
          onLogout={handleLogout}
        />
        <MobileSidebar
          open={mobileSidebarOpen}
          threads={threads}
          currentThreadId={currentThreadId}
          activeSurface={activeSurface}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          onClose={() => setMobileSidebarOpen(false)}
          enabledSkillsCount={enabledSkillsCount}
          onOpenSkills={handleOpenSkills}
          onOpenKnowledge={handleOpenKnowledge}
          knowledgeCount={knowledgeCount}
          user={session.user}
          onLogout={handleLogout}
        />
        <main className="min-w-0 flex-1">
          {activeSurface === "knowledge" ? (
            <KnowledgePanel
              token={session.token}
              onOpenMenu={() => setMobileSidebarOpen(true)}
              onDocumentsChange={updateKnowledgeCount}
            />
          ) : (
            <ChatView
              title={currentThread.title || "新会话"}
              messages={currentThread.messages}
              isRunning={isRunning}
              onOpenMenu={() => setMobileSidebarOpen(true)}
              onNewThread={handleNewThread}
              onSend={sendMessage}
              onCancel={cancel}
              enabledSkillsCount={enabledSkillsCount}
              onOpenSkills={handleOpenSkills}
            />
          )}
        </main>
        <SkillsPanel
          open={skillsOpen}
          skills={skills}
          isLoading={skillsLoading}
          error={skillsError}
          onClose={() => setSkillsOpen(false)}
          onRefresh={() => void loadSkills()}
        />
      </div>
    </AgentActionsContext.Provider>
  );
}
