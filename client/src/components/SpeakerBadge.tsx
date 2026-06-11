// 화자 배지 — 미니 아이콘. 쌀집군=미니 계산기 / 회시생=넥타이 / 도사=댓잎. (#41 v3)
export type Speaker = "dosa" | "cpa" | "ssal";

function CalcIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 100 118">
      <rect x="10" y="8" width="80" height="102" rx="12" fill="#3a3a40" stroke="#1b1b1f" strokeWidth="6" />
      <rect x="20" y="22" width="60" height="22" rx="5" fill="#cfd9c4" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={20 + c * 22} y={54 + r * 18} width="16" height="12" rx="4" fill={r === 2 && c === 2 ? "#E0A92E" : "#5a5a64"} />
        ))
      )}
    </svg>
  );
}
function BowtieIcon() {
  return (
    <svg width="15" height="12" viewBox="0 0 30 22">
      <path d="M3,3 L13,9 L13,13 L3,19 Z" fill="#8f6336" />
      <path d="M27,3 L17,9 L17,13 L27,19 Z" fill="#8f6336" />
      <rect x="12.5" y="8" width="5" height="6" rx="1.5" fill="#b9854f" />
    </svg>
  );
}
function LeafIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path d="M4,20 C4,10 10,4 20,4 C20,14 14,20 4,20 Z" fill="#4ba36f" />
      <path d="M5,19 C9,14 13,10 18,6" fill="none" stroke="#2f7a50" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const BG: Record<Speaker, string> = {
  dosa: "#e6efe2",
  cpa: "#eadfc6",
  ssal: "#e4e4ea",
};

export default function SpeakerBadge({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  return (
    <span
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: BG[speaker] }}
      aria-hidden="true"
    >
      {speaker === "ssal" ? <CalcIcon /> : speaker === "cpa" ? <BowtieIcon /> : <LeafIcon />}
    </span>
  );
}
