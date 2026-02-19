"use client";

import { useOrgId } from "@/hooks/useOrgId";
import { ChatPage } from "@/components/chat/ChatPage";

export default function ChatRoute() {
  const orgId = useOrgId();
  return (
    <div className="h-[calc(100vh-6rem)]">
      <ChatPage orgId={orgId} />
    </div>
  );
}
