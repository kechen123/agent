import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgentRuntime } from "../hooks/useAgentRuntime";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { SkillsPanel } from "../components/skills/SkillsPanel";
import { fetchSkills } from "../services/skillsApi";
import type { SkillSummary } from "../types/skills";
import { AgentActionsContext, type AgentActions } from "./agentActions";

export function AssistantApp() {
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
  } = useAgentRuntime();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
      if (!signal?.aborted) {
        setSkillsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSkills(controller.signal);
    return () => controller.abort();
  }, [loadSkills]);

  const actions = useMemo<AgentActions>(
    () => ({ resume, isRunning }),
    [isRunning, resume],
  );

  const handleOpenSkills = useCallback(() => {
    setSkillsOpen(true);
    if (!skillsLoading && (skills.length === 0 || skillsError)) {
      void loadSkills();
    }
  }, [loadSkills, skills.length, skillsError, skillsLoading]);

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
  }, [setCurrentThreadId]);

  const handleNewThread = useCallback(() => {
    newThread();
  }, [newThread]);

  return (
    <AgentActionsContext.Provider value={actions}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-white text-neutral-950">
        <Sidebar
          className="hidden md:flex"
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          enabledSkillsCount={enabledSkillsCount}
          onOpenSkills={handleOpenSkills}
        />
        <MobileSidebar
          open={mobileSidebarOpen}
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          onClose={() => setMobileSidebarOpen(false)}
          enabledSkillsCount={enabledSkillsCount}
          onOpenSkills={handleOpenSkills}
        />
        <main className="min-w-0 flex-1">
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
