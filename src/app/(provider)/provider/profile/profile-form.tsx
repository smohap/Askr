"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Panel } from "@/components/ui/panel";
import { NZ_LOCATIONS } from "@/lib/nz-locations";
import { saveProviderProfile, type ProfileFormState } from "./actions";

const empty: ProfileFormState = {};

export function ProfileForm({
  categories,
  selectedCategories,
  profile,
}: {
  categories: { slug: string; name: string }[];
  selectedCategories: string[];
  profile: {
    businessName: string;
    tagline: string | null;
    about: string | null;
    locationLabel: string;
    serviceRadiusKm: number;
  } | null;
}) {
  const [state, action, pending] = useActionState(saveProviderProfile, empty);
  const [radius, setRadius] = useState(profile?.serviceRadiusKm ?? 15);
  const [picked, setPicked] = useState<string[]>(selectedCategories);

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  return (
    <Panel>
      <form action={action}>
        <FormError>{state.error}</FormError>
        {state.notice && (
          <p className="mb-4 rounded-[10px] border border-signal-dim bg-signal-wash-soft px-3.5 py-3 text-[12.5px] text-muted">
            {state.notice}
          </p>
        )}

        <Field label="Business name" htmlFor="businessName">
          <Input
            id="businessName"
            name="businessName"
            required
            defaultValue={profile?.businessName}
            placeholder="Sparkle Clean Co."
          />
        </Field>

        <Field label="Tagline" htmlFor="tagline" hint="One line. Buyers see it beside your offers.">
          <Input
            id="tagline"
            name="tagline"
            maxLength={140}
            defaultValue={profile?.tagline ?? ""}
            placeholder="Eco products, same-day availability"
          />
        </Field>

        <Field label="About" htmlFor="about">
          <Textarea id="about" name="about" rows={4} defaultValue={profile?.about ?? ""} />
        </Field>

        <Field label="Categories you work in" error={picked.length === 0 ? undefined : undefined}>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.slug)}
                aria-pressed={picked.includes(c.slug)}
                className={
                  "rounded-[10px] border px-1 py-2.5 text-[11.5px] transition-colors " +
                  (picked.includes(c.slug)
                    ? "border-signal bg-signal-wash text-signal"
                    : "border-grid bg-panel-raised text-muted hover:border-signal-dim")
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          {picked.map((slug) => (
            <input key={slug} type="hidden" name="categories" value={slug} />
          ))}
        </Field>

        <Field label="Base location" htmlFor="locationLabel">
          <Select
            id="locationLabel"
            name="locationLabel"
            required
            defaultValue={profile?.locationLabel ?? ""}
          >
            <option value="" disabled>
              Choose a location
            </option>
            {NZ_LOCATIONS.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={`Service radius — ${radius}km`}
          hint="You only see requests within this distance, and only if the buyer is looking that far too."
        >
          <input
            type="range"
            name="serviceRadiusKm"
            min={1}
            max={200}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-[var(--signal)]"
            aria-label="Service radius in kilometres"
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Panel>
  );
}
