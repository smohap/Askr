"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { NZ_LOCATIONS } from "@/lib/nz-locations";
import { CATEGORY_FIELDS } from "@/lib/validation/request";
import { createRequest, type RequestFormState } from "../actions";

const empty: RequestFormState = {};

export function RequestForm({
  categories,
  initialCategory,
  initialTitle,
}: {
  categories: { slug: string; name: string }[];
  initialCategory?: string;
  /** Prefilled from the landing page hero, so what the visitor typed survives. */
  initialTitle?: string;
}) {
  const [category, setCategory] = useState(initialCategory ?? categories[0]?.slug ?? "");
  const [budgetMode, setBudgetMode] = useState<"fixed" | "open">("fixed");
  const [budget, setBudget] = useState(180);
  const [radius, setRadius] = useState(15);
  const [state, action, pending] = useActionState(createRequest, empty);

  const extraFields = CATEGORY_FIELDS[category] ?? [];

  return (
    <form action={action} className="px-5 pb-10 pt-[18px]">
      <FormError>{state.error}</FormError>

      <Field label="What do you need" htmlFor="title">
        <Input
          id="title"
          name="title"
          defaultValue={initialTitle}
          required
          placeholder="4-bedroom house clean"
          maxLength={120}
        />
      </Field>

      <Field label="Details" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          required
          placeholder="Need my 4-bedroom house cleaned this Saturday before 3PM. Two bathrooms, no pets."
        />
      </Field>

      <Field label="Category">
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              aria-pressed={category === c.slug}
              className={
                "rounded-[10px] border px-1 py-2.5 text-[11.5px] transition-colors " +
                (category === c.slug
                  ? "border-signal bg-signal-wash text-signal"
                  : "border-grid bg-panel-raised text-muted hover:border-signal-dim")
              }
            >
              {c.name}
            </button>
          ))}
        </div>
        <input type="hidden" name="categorySlug" value={category} />
      </Field>

      {/* Category changes which optional fields render — never the flow. */}
      {extraFields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`detail.${f.name}`}>
          {f.type === "select" ? (
            <Select id={`detail.${f.name}`} name={`detail.${f.name}`} defaultValue="">
              <option value="">Not specified</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`detail.${f.name}`}
              name={`detail.${f.name}`}
              type={f.type === "number" ? "number" : "text"}
              placeholder={f.placeholder}
              required={f.required}
            />
          )}
        </Field>
      ))}

      <Field label="Budget">
        <div className="mb-3 flex gap-1.5">
          <Toggle active={budgetMode === "fixed"} onClick={() => setBudgetMode("fixed")}>
            Fixed price
          </Toggle>
          <Toggle active={budgetMode === "open"} onClick={() => setBudgetMode("open")}>
            Open to offers
          </Toggle>
        </div>
        <input type="hidden" name="budgetMode" value={budgetMode} />

        {budgetMode === "fixed" ? (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={2000}
              step={10}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="flex-1 accent-[var(--signal)]"
              aria-label="Budget"
            />
            <span className="min-w-16 text-right font-mono text-[16px] text-signal">${budget}</span>
            {/* dollars — parseDollarsToCents converts on the server */}
            <input type="hidden" name="budgetDollars" value={budget} />
          </div>
        ) : (
          <p className="text-[12px] text-muted">
            Providers name their own price. You still compare and choose.
          </p>
        )}
      </Field>

      <Field label="Needed by" htmlFor="neededBy">
        <Input id="neededBy" name="neededBy" type="datetime-local" />
      </Field>

      <Field label="Location" htmlFor="locationLabel">
        <Select id="locationLabel" name="locationLabel" required defaultValue="">
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

      <Field label={`Search radius — ${radius}km`}>
        <input
          type="range"
          name="radiusKm"
          min={1}
          max={100}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-[var(--signal)]"
          aria-label="Search radius in kilometres"
        />
      </Field>

      <Field label="Photos" htmlFor="media" hint="Up to 10MB each. Helps providers quote accurately.">
        <Input id="media" name="media" type="file" multiple accept="image/*,application/pdf" />
      </Field>

      <Field label="Urgency">
        <div className="flex gap-1.5">
          <RadioChip name="urgency" value="standard" defaultChecked>
            Standard
          </RadioChip>
          <RadioChip name="urgency" value="urgent">
            Urgent
          </RadioChip>
        </div>
      </Field>

      <Field label="Visibility" hint="Private requests only reach matched providers, never the public feed.">
        <div className="flex gap-1.5">
          <RadioChip name="visibility" value="public" defaultChecked>
            Public
          </RadioChip>
          <RadioChip name="visibility" value="private">
            Private
          </RadioChip>
        </div>
      </Field>

      <Button type="submit" name="intent" value="publish" disabled={pending}>
        {pending ? "Broadcasting…" : "Post request →"}
      </Button>

      <Button
        type="submit"
        name="intent"
        value="draft"
        variant="ghost"
        className="mt-2.5"
        disabled={pending}
      >
        Save as draft
      </Button>
    </form>
  );
}

function Toggle({
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
        "rounded-full border px-3.5 py-1.5 text-[12px] transition-colors " +
        (active
          ? "border-signal bg-signal-wash text-signal"
          : "border-grid bg-panel-raised text-muted hover:border-signal-dim")
      }
    >
      {children}
    </button>
  );
}

function RadioChip({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="block rounded-full border border-grid bg-panel-raised px-3.5 py-1.5 text-[12px] text-muted transition-colors peer-checked:border-signal peer-checked:bg-signal-wash peer-checked:text-signal">
        {children}
      </span>
    </label>
  );
}
