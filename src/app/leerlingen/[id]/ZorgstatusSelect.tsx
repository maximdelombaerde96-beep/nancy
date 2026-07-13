"use client";

import { updateZorgstatus } from "../actions";
import { zorgStatusOpties } from "@/lib/format";

export default function ZorgstatusSelect({
  leerlingId,
  status,
}: {
  leerlingId: string;
  status: string;
}) {
  return (
    <form action={updateZorgstatus} className="inline">
      <input type="hidden" name="leerlingId" value={leerlingId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        {zorgStatusOpties.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
