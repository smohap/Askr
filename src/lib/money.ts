import { COMMISSION_BPS, TIMEZONE } from "./config";

/**
 * The four amounts on an order, derived from the accepted offer's price.
 *
 * The buyer pays the provider's quote plus the platform fee. On release the
 * platform keeps that fee as its commission and the provider receives exactly
 * the price they quoted — so `commission_cents === platform_fee_cents`, and the
 * provider's payout is `total_cents - commission_cents`.
 */
export type OrderAmounts = {
  serviceFeeCents: number;
  platformFeeCents: number;
  totalCents: number;
  commissionCents: number;
};

export function quoteToAmounts(priceCents: number): OrderAmounts {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new Error(`price must be a positive integer number of cents, got ${priceCents}`);
  }
  const platformFeeCents = Math.round((priceCents * COMMISSION_BPS) / 10_000);
  return {
    serviceFeeCents: priceCents,
    platformFeeCents,
    totalCents: priceCents + platformFeeCents,
    commissionCents: platformFeeCents,
  };
}

export function providerPayoutCents(amounts: OrderAmounts): number {
  return amounts.totalCents - amounts.commissionCents;
}

const nzd = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
});

/** Cents to a displayable NZD string. Never do arithmetic on the result. */
export function formatNzd(cents: number): string {
  return nzd.format(cents / 100);
}

/** Cents to a bare amount, for table cells where the column header carries NZD. */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

const dateTime = new Intl.DateTimeFormat("en-NZ", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const timeOnly = new Intl.DateTimeFormat("en-NZ", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** UTC timestamp to Pacific/Auckland local time. */
export function formatDateTime(iso: string | Date): string {
  return dateTime.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatTime(iso: string | Date): string {
  return timeOnly.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** "45 min", "1h 20m" — for ETA and countdown, always rendered in mono. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDistance(km: number | null): string {
  if (km === null) return "—";
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}
