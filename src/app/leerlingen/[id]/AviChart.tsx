"use client";

import { useState } from "react";
import {
  aviNiveauVolgorde,
  aviNiveauIndex,
  statusLabel,
  statusMarkColor,
  type AviStatus,
} from "@/lib/avi";
import { formatDatum } from "@/lib/format";

export interface AviPunt {
  toetsmoment: string;
  datum: string; // ISO
  aviNiveau: string;
  status: string;
  leestijdSeconden: number;
  fouten: number;
}

// Layout in SVG-coördinaten; de SVG schaalt responsief mee via viewBox.
const W = 620;
const H = 260;
const M = { top: 20, right: 24, bottom: 44, left: 84 };
const plotW = W - M.left - M.right;
const plotH = H - M.top - M.bottom;

export default function AviChart({ punten }: { punten: AviPunt[] }) {
  const [actief, setActief] = useState<number | null>(null);

  // Alleen punten met een herkenbaar niveau tonen.
  const data = punten
    .map((p) => ({ ...p, idx: aviNiveauIndex(p.aviNiveau) }))
    .filter((p) => p.idx >= 0);

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nog geen AVI-resultaten om een evolutie te tonen.
      </p>
    );
  }

  // Y-domein: bereik van de aanwezige niveaus, met 1 stap marge, binnen de schaal.
  const idxs = data.map((d) => d.idx);
  const yMin = Math.max(0, Math.min(...idxs) - 1);
  const yMax = Math.min(aviNiveauVolgorde.length - 1, Math.max(...idxs) + 1);
  const ySpan = Math.max(1, yMax - yMin);

  const x = (i: number) =>
    M.left + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (idx: number) => M.top + plotH - (plotH * (idx - yMin)) / ySpan;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.idx).toFixed(1)}`)
    .join(" ");

  // Y-tickniveaus (elk heel niveau in het domein).
  const yTicks: number[] = [];
  for (let k = yMin; k <= yMax; k++) yTicks.push(k);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Grafiek van het AVI-niveau over de tijd"
      >
        {/* Gridlijnen + y-labels (recessief) */}
        {yTicks.map((k) => (
          <g key={k}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(k)}
              y2={y(k)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={M.left - 10}
              y={y(k)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-400"
              fontSize={11}
            >
              {aviNiveauVolgorde[k]}
            </text>
          </g>
        ))}

        {/* Verbindingslijn (brand-kleur, 2px) */}
        {data.length > 1 && (
          <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2} />
        )}

        {/* Punten, gekleurd naar status */}
        {data.map((d, i) => {
          const kleur = statusMarkColor[d.status as AviStatus] ?? "#64748b";
          const isActief = actief === i;
          return (
            <g key={d.toetsmoment + i}>
              {/* x-label: toetsmoment */}
              <text
                x={x(i)}
                y={H - M.bottom + 20}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize={11}
              >
                {d.toetsmoment}
              </text>
              <circle
                cx={x(i)}
                cy={y(d.idx)}
                r={isActief ? 7 : 5}
                fill={kleur}
                stroke="#fff"
                strokeWidth={2}
              />
              {/* onzichtbaar groter hit-target bovenop, vangt alle hovers */}
              <circle
                cx={x(i)}
                cy={y(d.idx)}
                r={14}
                fill="transparent"
                onMouseEnter={() => setActief(i)}
                onMouseLeave={() => setActief(null)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {actief !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(x(actief) / W) * 100}%`,
            top: `${(y(data[actief].idx) / H) * 100}%`,
          }}
        >
          <div className="font-semibold text-slate-700">
            {data[actief].toetsmoment} · {data[actief].aviNiveau}
          </div>
          <div className="text-slate-500">{formatDatum(data[actief].datum)}</div>
          <div className="text-slate-500">
            {data[actief].leestijdSeconden}s · {data[actief].fouten} fout
            {data[actief].fouten === 1 ? "" : "en"}
          </div>
          <div
            className="mt-0.5 font-medium"
            style={{
              color: statusMarkColor[data[actief].status as AviStatus] ?? "#64748b",
            }}
          >
            {statusLabel[data[actief].status as AviStatus] ?? data[actief].status}
          </div>
        </div>
      )}

      {/* Statuslegende (identiteit niet alleen via kleur) */}
      <div className="mt-1 flex flex-wrap gap-3 pl-2 text-xs text-slate-500">
        {(["onder", "op", "boven"] as AviStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: statusMarkColor[s] }}
            />
            {statusLabel[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
