"use client";

import { useState } from "react";
import { AddPropertyModal } from "./AddPropertyModal";

export function AddPropertyButton({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-[1000] bg-zinc-950 text-zinc-100 border border-zinc-700 rounded-full w-14 h-14 text-2xl shadow-2xl hover:bg-zinc-800 transition"
        aria-label="Add property"
      >
        +
      </button>
      {open && (
        <AddPropertyModal onClose={() => setOpen(false)} onSaved={onSaved} />
      )}
    </>
  );
}
