import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  getVendorColor,
  getVendorBgColor,
  getStatusColor,
  formatCurrency,
} from "@/lib/utils";
import type { Vendor, AgentStatus } from "@/types";

type AgentNodeData = {
  name: string;
  vendor: Vendor;
  model: string;
  status: AgentStatus;
  monthlyCost: number;
  agentId: string;
};

function AgentNodeComponent({ data }: NodeProps) {
  const { name, vendor, model, status, monthlyCost } =
    data as unknown as AgentNodeData;
  const vendorColor = getVendorColor(vendor);
  const bgColor = getVendorBgColor(vendor);
  const statusColor = getStatusColor(status);

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Top} id="source-top" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <div
        className="rounded-lg px-3 py-2 shadow-sm border min-w-[160px]"
        style={{ backgroundColor: bgColor, borderColor: vendorColor + "40" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-sm font-semibold text-slate-800 truncate">
            {name}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
          <span>{model}</span>
          <span>{formatCurrency(monthlyCost)}/mo</span>
        </div>
      </div>
    </>
  );
}

export const AgentNode = memo(AgentNodeComponent);
