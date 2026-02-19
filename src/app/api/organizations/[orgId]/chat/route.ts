import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

function buildSystemPrompt(
  agent: { name: string; vendor: string; model: string },
  contexts: { type: string; content: string; source_file: string | null }[],
  skills: { name: string }[],
  mcpTools: { name: string; server: string }[]
): string {
  let prompt = `You are acting as the AI agent "${agent.name}" (${agent.vendor}/${agent.model}).\n\n`;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const body = await request.json();
  const { agentId, conversationId, message } = body;

  if (!agentId || !message) {
    return new Response(JSON.stringify({ error: "agentId and message are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();

  // Fetch agent
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, name, vendor, model")
    .eq("id", agentId)
    .single();

  if (agentErr || !agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch agent context, skills, MCP tools
  const [ctxRes, skillsRes, mcpRes] = await Promise.all([
    supabase.from("agent_context").select("type, content, source_file").eq("agent_id", agentId),
    supabase.from("agent_skills").select("skill_id, skills(name)").eq("agent_id", agentId),
    supabase.from("mcp_tools").select("name, server").eq("agent_id", agentId),
  ]);

  const contexts = ctxRes.data ?? [];
  const skills = (skillsRes.data ?? []).map((s: Record<string, unknown>) => {
    const skillData = s.skills as { name: string } | null;
    return { name: skillData?.name ?? "" };
  }).filter((s: { name: string }) => s.name);
  const mcpTools = mcpRes.data ?? [];

  // Create or reuse conversation
  let convId = conversationId;
  const now = new Date().toISOString();

  if (!convId) {
    convId = `conv-${Date.now()}`;
    const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
    await supabase.from("conversations").insert({
      id: convId,
      org_id: orgId,
      agent_id: agentId,
      title,
      created_at: now,
      updated_at: now,
    });
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
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  const messages = (history ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })).filter((m: { role: string }) => m.role !== "system");

  const systemPrompt = buildSystemPrompt(agent, contexts, skills, mcpTools);

  // Stream response based on vendor
  const encoder = new TextEncoder();

  if (agent.vendor === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey });
    const stream = await client.messages.stream({
      model: agent.model || "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          // Save assistant message
          await supabase.from("messages").insert({
            id: `msg-${Date.now()}-a`,
            conversation_id: convId,
            role: "assistant",
            content: fullResponse,
            created_at: new Date().toISOString(),
          });

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
  } else if (agent.vendor === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new OpenAI({ apiKey });
    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages,
    ];

    const stream = await client.chat.completions.create({
      model: agent.model || "gpt-4o",
      messages: openaiMessages,
      stream: true,
    });

    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          await supabase.from("messages").insert({
            id: `msg-${Date.now()}-a`,
            conversation_id: convId,
            role: "assistant",
            content: fullResponse,
            created_at: new Date().toISOString(),
          });

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
  } else {
    return new Response(
      JSON.stringify({ error: `Vendor "${agent.vendor}" is not yet supported for chat` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
