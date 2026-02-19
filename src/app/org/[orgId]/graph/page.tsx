"use client";

import dynamic from "next/dynamic";

const GraphPage = dynamic(
  () => import("@/components/graph/GraphPage").then((m) => ({ default: m.GraphPage })),
  { ssr: false },
);

export default function Graph() {
  return <GraphPage />;
}
