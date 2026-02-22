import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";
import { fetchRepoContext, formatRepoContextPrompt, getTokenForRepo } from "@/lib/repo-context";
import { decrypt } from "@/lib/crypto";
import { validateGatewayUrl } from "@/lib/url-validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

interface AgentRow {
  id: string;
  name: string;
  vendor: string;
  model: string;
  runtime_type: string;
  gateway_url: string;
}

function buildSystemPrompt(
  agent: AgentRow,
  contexts: { type: string; content: string; source_file: string | null }[],
  skills: { name: string }[],
  mcpTools: { name: string; server: string }[],
  otherAgents: AgentRow[],
  repoContext?: string | null
): string {
  let prompt = `You are acting as the AI agent "${agent.name}" (${agent.vendor}/${agent.model}).\n\n`;

  if (repoContext) {
    prompt += `You have deep knowledge of the following codebase. Use this context to answer questions accurately.\n\n`;
    prompt += repoContext;
  }

  if (otherAgents.length > 0) {
    prompt += `## Group Chat Participants\nYou are in a group conversation with these other agents:\n`;
    for (const other of otherAgents) {
      prompt += `- ${other.name} (${other.vendor}/${other.model})\n`;
    }
    prompt += `\nCollaborate naturally. Refer to other agents by name if needed. Avoid repeating what others have said.\n\n`;
  }

  for (const ctx of contexts) {
    const label = ctx.type === "claude_md" ? "CLAUDE.md" : ctx.type === "readme" ? "README" : ctx.source_file ?? "Context";
    prompt += `## ${label}\n${ctx.content}\n\n`;
  }

  if (skills.length > 0) {
    prompt += `## Available Skills\n${skills.map((s) => `- ${s.name}`).join("\n")}\n\n`;
  }

  if (mcpTools.length > 0) {
    prompt += `## MCP Tools\n${mcpTools.map((t) => `- ${t.name} (server: ${t.server})`).join("\n")}\n\n`;
  }

  prompt += "Answer questions based on the project context above. Be helpful and concise.";
  return prompt;
}

async function fetchAgentContext(supabase: ReturnType<typeof getSupabase>, agentId: string, runtimeType?: string, orgId?: string) {
  const [ctxRes, skillsRes, mcpRes, resourcesRes] = await Promise.all([
    supabase.from("agent_context").select("type, content, source_file").eq("agent_id", agentId),
    supabase.from("agent_skills").select("skill_id, skills(name)").eq("agent_id", agentId),
    supabase.from("mcp_tools").select("name, server").eq("agent_id", agentId),
    supabase.from("agent_resources").select("type, url").eq("agent_id", agentId).eq("type", "git_repo"),
  ]);

  const contexts = ctxRes.data ?? [];
  const skills = (skillsRes.data ?? []).map((s: Record<string, unknown>) => {
    const skillData = s.skills as { name: string } | null;
    return { name: skillData?.name ?? "" };
  }).filter((s: { name: string }) => s.name);
  const mcpTools = mcpRes.data ?? [];

  // For cloud runtime, fetch repo context via GitHub API
  let repoContextPrompt: string | null = null;
  if (runtimeType === "cloud") {
    const gitRepoResource = (resourcesRes.data ?? [])[0] as { type: string; url: string } | undefined;
    if (gitRepoResource?.url) {
      try {
        // Resolve token: GitHub App installation token → GITHUB_TOKEN fallback
        const token = orgId
          ? await getTokenForRepo(supabase, orgId, gitRepoResource.url)
          : undefined;
        const repoCtx = await fetchRepoContext(gitRepoResource.url, token);
        if (repoCtx) {
          repoContextPrompt = formatRepoContextPrompt(repoCtx);
        }
      } catch (err) {
        console.error(`[cloud-runtime] Failed to fetch repo context for agent ${agentId}:`, err);
      }
    }
  }

  return { contexts, skills, mcpTools, repoContextPrompt };
}

