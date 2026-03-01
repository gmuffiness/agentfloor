import type { AgentStatus } from "@/types";

/**
 * Compute effective agent status based on stored status and last_active timestamp.
 *
 * If the stored status is "active" but the agent hasn't sent a heartbeat recently,
 * automatically degrade to "idle". This prevents stale "active" states from
 * persisting when agents disconnect without updating their status.
 *
 * Thresholds:
 * - Active: last_active within 15 minutes
 * - Idle: last_active older than 15 minutes
 * - Error: never overridden (always preserved)
 */
export function computeEffectiveStatus(
  storedStatus: AgentStatus,
  lastActive: string | null,
  options?: { isTemplate?: boolean }
): AgentStatus {
  // Error status is always preserved
  if (storedStatus === "error") return "error";

  // Template org agents: skip heartbeat timeout, preserve stored status as-is
  if (options?.isTemplate) return storedStatus;

  // If no last_active, keep stored status
  if (!lastActive) return storedStatus;

  const diffMs = Date.now() - new Date(lastActive).getTime();
  const fifteenMinutes = 15 * 60 * 1000;

  // If stored as active but hasn't pinged in 15 minutes, degrade to idle
  if (storedStatus === "active" && diffMs > fifteenMinutes) {
    return "idle";
  }

  return storedStatus;
}
