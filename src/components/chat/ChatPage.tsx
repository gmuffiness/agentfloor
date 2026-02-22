"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ConversationList } from "./ConversationList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { NewChatModal } from "./NewChatModal";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type { Vendor, Conversation, Message } from "@/types";

interface AgentItem {
  id: string;
  name: string;
  vendor: Vendor;
  model: string;
  status: string;
  skillCount: number;
  gitRepo?: string;
}

interface StreamingAgent {
  agentId: string;
  agentName: string;
  agentVendor?: string;
  runtimeType?: string;
  text: string;
}

interface ChatPageProps {
  orgId: string;
}

export function ChatPage({ orgId }: ChatPageProps) {
  const organization = useAppStore((s) => s.organization);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingAgent, setStreamingAgent] = useState<StreamingAgent | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState<{ agentId: string; agentName: string } | null>(null);
  const [apiKeysConfigured, setApiKeysConfigured] = useState<boolean | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive agents from store instead of separate API call
  const agents = useMemo<AgentItem[]>(() =>
    organization.departments.flatMap((dept) =>
      dept.agents.map((a) => ({
        id: a.id,
        name: a.name,
        vendor: a.vendor,
        model: a.model,
        status: a.status,
        skillCount: a.skills.length,
        gitRepo: "",
      }))
    ), [organization]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);
  const participants = selectedConv?.participants ?? [];

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    const res = await fetch(`/api/organizations/${orgId}/conversations`);
    if (res.ok) {
      setConversations(await res.json());
    }
  }, [orgId]);

  // Check if API keys are configured
  useEffect(() => {
    async function checkApiKeys() {
      try {
        const res = await fetch(`/api/organizations/${orgId}/api-keys`);
        if (res.ok) {
          const data = await res.json();
          setApiKeysConfigured(data.anthropic || data.openai);
        } else {
          setApiKeysConfigured(false);
        }
      } catch {
        setApiKeysConfigured(false);
      }
    }
    checkApiKeys();
    fetchConversations();
  }, [fetchConversations, orgId]);

  // Fetch messages when conversation selected
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }
    async function fetchMessages() {
      const res = await fetch(`/api/organizations/${orgId}/conversations/${selectedConvId}/messages`);
      if (res.ok) {
        setMessages(await res.json());
      }
    }
    fetchMessages();
  }, [orgId, selectedConvId]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll for async agent responses (queued openclaw agents)
  const startAsyncPoll = useCallback((convId: string, agentId: string, agentName: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    setWaitingForAgent({ agentId, agentName });
    const lastMessageCount = messages.length;
    let elapsed = 0;
    const maxWait = 5 * 60 * 1000; // 5 minutes

    pollTimerRef.current = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > maxWait) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setWaitingForAgent(null);
        return;
      }

      try {
        const res = await fetch(`/api/organizations/${orgId}/conversations/${convId}/messages`);
        if (!res.ok) return;
        const newMessages = await res.json();
        // Check if there are new assistant messages from this agent
        const hasNewResponse = newMessages.length > lastMessageCount &&
          newMessages.some((m: { role: string; agent_id?: string; agentId?: string; createdAt?: string }) =>
            m.role === "assistant" && (m.agent_id === agentId || m.agentId === agentId)
          );

        if (hasNewResponse) {
          setMessages(newMessages);
          setWaitingForAgent(null);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          fetchConversations();
        }
      } catch {
        // Ignore poll errors
      }
    }, 3000);
  }, [messages.length, orgId, fetchConversations]);

  const handleNewConversation = () => {
    setShowNewChat(true);
  };

  const handleCreateChat = async (agentIds: string[], title?: string) => {
    setShowNewChat(false);

    // Create a temporary conversation and send the first message later
    // For now, create the conversation via the chat API on first message send
    const now = new Date().toISOString();
    const tempConvId = `conv-${Date.now()}`;
    const agentNames = agentIds
      .map((id) => agents.find((a) => a.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    const tempConv: Conversation = {
      id: tempConvId,
      orgId,
      agentId: agentIds[0],
      title: title || agentNames || "New Chat",
      createdAt: now,
      updatedAt: now,
      participants: agentIds.map((id) => {
        const agent = agents.find((a) => a.id === id);
        return {
          id: `cp-temp-${id}`,
          conversationId: tempConvId,
          agentId: id,
          agentName: agent?.name,
          agentVendor: agent?.vendor,
          joinedAt: now,
        };
      }),
    };

    setConversations((prev) => [tempConv, ...prev]);
    setSelectedConvId(tempConvId);
    setMessages([]);
    setStreamingAgent(null);
  };

  // Override handleSend for new (temp) conversations
  const handleSendMessage = async (text: string) => {
    if (isSending) return;

    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!conv) return;

    const agentIds = (conv.participants ?? []).map((p) => p.agentId);
    if (agentIds.length === 0) return;

    // If it's a temp conversation (not yet in DB), send without conversationId
    const isTemp = selectedConvId?.startsWith("conv-") && !messages.length;
    const convIdForApi = isTemp ? undefined : selectedConvId;

    setIsSending(true);
    setStreamingAgent(null);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConvId ?? "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/organizations/${orgId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds,
          conversationId: convIdForApi,
          message: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStreamingAgent({ agentId: "", agentName: "Error", text: err.error });
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let currentAgentText = "";
      let currentAgentId = "";
      let currentAgentName = "";
      let currentAgentVendor = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);

            if (data.agentStart) {
              if (currentAgentId && currentAgentText) {
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}-a-${currentAgentId}`,
                  conversationId: selectedConvId ?? "",
                  role: "assistant",
                  content: currentAgentText,
                  createdAt: new Date().toISOString(),
                  agentId: currentAgentId,
                  agentName: currentAgentName,
                  agentVendor: currentAgentVendor as Vendor,
                };
                setMessages((prev) => [...prev, assistantMsg]);
              }
              currentAgentId = data.agentId;
              currentAgentName = data.agentName;
              currentAgentVendor = data.agentVendor ?? "";
              currentAgentText = "";
              setStreamingAgent({
                agentId: data.agentId,
                agentName: data.agentName,
                agentVendor: data.agentVendor,
                runtimeType: data.runtimeType,
                text: "",
              });
            }

            if (data.text) {
              currentAgentText += data.text;
              setStreamingAgent((prev) =>
                prev ? { ...prev, text: currentAgentText } : null
              );
            }

            if (data.agentDone) {
              const assistantMsg: Message = {
                id: `msg-${Date.now()}-a-${data.agentId}`,
                conversationId: selectedConvId ?? "",
                role: "assistant",
                content: currentAgentText,
                createdAt: new Date().toISOString(),
                agentId: currentAgentId,
                agentName: currentAgentName,
                agentVendor: currentAgentVendor as Vendor,
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingAgent(null);
              currentAgentText = "";
              currentAgentId = "";
            }

            if (data.queued) {
              // OpenClaw agent without gateway — start async polling
              const pollConvId = data.conversationId || selectedConvId;
              if (pollConvId) {
                startAsyncPoll(pollConvId, data.agentId, data.agentName);
              }
              if (data.conversationId && data.conversationId !== selectedConvId) {
                setSelectedConvId(data.conversationId);
              }
            }

            if (data.done) {
              setStreamingAgent(null);
              if (data.conversationId && data.conversationId !== selectedConvId) {
                // Replace temp conv ID with real one
                setSelectedConvId(data.conversationId);
              }
              fetchConversations();
            }

            if (data.error) {
              setStreamingAgent({ agentId: "", agentName: "Error", text: data.error });
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      setStreamingAgent({ agentId: "", agentName: "Error", text: errorMsg });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-slate-700 bg-slate-900">
        <div className="flex-1 overflow-y-auto p-3">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={(id) => {
              setSelectedConvId(id);
              setStreamingAgent(null);
            }}
            onNew={handleNewConversation}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {apiKeysConfigured === false && (
          <div className="border-b border-amber-600/40 bg-amber-950/80 px-6 py-3">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <span className="font-semibold text-amber-300">API keys not configured.</span>{" "}
                <span className="text-amber-100/90">
                  To use the chat feature, an admin must set API keys in{" "}
                  <a href={`/org/${orgId}/settings`} className="font-semibold text-amber-300 underline hover:text-amber-200">
                    Settings → API Keys
                  </a>.
                </span>
              </div>
            </div>
          </div>
        )}
        {selectedConv ? (
          <>
            {/* Conversation header with participants */}
            <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{selectedConv.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {participants.map((p) => (
                    <span
                      key={p.agentId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                        "bg-slate-700 text-slate-300"
                      )}
                    >
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.agentVendor === "anthropic" ? "bg-orange-400" :
                        p.agentVendor === "openai" ? "bg-green-400" :
                        p.agentVendor === "google" ? "bg-blue-400" : "bg-slate-500"
                      )} />
                      {p.agentName ?? "Agent"}
                    </span>
                  ))}
                  <button
                    onClick={handleNewConversation}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                    title="New conversation"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <ChatMessages
              messages={messages}
              streamingAgent={streamingAgent}
              waitingForAgent={waitingForAgent}
            />
            <ChatInput onSend={handleSendMessage} disabled={isSending} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-slate-400">Start a new conversation</p>
              <p className="mt-1 text-sm text-slate-500">
                Create a conversation and invite agents to chat
              </p>
              <button
                onClick={handleNewConversation}
                className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          agents={agents}
          onClose={() => setShowNewChat(false)}
          onCreate={handleCreateChat}
        />
      )}
    </div>
  );
}
