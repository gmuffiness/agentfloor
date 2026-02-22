"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ConversationList } from "./ConversationList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { NewChatModal } from "./NewChatModal";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type { Vendor, Conversation, Message } from "@/types";
// Inline SVG icons (no external icon library required)
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function SettingsIcon({ width, height }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

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

const STORAGE_KEYS = { anthropic: "af_user_anthropic_key", openai: "af_user_openai_key" } as const;

function getUserApiKeys() {
  if (typeof window === "undefined") return { anthropic: null, openai: null };
  return {
    anthropic: localStorage.getItem(STORAGE_KEYS.anthropic),
    openai: localStorage.getItem(STORAGE_KEYS.openai),
  };
}

function setUserApiKey(vendor: "anthropic" | "openai", key: string) {
  localStorage.setItem(STORAGE_KEYS[vendor], key);
}

function clearUserApiKey(vendor: "anthropic" | "openai") {
  localStorage.removeItem(STORAGE_KEYS[vendor]);
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
  const [userKeys, setUserKeys] = useState<{ anthropic: string | null; openai: string | null }>({ anthropic: null, openai: null });
  const [orgKeys, setOrgKeys] = useState<{ anthropic: boolean; openai: boolean }>({ anthropic: false, openai: false });
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [keyInputs, setKeyInputs] = useState<{ anthropic: string; openai: string }>({ anthropic: "", openai: "" });
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // When we replace a temp conv ID with a real one after streaming, we don't want
  // the selectedConvId useEffect to refetch messages (they're already in local state).
  const skipNextMsgFetchRef = useRef(false);

  const apiKeysConfigured = !!(userKeys.anthropic || userKeys.openai || orgKeys.anthropic || orgKeys.openai);

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

  // Fetch all conversations — merge with existing list to avoid reorder/flicker.
  // Existing conversations keep their position; new ones are prepended.
  const fetchConversations = useCallback(async () => {
    const res = await fetch(`/api/organizations/${orgId}/conversations`);
    if (!res.ok) return;
    const fetched: Conversation[] = await res.json();
    setConversations((prev) => {
      // Build a map of fetched convs for O(1) lookup
      const fetchedMap = new Map(fetched.map((c) => [c.id, c]));
      // Update existing entries in place (preserving order), drop ones no longer returned
      const updated = prev
        .filter((c) => fetchedMap.has(c.id))
        .map((c) => fetchedMap.get(c.id)!);
      // Prepend any brand-new conversations (not yet in local state)
      const existingIds = new Set(updated.map((c) => c.id));
      const newOnes = fetched.filter((c) => !existingIds.has(c.id));
      return [...newOnes, ...updated];
    });
  }, [orgId]);

  // Check if API keys are configured
  useEffect(() => {
    async function checkApiKeys() {
      // Load user keys from localStorage
      const localKeys = getUserApiKeys();
      setUserKeys(localKeys);

      try {
        const res = await fetch(`/api/organizations/${orgId}/api-keys`);
        if (res.ok) {
          const data = await res.json();
          setOrgKeys({
            anthropic: !!(data.orgKeys?.anthropic),
            openai: !!(data.orgKeys?.openai),
          });
        }
      } catch {
        // ignore
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
    // Skip refetch when we just promoted a temp conv ID to a real one after
    // streaming — messages are already in local state and a refetch would flash.
    if (skipNextMsgFetchRef.current) {
      skipNextMsgFetchRef.current = false;
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
      const currentUserKeys = getUserApiKeys();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUserKeys.anthropic) headers["X-User-Anthropic-Key"] = currentUserKeys.anthropic;
      if (currentUserKeys.openai) headers["X-User-OpenAI-Key"] = currentUserKeys.openai;

      const res = await fetch(`/api/organizations/${orgId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          agentIds,
          conversationId: convIdForApi,
          message: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Remove temp user message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        if (err.error === "NO_API_KEY") {
          setStreamingAgent({ agentId: "", agentName: "Error", text: err.message ?? "No API key configured. Please add your API key below." });
          setShowKeySetup(true);
        } else {
          setStreamingAgent({ agentId: "", agentName: "Error", text: err.error });
        }
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      // HTTP response received — unblock the input so user can type while streaming
      setIsSending(false);

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
                // Replace temp conv ID with real one. Skip the message refetch that
                // would be triggered by the selectedConvId change — messages are
                // already in local state and a refetch would cause a visual flash.
                skipNextMsgFetchRef.current = true;
                setSelectedConvId(data.conversationId);
                // Also replace the temp entry in the conversations list with the real ID
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === selectedConvId ? { ...c, id: data.conversationId } : c
                  )
                );
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

  const handleSaveKey = (vendor: "anthropic" | "openai") => {
    const val = keyInputs[vendor].trim();
    if (!val) return;
    setUserApiKey(vendor, val);
    setUserKeys((prev) => ({ ...prev, [vendor]: val }));
    setKeyInputs((prev) => ({ ...prev, [vendor]: "" }));
  };

  const handleClearKey = (vendor: "anthropic" | "openai") => {
    clearUserApiKey(vendor);
    setUserKeys((prev) => ({ ...prev, [vendor]: null }));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  const showKeySetupPanel = !apiKeysConfigured || showKeySetup;

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
      <div className="flex flex-1 flex-col overflow-hidden">
        {showKeySetupPanel && (
          <div className="border-b border-zinc-700/50 bg-zinc-800/50 px-6 py-4">
            <div className="flex items-start gap-3">
              <KeyIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">API Key Required</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  To chat with agents, configure your personal API key. Keys are stored locally in your browser and never sent to our servers.
                </p>
                <div className="mt-3 space-y-2">
                  {/* Anthropic key row */}
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-zinc-400">Anthropic</span>
                    {userKeys.anthropic ? (
                      <div className="flex flex-1 items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckIcon className="h-3.5 w-3.5" /> Configured
                        </span>
                        <button
                          onClick={() => handleClearKey("anthropic")}
                          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        >
                          <XIcon className="h-3 w-3" /> Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="password"
                          placeholder="sk-ant-..."
                          value={keyInputs.anthropic}
                          onChange={(e) => setKeyInputs((prev) => ({ ...prev, anthropic: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey("anthropic"); }}
                          className="flex-1 rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveKey("anthropic")}
                          disabled={!keyInputs.anthropic.trim()}
                          className="rounded bg-zinc-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-600 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {/* OpenAI key row */}
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-zinc-400">OpenAI</span>
                    {userKeys.openai ? (
                      <div className="flex flex-1 items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckIcon className="h-3.5 w-3.5" /> Configured
                        </span>
                        <button
                          onClick={() => handleClearKey("openai")}
                          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        >
                          <XIcon className="h-3 w-3" /> Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={keyInputs.openai}
                          onChange={(e) => setKeyInputs((prev) => ({ ...prev, openai: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey("openai"); }}
                          className="flex-1 rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveKey("openai")}
                          disabled={!keyInputs.openai.trim()}
                          className="rounded bg-zinc-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-600 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {apiKeysConfigured && showKeySetup && (
                  <button
                    onClick={() => setShowKeySetup(false)}
                    className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Close
                  </button>
                )}
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
                  {apiKeysConfigured && (
                    <button
                      onClick={() => setShowKeySetup((v) => !v)}
                      className="rounded-full p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                      title="Configure API keys"
                    >
                      <SettingsIcon width={16} height={16} />
                    </button>
                  )}
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
            <ChatInput
              onSend={handleSendMessage}
              disabled={isSending || !apiKeysConfigured}
              placeholder={!apiKeysConfigured ? "Configure an API key to start chatting" : undefined}
            />
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
