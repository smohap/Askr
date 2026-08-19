"use client";

import { useRef } from "react";
import { Input, Select } from "@/components/ui/form";
import { uploadVerificationDocument } from "./actions";

const DOC_TYPES = [
  { value: "identity", label: "Photo ID" },
  { value: "business", label: "Business registration / NZBN" },
  { value: "insurance", label: "Insurance certificate" },
  { value: "licence", label: "Trade licence" },
];

export function DocumentUpload() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await uploadVerificationDocument(formData);
        formRef.current?.reset();
      }}
      className="space-y-2"
    >
      <Select name="docType" defaultValue="identity" aria-label="Document type">
        {DOC_TYPES.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </Select>

      <Input name="document" type="file" accept="image/*,application/pdf" required />

      <button
        type="submit"
        className="w-full rounded-xl border border-grid px-4 py-2.5 text-[12.5px] font-semibold text-muted transition-colors hover:border-signal-dim hover:text-text"
      >
        Upload document
      </button>
    </form>
  );
}
