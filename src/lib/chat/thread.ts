import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/components/chat/chat-thread";

/**
 * Load one thread's history.
 *
 * chat-attachments is a private bucket, so each attachment gets a short-lived
 * signed URL rather than a public one. An hour is long enough to read a thread
 * and short enough that a copied URL stops working.
 */
const SIGNED_URL_TTL_SECONDS = 3600;

export async function loadThread(
  requestId: string,
  providerId: string,
): Promise<ChatMessage[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("messages")
    .select("id, sender_id, body, attachment_path, mime_type, created_at")
    .eq("request_id", requestId)
    .eq("provider_id", providerId)
    .order("created_at");

  if (!rows?.length) return [];

  const paths = rows.map((r) => r.attachment_path).filter((p): p is string => Boolean(p));

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    body: r.body,
    attachmentUrl: r.attachment_path ? (signed.get(r.attachment_path) ?? null) : null,
    mimeType: r.mime_type,
    createdAt: r.created_at,
  }));
}
