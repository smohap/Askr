import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-6 text-center text-[13px] text-muted">
        New here?{" "}
        <Link href="/signup" className="text-signal hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
