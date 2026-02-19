"use client";

import { cn, formatCurrency } from "@/lib/utils";

interface BudgetGaugeProps {
  label: string;
  spent: number;
  budget: number;
  compact?: boolean;
}

export default function BudgetGauge({
  label,
  spent,
  budget,
  compact = false,
}: BudgetGaugeProps) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const isOver = spent > budget;
  const isOrange = !isOver && pct >= 80;
  const isYellow = !isOver && !isOrange && pct >= 60;

  const barColor = isOver
    ? "bg-red-500"
    : isOrange
      ? "bg-orange-400"
      : isYellow
        ? "bg-yellow-400"
        : "bg-emerald-500";

  const textColor = isOver
    ? "text-red-600"
    : isOrange
      ? "text-orange-600"
      : isYellow
        ? "text-yellow-600"
        : "text-emerald-600";

  return (
    <div className={cn("space-y-1", compact ? "text-xs" : "text-sm")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-700 truncate">{label}</span>
        <span className={cn("font-semibold whitespace-nowrap", textColor)}>
          {formatCurrency(spent)} / {formatCurrency(budget)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-gray-400">
        <span>{pct.toFixed(1)}% used</span>
        {isOver && (
          <span className="text-red-500 font-medium">
            {formatCurrency(spent - budget)} over budget
          </span>
        )}
        {!isOver && (
          <span>{formatCurrency(budget - spent)} remaining</span>
        )}
      </div>
    </div>
  );
}
