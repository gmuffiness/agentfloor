"use client";

import dynamic from "next/dynamic";

const OrgChartPage = dynamic(
  () => import("@/components/org-chart/OrgChartPage").then((m) => ({ default: m.OrgChartPage })),
  { ssr: false },
);

export default function OrgChart() {
  return <OrgChartPage />;
}
