"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/money";
import { sendMessage, type ChatState } from "@/lib/chat/actions";

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  mimeType: string | null;
  createdAt: string;
};

const empty: ChatState = {};

export function ChatThread({
  requestId,
  providerId,
  viewerId,
  initialMessages,
}: {
  requestId: string;
  providerId: string;
  viewerId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, action, pending] = useActionState(sendMessage, empty);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The sender sees their own message immediately; Realtime delivers everyone
  // else's. The optimistic row is replaced when the real one arrives.
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current, body: string) => [
      ...current,
      {
        id: `pending-${current.length}`,
        senderId: viewerId,
        body,
        attachmentUrl: null,
        mimeType: null,
        createdAt: new Date().toISOString(),
      },
    ],
  );

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${requestId}:${providerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "askr",
          table: "messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            provider_id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          // One request can have several threads; keep only this one.
          if (row.provider_id !== providerId) return;

          setMessages((current) =>
            current.some((m) => m.id === row.id)
              ? current
              : [
                  ...current,
                  {
                    id: row.id,
                    senderId: row.sender_id,
                    body: row.body,
                    attachmentUrl: null,
                    mimeType: null,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requestId, providerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimistic.length]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="scrollbar-none flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">
        {optimistic.length === 0 && (
          <p className="my-auto text-center text-[12.5px] text-faint">
            No messages yet. Ask anything before you accept.
          </p>
        )}

        {optimistic.map((m) => {
          const mine = m.senderId === viewerId;
          return (
            <div
              key={m.id}
              className={
                "max-w-[75%] rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-[1.4] " +
                (mine
                  ? "self-end rounded-br-[4px] bg-signal-dim font-medium text-void-ink"
                  : "self-start rounded-bl-[4px] border border-grid bg-panel-raised")
              }
            >
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}

              {m.attachmentUrl &&
                (m.mimeType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.attachmentUrl}
                    alt="Attachment"
                    className="mt-1.5 max-w-full rounded-lg"
                  />
                ) : (
                  <a
                    href={m.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 block font-mono text-[11px] underline"
                  >
                    Open attachment
                  </a>
                ))}

              <div
                className={
                  "mt-1 font-mono text-[9.5px] " + (mine ? "text-void-ink/60" : "text-faint")
                }
              >
                {formatTime(m.createdAt)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {state.error && (
        <p role="alert" className="px-5 pb-1 text-[11.5px] text-danger">
          {state.error}
        </p>
      )}

      <form
        ref={formRef}
        action={(formData) => {
          const body = String(formData.get("body") ?? "");
          if (body.trim()) addOptimistic(body);
          action(formData);
          formRef.current?.reset();
        }}
        className="flex flex-none items-center gap-2 border-t border-grid px-5 pb-[18px] pt-3"
      >
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="providerId" value={providerId} />

        <label className="flex-none cursor-pointer text-muted hover:text-signal" title="Attach">
          <input type="file" name="attachment" accept="image/*,application/pdf" className="sr-only" />
          <span aria-hidden>📎</span>
          <span className="sr-only">Attach a file</span>
        </label>

        <input
          name="body"
          autoComplete="off"
          placeholder="Message…"
          className="flex-1 rounded-full border border-grid bg-panel-raised px-4 py-2.5 text-[13px] text-text placeholder:text-faint focus:border-signal-dim"
        />

        <button
          type="submit"
          disabled={pending}
          aria-label="Send"
          className="size-[38px] flex-none rounded-full bg-signal font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
