import type { Metadata } from "next";
import { TopBar } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const { category, title } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name")
    .eq("is_phase1", true)
    .order("sort_order");

  return (
    <>
      <TopBar title="New request" backHref="/" />
      <RequestForm
        categories={categories ?? []}
        initialCategory={typeof category === "string" ? category : undefined}
        initialTitle={typeof title === "string" ? title : undefined}
      />
    </>
  );
}
