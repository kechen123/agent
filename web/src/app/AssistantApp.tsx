import { useState } from "react";
import { useAgentRuntime } from "../hooks/useAgentRuntime";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileSidebar } from "../components/layout/MobileSidebar";
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

  const actions: AgentActions = { resume, isRunning };

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleNewThread = () => {
    newThread();
  };

  return (
    <AgentActionsContext.Provider value={actions}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f7f7f8] text-neutral-950">
        <Sidebar
          className="hidden md:flex"
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
        />
        <MobileSidebar
          open={mobileSidebarOpen}
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          onClose={() => setMobileSidebarOpen(false)}
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
          />
        </main>
      </div>
    </AgentActionsContext.Provider>
  );
}