async function streamAnthropicResponse(
  agent: AgentRow,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  orgApiKey?: string | null,
) {
  const apiKey = orgApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured. Please set it in Settings → API Keys.");

  const client = new Anthropic({ apiKey });
  const stream = await client.messages.stream({
    model: agent.model || "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  });
  return { stream };
}

async function streamOpenAIResponse(
  agent: AgentRow,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  orgApiKey?: string | null,
) {
  const apiKey = orgApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured. Please set it in Settings → API Keys.");

  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model: agent.model || "gpt-4o",
    messages: [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    stream: true,
  });
  return { stream };
}

/**
 * Relay a message to an OpenClaw Gateway and stream the response.
 * OpenClaw Gateway exposes an HTTP endpoint (via Tailscale Funnel or direct).
 * Protocol: POST to gateway_url/api/message with JSON body, receive SSE stream.
 */
async function streamOpenClawResponse(
  agent: AgentRow,
  messages: { role: string; content: string }[]
) {
  const gatewayUrl = agent.gateway_url;
  if (!gatewayUrl) throw new Error(`No gateway URL configured for OpenClaw agent "${agent.name}"`);

  // Validate URL to prevent SSRF attacks
  await validateGatewayUrl(gatewayUrl);

  // Normalize URL — strip trailing slash, append /api/message
  const baseUrl = gatewayUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/api/message`;

  const lastUserMessage = messages.filter((m) => m.role === "user").pop();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: lastUserMessage?.content ?? "",
      history: messages,
      agentName: agent.name,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenClaw Gateway returned ${response.status}: ${errText}`);
  }

  return { response };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const supabase = getSupabase();

  // Auth check — skip for public orgs
  const { data: orgCheck } = await supabase.from("organizations").select("visibility, anthropic_api_key, openai_api_key").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  // Rate limit: 20 req/min per IP
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`chat:${ip}`, { maxRequests: 20, windowMs: 60_000 });
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  const body = await request.json();
  const { agentId, agentIds, conversationId, message } = body;

  // Validate message
  if (typeof message !== "string" || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: "message must be a non-empty string" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (message.length > 10_000) {
    return new Response(JSON.stringify({ error: "message must be 10,000 characters or fewer" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Support both single agentId (backward compat) and agentIds array
  const resolvedAgentIds: string[] = agentIds ?? (agentId ? [agentId] : []);

  if (resolvedAgentIds.length === 0 || !message) {
    return new Response(JSON.stringify({ error: "agentId(s) and message are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Org-level API keys — decrypt before use (fall back to env vars in stream functions)
  let orgAnthropicKey: string | null = null;
  let orgOpenaiKey: string | null = null;
  try {
    if (orgCheck?.anthropic_api_key) orgAnthropicKey = decrypt(orgCheck.anthropic_api_key as string);
    if (orgCheck?.openai_api_key) orgOpenaiKey = decrypt(orgCheck.openai_api_key as string);
  } catch {
    // Decryption failed — keys may be corrupted or ENCRYPTION_KEY changed; fall back to env vars
  }

  // Fetch all agents
  const { data: agentsData, error: agentsErr } = await supabase
    .from("agents")
    .select("id, name, vendor, model, runtime_type, gateway_url")
    .in("id", resolvedAgentIds);

  if (agentsErr || !agentsData || agentsData.length === 0) {
    return new Response(JSON.stringify({ error: "Agent(s) not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const agents: AgentRow[] = agentsData;

  // Create or reuse conversation
  let convId = conversationId;
  const now = new Date().toISOString();

  if (!convId) {
    convId = `conv-${Date.now()}`;
    const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
    await supabase.from("conversations").insert({
      id: convId,
      org_id: orgId,
      agent_id: agents[0].id, // backward compat: first agent
      title,
      created_at: now,
      updated_at: now,
    });

    // Insert all participants
    const participantRows = agents.map((a) => ({
      id: `cp-${convId}-${a.id}`,
      conversation_id: convId,
      agent_id: a.id,
      joined_at: now,
    }));
    await supabase.from("conversation_participants").insert(participantRows);
  }

  // Save user message
  const userMsgId = `msg-${Date.now()}-u`;
  await supabase.from("messages").insert({
    id: userMsgId,
    conversation_id: convId,
    role: "user",
    content: message,
    created_at: now,
  });

  // Build message history
  const { data: history } = await supabase
    .from("messages")
    .select("role, content, agent_id")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  const chatMessages = (history ?? []).map((m: { role: string; content: string; agent_id?: string | null }) => ({
    role: m.role as string,
    content: m.content,
  })).filter((m) => m.role !== "system");

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Stream responses from each agent sequentially
        for (const agent of agents) {
          const otherAgents = agents.filter((a) => a.id !== agent.id);
          const { contexts, skills, mcpTools, repoContextPrompt } = await fetchAgentContext(supabase, agent.id, agent.runtime_type, orgId);
          const systemPrompt = buildSystemPrompt(agent, contexts, skills, mcpTools, otherAgents, repoContextPrompt);

          // Signal which agent is responding
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ agentStart: true, agentId: agent.id, agentName: agent.name, agentVendor: agent.vendor, runtimeType: agent.runtime_type })}\n\n`));

          let fullResponse = "";

          if (agent.runtime_type === "openclaw" && !agent.gateway_url) {
            // No gateway URL — enqueue for polling-based relay
            const queueId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            await supabase.from("agent_message_queue").insert({
              id: queueId,
              agent_id: agent.id,
              conversation_id: convId,
              org_id: orgId,
              message_content: message,
              user_message_id: userMsgId,
              status: "pending",
              created_at: new Date().toISOString(),
            });

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ queued: true, agentId: agent.id, agentName: agent.name, conversationId: convId })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ agentDone: true, agentId: agent.id })}\n\n`));
            continue;
          } else if (agent.runtime_type === "openclaw" && agent.gateway_url) {
            // Relay to OpenClaw Gateway (Funnel mode)
            const { response: gwResponse } = await streamOpenClawResponse(agent, chatMessages);

            if (gwResponse.body) {
              const reader = gwResponse.body.getReader();
              const decoder = new TextDecoder();
              while (true) {
                const { done: readerDone, value } = await reader.read();
                if (readerDone) break;
                const chunk = decoder.decode(value, { stream: true });

                // Try to parse SSE events from gateway
                const lines = chunk.split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      const text = parsed.text ?? parsed.content ?? "";
                      if (text) {
                        fullResponse += text;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, agentId: agent.id, agentName: agent.name })}\n\n`));
                      }
                    } catch {
                      // Plain text SSE data
                      const text = line.slice(6);
                      if (text) {
                        fullResponse += text;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, agentId: agent.id, agentName: agent.name })}\n\n`));
                      }
                    }
                  }
                }
              }
            } else {
              // Non-streaming fallback: read entire body as text
              const text = await gwResponse.text();
              fullResponse = text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, agentId: agent.id, agentName: agent.name })}\n\n`));
            }
          } else if (agent.vendor === "anthropic") {
            const { stream } = await streamAnthropicResponse(agent, systemPrompt, chatMessages, orgAnthropicKey);
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const text = event.delta.text;
                fullResponse += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, agentId: agent.id, agentName: agent.name })}\n\n`));
              }
            }
          } else if (agent.vendor === "openai") {
            const { stream } = await streamOpenAIResponse(agent, systemPrompt, chatMessages, orgOpenaiKey);
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content;
              if (text) {
                fullResponse += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, agentId: agent.id, agentName: agent.name })}\n\n`));
              }
            }
          } else {
            fullResponse = `Vendor "${agent.vendor}" is not yet supported for chat.`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullResponse, agentId: agent.id, agentName: agent.name })}\n\n`));
          }

          // Save assistant message with agent_id
          const msgId = `msg-${Date.now()}-a-${agent.id}`;
          await supabase.from("messages").insert({
            id: msgId,
            conversation_id: convId,
            role: "assistant",
            content: fullResponse,
            created_at: new Date().toISOString(),
            agent_id: agent.id,
          });

          // Add to chat history for next agent
          chatMessages.push({ role: "assistant", content: `[${agent.name}]: ${fullResponse}` });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ agentDone: true, agentId: agent.id })}\n\n`));
        }

        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
