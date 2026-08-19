"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChatState = { error?: string };

/**
 * Post to a thread. A thread is (request_id, provider_id) — the buyer talks to
 * each provider separately, so an offer conversation never leaks sideways.
 *
 * messages_insert_thread is what actually authorises this: sender must be
 * auth.uid(), and must be either that provider or the request's buyer.
 */
export async function sendMessage(_prev: ChatState, formData: FormData): Promise<ChatState> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const requestId = String(formData.get("requestId"));
  const providerId = String(formData.get("providerId"));
  const body = String(formData.get("body") ?? "").trim();
  const file = formData.get("attachment");
  const hasFile = file instanceof File && file.size > 0;

  if (body === "" && !hasFile) return {};
  if (body.length > 4000) return { error: "That message is too long." };

  let attachmentPath: string | null = null;
  let mimeType: string | null = null;

  if (hasFile) {
    // Path shape matches the chat_attachments policy: <request>/<provider>/<file>
    const path = `${requestId}/${providerId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type });

    if (error) return { error: "That file could not be uploaded." };

    attachmentPath = path;
    mimeType = file.type;
  }

  const { error } = await supabase.from("messages").insert({
    request_id: requestId,
    provider_id: providerId,
    sender_id: viewer.id,
    body,
    attachment_path: attachmentPath,
    mime_type: mimeType,
  });

  if (error) return { error: "That message could not be sent." };

  revalidatePath(`/requests/${requestId}/chat/${providerId}`);
  return {};
}
