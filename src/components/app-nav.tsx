import Link from "next/link";
import { Wordmark } from "@/components/ui/identity";
import { getViewer, homeFor } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";

/**
 * The one persistent chrome element. Guests get sign in / sign up; everyone
 * else gets a link to their own side of the product and a way out.
 */
export async function AppNav() {
  const viewer = await getViewer();

  return (
    <nav className="flex items-center justify-between border-b border-grid px-5 py-3">
      <Link href={viewer ? homeFor(viewer.role) : "/"}>
        <Wordmark size={20} />
      </Link>

      {viewer ? (
        <div className="flex items-center gap-4 text-[12.5px]">
          {viewer.role === "buyer" && (
            <Link href="/requests" className="text-muted hover:text-text">
              My requests
            </Link>
          )}
          {viewer.role === "provider" && (
            <Link href="/provider/feed" className="text-muted hover:text-text">
              Request feed
            </Link>
          )}
          {viewer.role === "admin" && (
            <Link href="/admin/verification" className="text-muted hover:text-text">
              Verification
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="font-mono text-[11.5px] text-faint hover:text-danger">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[12.5px]">
          <Link href="/login" className="text-muted hover:text-text">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-signal px-3.5 py-1.5 font-semibold text-void hover:opacity-90"
          >
            Join
          </Link>
        </div>
      )}
    </nav>
  );
}
