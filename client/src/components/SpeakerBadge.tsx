// 화자 배지 — "집"/"자" 텍스트 마크를 대체하는 미니 아이콘 (피드백: 텍스트 프로필 마크 개선)
// 자르르=미니 단지 / 김집사=보타이 / 도사=댓잎. 전부 코드 SVG(프로토타입 톤).
export type Speaker = "dosa" | "butler" | "jarureu";

function JarIcon() {
  return (
    <svg width="15" height="16" viewBox="0 0 100 108">
      <path d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z" fill="#f2c94c" stroke="#a3744a" strokeWidth="6" />
      <ellipse cx="50" cy="27" rx="23" ry="6.5" fill="#cda35f" stroke="#8f6336" strokeWidth="5" />
      <circle cx="50" cy="15" r="5" fill="#e8b84a" stroke="#8f6336" strokeWidth="4" />
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
  butler: "#eadfc6",
  jarureu: "#f7e9c4",
};

export default function SpeakerBadge({ speaker, size = 24 }: { speaker: Speaker; size?: number }) {
  return (
    <span
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: BG[speaker] }}
      aria-hidden="true"
    >
      {speaker === "jarureu" ? <JarIcon /> : speaker === "butler" ? <BowtieIcon /> : <LeafIcon />}
    </span>
  );
}
