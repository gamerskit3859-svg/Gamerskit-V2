"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackPage() {
  const router = useRouter();
  const [v, setV] = useState("");
  return (
    <section className="px-5 max-w-xl mx-auto py-24 text-center">
      <span className="eyebrow">Tracking</span>
      <h1 className="display-2 mt-2">Find your order.</h1>
      <p className="mt-3 text-[var(--fg-soft)]">
        Enter your order number (e.g. GK-20260101-AB12C).
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) router.push(`/order/${v.trim().toUpperCase()}`);
        }}
        className="mt-8 flex gap-2"
      >
        <input
          className="input"
          placeholder="GK-…"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        <button className="btn btn-primary">Find</button>
      </form>
    </section>
  );
}
