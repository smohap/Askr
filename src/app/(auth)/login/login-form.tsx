"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Panel } from "@/components/ui/panel";
import { sendMagicLink, signIn, type AuthState } from "../actions";

const empty: AuthState = {};

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [pwState, pwAction, pwPending] = useActionState(signIn, empty);
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, empty);

  return (
    <Panel className="p-5">
      <div className="mb-5 flex gap-1.5">
        <ModeTab active={mode === "password"} onClick={() => setMode("password")}>
          Password
        </ModeTab>
        <ModeTab active={mode === "link"} onClick={() => setMode("link")}>
          Email link
        </ModeTab>
      </div>

      {mode === "password" ? (
        <form action={pwAction}>
          <FormError>{pwState.error}</FormError>
          {next && <input type="hidden" name="next" value={next} />}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" disabled={pwPending}>
            {pwPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form action={linkAction}>
          <FormError>{linkState.error}</FormError>
          {linkState.notice && (
            <p className="mb-4 rounded-[10px] border border-signal-dim bg-signal-wash-soft px-3.5 py-3 text-[12.5px] text-muted">
              {linkState.notice}
            </p>
          )}

          <Field label="Email" htmlFor="link-email" hint="We'll send you a one-time sign-in link.">
            <Input
              id="link-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>

          <Button type="submit" disabled={linkPending}>
            {linkPending ? "Sending…" : "Email me a link"}
          </Button>
        </form>
      )}
    </Panel>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-md border px-4 py-2 font-mono text-[12px] tracking-[0.04em] transition-colors " +
        (active
          ? "border-signal bg-signal font-semibold text-void"
          : "border-grid text-muted hover:border-signal-dim hover:text-text")
      }
    >
      {children}
    </button>
  );
}
