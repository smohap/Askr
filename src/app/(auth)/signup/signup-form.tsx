"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Panel } from "@/components/ui/panel";
import { signUp, type AuthState } from "../actions";

const empty: AuthState = {};

export function SignupForm() {
  const [role, setRole] = useState<"buyer" | "provider">("buyer");
  const [state, action, pending] = useActionState(signUp, empty);

  return (
    <Panel className="p-5">
      <form action={action}>
        <FormError>{state.error}</FormError>

        <Field label="I want to">
          <div className="grid grid-cols-2 gap-2">
            <RoleChip
              selected={role === "buyer"}
              onClick={() => setRole("buyer")}
              title="Post requests"
              sub="Buyer"
            />
            <RoleChip
              selected={role === "provider"}
              onClick={() => setRole("provider")}
              title="Send offers"
              sub="Provider"
            />
          </div>
          <input type="hidden" name="role" value={role} />
        </Field>

        <Field label="Name" htmlFor="fullName">
          <Input id="fullName" name="fullName" autoComplete="name" required placeholder="Your name" />
        </Field>

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

        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Panel>
  );
}

/** Mockup .cat-chip, reused for the one branching choice at signup. */
function RoleChip({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "rounded-[10px] border px-3 py-3 text-left transition-colors " +
        (selected
          ? "border-signal bg-signal-wash text-signal"
          : "border-grid bg-panel-raised text-muted hover:border-signal-dim")
      }
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.06em] opacity-70">
        {sub}
      </span>
    </button>
  );
}
