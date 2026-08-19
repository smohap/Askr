import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "buyer" | "provider" | "admin";

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  /** provider_profiles.id — present only once a provider has created a profile. */
  providerId: string | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected" | null;
};

/**
 * The signed-in user, or null for a guest.
 *
 * Uses getUser() rather than getSession(): getSession trusts the cookie, getUser
 * revalidates the token with Supabase. Everything downstream authorises on this.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  let providerId: string | null = null;
  let verificationStatus: Viewer["verificationStatus"] = null;

  if (profile.role === "provider") {
    const { data: provider } = await supabase
      .from("provider_profiles")
      .select("id, verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    providerId = provider?.id ?? null;
    verificationStatus = provider?.verification_status ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role as Role,
    fullName: profile.full_name,
    providerId,
    verificationStatus,
  };
}

export async function requireViewer(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return viewer;
}

/**
 * Gate a route group on a role. RLS is what actually protects the data — this
 * exists so a buyer landing on /admin gets sent home instead of an empty screen.
 */
export async function requireRole(role: Role, returnTo?: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (viewer.role !== role) redirect(homeFor(viewer.role));
  return viewer;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "provider":
      return "/provider";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}
