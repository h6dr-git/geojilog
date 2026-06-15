// 화자 배지 — 미니 아이콘. 쌀집이=미니 계산기 / 회시생=넥타이 / 도사=댓잎. (#41 v3)
export type Speaker = "dosa" | "cpa" | "ssal";

function CalcIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 100 118">
      <rect x="10" y="8" width="80" height="102" rx="11" fill="#3a3a40" stroke="#1b1b1f" strokeWidth="2" />
      <rect x="18" y="21" width="64" height="21" rx="4" fill="#d0dac4" stroke="#171a14" strokeWidth="1" />
      <circle cx="54" cy="15" r="2" fill="#E0A92E" opacity="0.85" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={18 + c * 21}
            y={52 + r * 17}
            width="15"
            height="11"
            rx="3"
            fill={r === 2 && c === 2 ? "#E0A92E" : "#5a5a64"}
            stroke={r === 2 && c === 2 ? "#9a7416" : "#2a2a30"}
            strokeWidth="0.8"
          />
        ))
      )}
    </svg>
  );
}

function BowtieIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 32 24">
      <path d="M4,4 L14,10 L14,14 L4,20 Z" fill="#8f6336" stroke="#6b4a28" strokeWidth="0.6" />
      <path d="M28,4 L18,10 L18,14 L28,20 Z" fill="#8f6336" stroke="#6b4a28" strokeWidth="0.6" />
      <rect x="13.5" y="9" width="5" height="6" rx="1.5" fill="#c9a05a" stroke="#8f6336" strokeWidth="0.5" />
      <rect x="14.5" y="10" width="3" height="2" rx="0.5" fill="#eadfc6" opacity="0.5" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path d="M4,20 C4,10 10,4 20,4 C20,14 14,20 4,20 Z" fill="#4ba36f" stroke="#2f7a50" strokeWidth="0.8" />
      <path d="M5,19 C9,14 13,10 18,6" fill="none" stroke="#2f7a50" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const STYLE: Record<Speaker, { bg: string; ring: string }> = {
  dosa: { bg: "#e6efe2", ring: "rgba(75,163,111,0.35)" },
  cpa: { bg: "#eadfc6", ring: "rgba(224,169,46,0.4)" },
  ssal: { bg: "#e8e8ee", ring: "rgba(90,90,100,0.3)" },
};

export default function SpeakerBadge({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  const s = STYLE[speaker];
  return (
    <span
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: s.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(26,26,23,0.06)`,
        border: `1px solid ${s.ring}`,
      }}
      aria-hidden="true"
    >
      {speaker === "ssal" ? <CalcIcon /> : speaker === "cpa" ? <BowtieIcon /> : <LeafIcon />}
    </span>
  );
}
