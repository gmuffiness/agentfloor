"use client";

import dynamic from "next/dynamic";

const SpatialCanvas = dynamic(
  () => import("@/components/spatial/SpatialCanvas"),
  { ssr: false },
);

export default function OrgHome() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px - 40px)" }}>
      <div className="flex-1 relative overflow-hidden">
        <SpatialCanvas />
      </div>
    </div>
  );
}
