"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency, getVendorColor, getVendorLabel, cn } from "@/lib/utils";
import CostPieChart from "@/components/charts/CostPieChart";
import CostTrendChart from "@/components/charts/CostTrendChart";
import BudgetGauge from "@/components/charts/BudgetGauge";
import type { MonthlyCost, Vendor } from "@/types";

export default function CostPage() {
  const orgId = useOrgId();
  const organization = useAppStore((s) => s.organization);
  const getTotalMonthlyCost = useAppStore((s) => s.getTotalMonthlyCost);
  const getVendorCostBreakdown = useAppStore((s) => s.getVendorCostBreakdown);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const totalCost = getTotalMonthlyCost();
  const vendorBreakdown = getVendorCostBreakdown();

  // Pie chart data
  const pieData = (Object.keys(vendorBreakdown) as Vendor[]).map((vendor) => ({
    name: getVendorLabel(vendor),
    value: vendorBreakdown[vendor],
    color: getVendorColor(vendor),
  }));

  // Department breakdown sorted descending
  const deptData = [...organization.departments]
    .sort((a, b) => b.monthlySpend - a.monthlySpend)
    .map((d) => ({
      name: d.name,
      spend: d.monthlySpend,
      vendor: d.primaryVendor,
    }));

  // Aggregated monthly cost trend across all departments
  const monthMap = new Map<string, MonthlyCost>();
  for (const dept of organization.departments) {
    for (const mc of dept.costHistory) {
      const existing = monthMap.get(mc.month);
      if (existing) {
        existing.amount += mc.amount;
        existing.byVendor.anthropic += mc.byVendor.anthropic;
        existing.byVendor.openai += mc.byVendor.openai;
        existing.byVendor.google += mc.byVendor.google;
      } else {
        monthMap.set(mc.month, {
          month: mc.month,
          amount: mc.amount,
          byVendor: { ...mc.byVendor },
        });
      }
    }
  }
  const trendData = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  // Month-over-month change from aggregated cost history
  const lastMonthTotal = trendData[trendData.length - 1]?.amount ?? 0;
  const prevMonthTotal = trendData[trendData.length - 2]?.amount ?? 0;
  const momChange = prevMonthTotal > 0 ? ((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  // Top 5 agents by cost
  const allAgents = organization.departments.flatMap((d) =>
    d.agents.map((a) => ({
      ...a,
      departmentName: d.name,
    })),
  );
  const topAgents = [...allAgents]
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 5);

  // Budget calculations
  const totalBudget = organization.totalBudget;
  const budgetPct = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0;
  const isOrgOverBudget = totalCost > totalBudget && totalBudget > 0;
  const isOrgWarning = budgetPct >= 80 && !isOrgOverBudget && totalBudget > 0;
  const deptsOverBudget = organization.departments.filter(
    (d) => d.budget > 0 && d.monthlySpend > d.budget,
  );
  const deptsWarning = organization.departments.filter(
    (d) =>
      d.budget > 0 &&
      d.monthlySpend <= d.budget &&
      (d.monthlySpend / d.budget) * 100 >= 80,
  );
  const showAlertBanner =
    isOrgOverBudget || isOrgWarning || deptsOverBudget.length > 0 || deptsWarning.length > 0;

  // Daily-average forecast for current month
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const remainingDays = daysInMonth - dayOfMonth;
  const dailyAvg = dayOfMonth > 0 ? totalCost / dayOfMonth : 0;
  const forecastedMonthly = Math.max(0, totalCost + dailyAvg * remainingDays);
  const forecastedAnnual = forecastedMonthly * 12;
  const annualBudget = totalBudget * 12;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/org/${orgId}`}
            className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-100"
          >
            &larr; Back to Map
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Cost Overview</h1>
        </div>

        {/* Budget Alert Banner */}
        {showAlertBanner && !bannerDismissed && (
          <div
            className={cn(
              "rounded-xl border px-5 py-4 text-sm flex gap-3",
              isOrgOverBudget
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            {/* Warning triangle icon */}
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-1">
                {isOrgOverBudget
                  ? "Organization budget exceeded"
                  : "Budget alert"}
              </p>
              <ul className="space-y-0.5 list-disc list-inside">
                {isOrgOverBudget && (
                  <li>
                    Total spend ({formatCurrency(totalCost)}) exceeds org budget (
                    {formatCurrency(totalBudget)}) by{" "}
                    {formatCurrency(totalCost - totalBudget)}
                  </li>
                )}
                {isOrgWarning && !isOrgOverBudget && (
                  <li>
                    Budget usage at {budgetPct.toFixed(1)}% — approaching limit (
                    {formatCurrency(totalBudget - totalCost)} remaining)
                  </li>
                )}
                {deptsOverBudget.map((d) => (
                  <li key={d.id}>
                    {d.name} over budget by{" "}
                    {formatCurrency(d.monthlySpend - d.budget)}
                  </li>
                ))}
                {deptsWarning.map((d) => (
                  <li key={d.id}>
                    {d.name} at{" "}
                    {((d.monthlySpend / d.budget) * 100).toFixed(1)}% of budget
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 opacity-60 hover:opacity-100 leading-none"
              aria-label="Dismiss"
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* Summary Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-baseline gap-6">
            <div>
              <p className="text-sm text-gray-500">This Month Total</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totalCost)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Month-over-Month</p>
              <p
                className={`text-lg font-semibold ${momChange >= 0 ? "text-red-500" : "text-green-500"}`}
              >
                {momChange >= 0 ? "+" : ""}
                {momChange.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Budget Status */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Budget Status
          </h2>
          {totalBudget > 0 ? (
            <div className="space-y-6">
              {/* Org-level gauge */}
              <BudgetGauge
                label="Organization Total"
                spent={totalCost}
                budget={totalBudget}
              />
              {/* Per-department gauges */}
              {organization.departments.filter((d) => d.budget > 0).length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-500">
                    By Department
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {organization.departments
                      .filter((d) => d.budget > 0)
                      .sort((a, b) => b.monthlySpend / b.budget - a.monthlySpend / a.budget)
                      .map((dept) => (
                        <BudgetGauge
                          key={dept.id}
                          label={dept.name}
                          spent={dept.monthlySpend}
                          budget={dept.budget}
                          compact
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-gray-400">
              <p>No budget set for this organization.</p>
              <Link
                href={`/org/${orgId}/settings`}
                className="text-blue-500 hover:underline"
              >
                Configure budget in Settings &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Cost Forecast */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cost Forecast
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Projected Month-End</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(forecastedMonthly)}
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  totalBudget > 0
                    ? forecastedMonthly > totalBudget
                      ? "text-red-500"
                      : "text-emerald-600"
                    : "text-gray-400",
                )}
              >
                {totalBudget > 0
                  ? forecastedMonthly > totalBudget
                    ? `Exceeds budget by ${formatCurrency(forecastedMonthly - totalBudget)}`
                    : `${formatCurrency(totalBudget - forecastedMonthly)} under budget`
                  : `${remainingDays} days remaining · ${formatCurrency(dailyAvg)}/day`}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Projected Annual</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(forecastedAnnual)}
              </p>
              {annualBudget > 0 && (
                <p
                  className={cn(
                    "text-xs mt-1",
                    forecastedAnnual > annualBudget
                      ? "text-red-500"
                      : "text-emerald-600",
                  )}
                >
                  {forecastedAnnual > annualBudget
                    ? `${formatCurrency(forecastedAnnual - annualBudget)} over annual budget`
                    : `${formatCurrency(annualBudget - forecastedAnnual)} under annual budget`}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-1">Daily Average</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dailyAvg)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Based on {dayOfMonth} day{dayOfMonth !== 1 ? "s" : ""} of data
              </p>
            </div>
          </div>
        </div>

        {/* Two-column: Vendor Breakdown + Department Breakdown */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Vendor Breakdown */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Vendor Breakdown
            </h2>
            <CostPieChart data={pieData} />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Vendor</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {pieData.map((d) => (
                  <tr key={d.name} className="border-b last:border-0">
                    <td className="py-2 flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(d.value)}
                    </td>
                    <td className="py-2 text-right">
                      {((d.value / totalCost) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Department Breakdown */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Department Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData} layout="vertical">
                <XAxis
                  type="number"
                  fontSize={12}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  width={110}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                  {deptData.map((entry, index) => (
                    <Cell
                      key={`dept-${index}`}
                      fill={getVendorColor(entry.vendor)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Trend */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Cost Trend
          </h2>
          <CostTrendChart data={trendData} />
        </div>

        {/* Top Agents */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Top Agents by Cost
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Rank</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Vendor</th>
                <th className="pb-2 text-right">Monthly Cost</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((agent, i) => (
                <tr key={agent.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{i + 1}</td>
                  <td className="py-2">{agent.name}</td>
                  <td className="py-2 text-gray-500">
                    {agent.departmentName}
                  </td>
                  <td className="py-2">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{
                        backgroundColor: getVendorColor(agent.vendor),
                      }}
                    >
                      {getVendorLabel(agent.vendor)}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(agent.monthlyCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
