// 화자 배지 — 절약사무소 톤
export type Speaker = "dosa" | "cpa" | "ssal";

const PALETTE: Record<Speaker, { bg: string; ring: string; accent: string }> = {
  dosa: { bg: "#e8efe4", ring: "#8fb896", accent: "#3d7a52" },
  cpa: { bg: "#f0e6d2", ring: "#c9a05a", accent: "#8f6336" },
  ssal: { bg: "#ebe8e2", ring: "#9a9488", accent: "#5c564c" },
};

function CalcIcon({ accent }: { accent: string }) {
  return (
    <svg width="13" height="15" viewBox="0 0 100 118">
      <rect x="12" y="10" width="76" height="98" rx="10" fill={accent} />
      <rect x="20" y="24" width="60" height="20" rx="3" fill="#d8e2cc" />
      <rect x="22" y="54" width="14" height="10" rx="2" fill="#e8e2d6" />
      <rect x="40" y="54" width="14" height="10" rx="2" fill="#e8e2d6" />
      <rect x="58" y="78" width="14" height="10" rx="2" fill="#c9a05a" />
    </svg>
  );
}

function BowtieIcon({ accent }: { accent: string }) {
  return (
    <svg width="14" height="11" viewBox="0 0 28 20">
      <path d="M3,4 L12,9 L12,11 L3,16 Z" fill={accent} />
      <path d="M25,4 L16,9 L16,11 L25,16 Z" fill={accent} />
      <rect x="11.5" y="8" width="5" height="5" rx="1.2" fill="#c9a05a" />
    </svg>
  );
}

function LeafIcon({ accent }: { accent: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 22 22">
      <path d="M3,18 C3,10 9,4 18,4 C18,12 12,18 3,18 Z" fill={accent} opacity="0.85" />
    </svg>
  );
}

export default function SpeakerBadge({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  const p = PALETTE[speaker];
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: p.bg,
        border: `1.5px solid ${p.ring}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
      aria-hidden="true"
    >
      {speaker === "ssal" ? <CalcIcon accent={p.accent} /> : speaker === "cpa" ? <BowtieIcon accent={p.accent} /> : <LeafIcon accent={p.accent} />}
    </span>
  );
}
