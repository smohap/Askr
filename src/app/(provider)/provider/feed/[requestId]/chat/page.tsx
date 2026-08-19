import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatThread } from "@/components/chat/chat-thread";
import { requireProvider } from "@/lib/auth";
import { loadThread } from "@/lib/chat/thread";
import { createClient } from "@/lib/supabase/server";

/** The provider's side of the same thread. */
export default async function ProviderChatPage({
  params,
}: PageProps<"/provider/feed/[requestId]/chat">) {
  const { requestId } = await params;
  const provider = await requireProvider();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, title, profiles(full_name)")
    .eq("id", requestId)
    .single();

  if (!request) notFound();

  const buyer = request.profiles as unknown as { full_name: string } | null;
  const messages = await loadThread(requestId, provider.providerId);

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col py-4">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-[17px] font-semibold">
            {buyer?.full_name || "Buyer"}
          </h1>
          <p className="font-mono text-[11px] text-faint">{request.title}</p>
        </div>
        <Link
          href={`/provider/feed/${requestId}`}
          className="font-mono text-[11.5px] text-faint hover:text-text"
        >
          ← Back to request
        </Link>
      </div>

      <div className="flex flex-1 flex-col rounded-xl border border-grid">
        <ChatThread
          requestId={requestId}
          providerId={provider.providerId}
          viewerId={provider.id}
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
