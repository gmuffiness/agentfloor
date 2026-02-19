"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentSelector } from "./AgentSelector";
import { ConversationList } from "./ConversationList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
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

interface ChatPageProps {
  orgId: string;
}

export function ChatPage({ orgId }: ChatPageProps) {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Fetch agents
  useEffect(() => {
    async function fetchAgents() {
      const res = await fetch(`/api/organizations/${orgId}/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(
          data.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            name: a.name as string,
            vendor: a.vendor as Vendor,
            model: a.model as string,
            status: a.status as string,
            skillCount: 0,
            gitRepo: "",
          }))
        );
      }
      setLoading(false);
    }
    fetchAgents();
  }, [orgId]);

  // Fetch conversations when agent selected
  const fetchConversations = useCallback(async (agentId: string) => {
    const res = await fetch(`/api/organizations/${orgId}/conversations?agentId=${agentId}`);
    if (res.ok) {
      setConversations(await res.json());
    }
  }, [orgId]);

  useEffect(() => {
    if (selectedAgentId) {
      fetchConversations(selectedAgentId);
      setSelectedConvId(null);
      setMessages([]);
    }
  }, [selectedAgentId, fetchConversations]);

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

  const handleSend = async (text: string) => {
    if (!selectedAgentId || isSending) return;
    setIsSending(true);
    setStreamingText("");

    // Optimistic user message
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
          agentId: selectedAgentId,
          conversationId: selectedConvId,
          message: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStreamingText(`Error: ${err.error}`);
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

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
            if (data.text) {
              accumulated += data.text;
              setStreamingText(accumulated);
            }
            if (data.done) {
              // Replace streaming with final message
              const assistantMsg: Message = {
                id: `msg-${Date.now()}-a`,
                conversationId: data.conversationId,
                role: "assistant",
                content: accumulated,
                createdAt: new Date().toISOString(),
              };
              setStreamingText("");
              setMessages((prev) => [...prev, assistantMsg]);

              // Update conversation ID if new
              if (!selectedConvId && data.conversationId) {
                setSelectedConvId(data.conversationId);
              }

              // Refresh conversations list
              if (selectedAgentId) {
                fetchConversations(selectedAgentId);
              }
            }
            if (data.error) {
              setStreamingText(`Error: ${data.error}`);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      setStreamingText(`Error: ${errorMsg}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleNewConversation = () => {
    setSelectedConvId(null);
    setMessages([]);
    setStreamingText("");
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
      <div className="flex w-[280px] shrink-0 flex-col border-r border-slate-700 bg-slate-850">
        <div className="flex-1 overflow-y-auto p-3">
          <AgentSelector
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelect={setSelectedAgentId}
          />
          {selectedAgentId && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConvId}
                onSelect={setSelectedConvId}
                onNew={handleNewConversation}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {selectedAgent ? (
          <>
            {/* Agent context banner */}
            <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{selectedAgent.name}</span>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                  {selectedAgent.vendor}/{selectedAgent.model}
                </span>
              </div>
            </div>

            <ChatMessages messages={messages} streamingText={streamingText || undefined} />
            <ChatInput onSend={handleSend} disabled={isSending} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-slate-400">Select an agent to start chatting</p>
              <p className="mt-1 text-sm text-slate-500">
                Choose an agent from the sidebar to chat with its project context
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
