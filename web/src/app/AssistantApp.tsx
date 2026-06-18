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
      <div className="flex h-full w-full">
        <Sidebar
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={setCurrentThreadId}
          onNew={newThread}
        />
        <main className="h-full flex-1">
          <ChatView
            messages={currentThread.messages}
            isRunning={isRunning}
            onSend={sendMessage}
            onCancel={cancel}
          />
        </main>
      </div>
    </AgentActionsContext.Provider>
  );
}
