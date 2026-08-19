import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { TopBar } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { loadThread } from "@/lib/chat/thread";
import { createClient } from "@/lib/supabase/server";

/** Mockup screen 06. One thread per (request, provider). */
export default async function BuyerChatPage({
  params,
}: PageProps<"/requests/[id]/chat/[providerId]">) {
  const { id, providerId } = await params;
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  const [{ data: request }, { data: provider }] = await Promise.all([
    supabase.from("requests").select("id, title").eq("id", id).eq("buyer_id", viewer.id).single(),
    supabase.from("provider_profiles").select("id, business_name").eq("id", providerId).single(),
  ]);

  if (!request || !provider) notFound();

  const messages = await loadThread(id, providerId);

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col">
      <TopBar title={provider.business_name} backHref={`/requests/${id}`} />
      <ChatThread
        requestId={id}
        providerId={providerId}
        viewerId={viewer.id}
        initialMessages={messages}
      />
    </div>
  );
}
