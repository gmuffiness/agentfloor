import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getVendorColor, getVendorLabel, formatCurrency } from "@/lib/utils";
import type { Vendor } from "@/types";

type DepartmentNodeData = {
  name: string;
  agentCount: number;
  budget: number;
  monthlySpend: number;
  vendor: Vendor;
};

function DepartmentNodeComponent({ data }: NodeProps) {
  const { name, agentCount, budget, monthlySpend, vendor } =
    data as unknown as DepartmentNodeData;
  const color = getVendorColor(vendor);

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <div
        className="rounded-lg bg-white px-4 py-3 shadow-md min-w-[200px]"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {getVendorLabel(vendor)} Dept
        </div>
        <div className="text-sm font-bold text-slate-800 mt-0.5">{name}</div>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          <span>{agentCount} agents</span>
          <span>{formatCurrency(monthlySpend)} / {formatCurrency(budget)}</span>
        </div>
      </div>
    </>
  );
}

export const DepartmentNode = memo(DepartmentNodeComponent);
