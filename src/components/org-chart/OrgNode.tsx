import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { formatCurrency } from "@/lib/utils";

type OrgNodeData = {
  name: string;
  departmentCount: number;
  totalBudget: number;
};

function OrgNodeComponent({ data }: NodeProps) {
  const { name, departmentCount, totalBudget } =
    data as unknown as OrgNodeData;

  return (
    <>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <div className="rounded-xl bg-slate-900 px-6 py-4 shadow-lg min-w-[220px] text-white">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Organization
        </div>
        <div className="text-base font-bold mt-0.5">{name}</div>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span>{departmentCount} departments</span>
          <span>{formatCurrency(totalBudget)} budget</span>
        </div>
      </div>
    </>
  );
}

export const OrgNode = memo(OrgNodeComponent);
