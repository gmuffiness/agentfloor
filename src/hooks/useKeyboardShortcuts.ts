"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";

/**
 * Global keyboard shortcuts for dashboard navigation.
 * - Escape: Clear selection (close drawers)
 * - ?: Toggle shortcut help overlay (only when not in input)
 */
export function useKeyboardShortcuts() {
  const clearSelection = useAppStore((s) => s.clearSelection);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const selectedDepartmentId = useAppStore((s) => s.selectedDepartmentId);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      // Escape — close drawers/modals (allowed even in inputs)
      if (e.key === "Escape") {
        if (selectedAgentId || selectedDepartmentId) {
          e.preventDefault();
          clearSelection();
          return;
        }
      }

      // Skip remaining shortcuts when typing in inputs
      if (isInput) return;

      // ? — toggle help overlay
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const event = new CustomEvent("toggle-shortcut-help");
        window.dispatchEvent(event);
      }
    },
    [clearSelection, selectedAgentId, selectedDepartmentId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
