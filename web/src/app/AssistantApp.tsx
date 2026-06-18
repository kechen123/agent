import { useAgentRuntime } from "../hooks/useAgentRuntime";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
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

  const actions: AgentActions = { resume };

  return (
    <AgentActionsContext.Provider value={actions}>
      <div className="flex h-screen w-full overflow-hidden bg-[#f7f7f8] text-neutral-950">
        <Sidebar
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={setCurrentThreadId}
          onNew={newThread}
        />
        <main className="min-w-0 flex-1">
          <ChatView
            messages={currentThread.messages}
            isRunning={isRunning}
            threadId={currentThreadId}
            onSend={sendMessage}
            onCancel={cancel}
          />
        </main>
      </div>
    </AgentActionsContext.Provider>
  );
}
