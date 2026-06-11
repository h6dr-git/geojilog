// 카드 스킨 공용 모듈 (#23) — 공유 카드(Wrapped·앨범·이후 단건 카드)의 테마·스티커 단일 출처.
// 원칙(SSOT): '제약된 큐레이트' — 프리폼 에디터 금지, 테마 3종 + 스티커 토글만.
// 캡처 안전: 외부 이미지·CSS 변수 금지 — 인라인 SVG/텍스트/hex만 쓴다.
// 선택은 기기에 기억(KIT_KEY) — Wrapped와 앨범이 같은 취향을 공유한다("내 스킨").

export const KIT_KEY = "geojilog:album-kit";

export type CardTheme = {
  id: string;
  name: string;
  bg: string;
  border: string;
  divider: string; // 구분선 (카드 내부)
  label: string;   // 작은 라벨 텍스트
  title: string;   // 제목
  accent: string;  // +수익
  sub: string;     // 보조 텍스트
  footer: string;  // 하단 워터마크
};

export const CARD_THEMES: CardTheme[] = [
  { id: "forest", name: "서재", bg: "#16201A", border: "rgba(224,169,46,0.25)", divider: "rgba(255,255,255,0.1)", label: "#7E8C82", title: "#F4EFE3", accent: "#10B981", sub: "#9aa89e", footer: "#5E6A60" },
  { id: "hanji", name: "한지", bg: "#FAF8F3", border: "#EFE9DC", divider: "#EFE9DC", label: "#B8B2A6", title: "#1A1A17", accent: "#059669", sub: "#8A857B", footer: "#B8B2A6" },
  { id: "gold", name: "명품관", bg: "#1A150A", border: "rgba(224,169,46,0.35)", divider: "rgba(224,169,46,0.18)", label: "#8C7B5A", title: "#F2E3C2", accent: "#E0A92E", sub: "#8C7B5A", footer: "#6B5C3E" },
];

export const CARD_STICKERS = [
  { id: "crown", name: "왕관" },
  { id: "won", name: "₩ 반짝" },
  { id: "jar", name: "자르르" },
  { id: "seal", name: "수익 인장" }, // '지켜냄' 워딩 폐기(2026-06-10 확정) → 김집사 레지스터 '수익 실현'
] as const;
export type StickerId = (typeof CARD_STICKERS)[number]["id"];

export type CardKit = { theme: string; stickers: StickerId[] };

export function loadKit(): CardKit {
  try {
    const raw = localStorage.getItem(KIT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (typeof v.theme === "string" && Array.isArray(v.stickers)) return v;
    }
  } catch { /* 무시 */ }
  return { theme: "forest", stickers: ["jar"] };
}

export function saveKit(kit: CardKit) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(kit)); } catch { /* 무시 */ }
}

export function themeById(id: string): CardTheme {
  return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0];
}

// ── 스티커 (캡처 안전 — 인라인 SVG/텍스트만) ──────────────────

export function CrownSticker({ color = "#E0A92E" }: { color?: string }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" style={{ display: "block" }}>
      <path d="M2,13 L1.2,4.5 L6.2,8 L11,2 L15.8,8 L20.8,4.5 L20,13 Z" fill={color} stroke="none" />
      <rect x="2" y="13.4" width="18" height="2" rx="1" fill={color} />
    </svg>
  );
}

export function JarSticker({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * (37 / 34))} viewBox="0 0 100 108" style={{ display: "block" }}>
      <path d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z" fill="#ece0c8" stroke="#a3744a" strokeWidth="3" />
      <rect x="14" y="60" width="72" height="34" rx="14" fill="#f2c94c" />
      <ellipse cx="50" cy="27" rx="23" ry="6.5" fill="#cda35f" stroke="#8f6336" strokeWidth="2.5" />
      <ellipse cx="50" cy="21" rx="19" ry="5.8" fill="#b9854f" stroke="#8f6336" strokeWidth="2.5" />
      <circle cx="50" cy="15" r="3.5" fill="#e8b84a" stroke="#8f6336" strokeWidth="2" />
      <circle cx="42" cy="64" r="4" fill="#2b2b2b" />
      <circle cx="58" cy="64" r="4" fill="#2b2b2b" />
      <path d="M42,70.5 Q50,78 58,70.5" fill="none" stroke="#8a5a3a" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="33" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity="0.7" />
      <ellipse cx="67" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity="0.7" />
    </svg>
  );
}

// ₩ 산란 — 카드 배경 전체에 옅게 흩뿌림 (부모가 position:relative + overflow:hidden일 것)
export function WonScatter({ accent }: { accent: string }) {
  return (
    <div aria-hidden="true">
      {[
        { l: "8%", t: "30%", s: "22px", o: 0.12, r: "-14deg" },
        { l: "82%", t: "18%", s: "16px", o: 0.14, r: "10deg" },
        { l: "70%", t: "72%", s: "26px", o: 0.1, r: "-8deg" },
        { l: "14%", t: "78%", s: "15px", o: 0.13, r: "12deg" },
      ].map((p, i) => (
        <span key={i} style={{ position: "absolute", left: p.l, top: p.t, fontSize: p.s, opacity: p.o, color: accent, fontFamily: "'JetBrains Mono', ui-monospace, monospace", transform: `rotate(${p.r})` }}>₩</span>
      ))}
    </div>
  );
}

// 수익 실현 인장 — 도장처럼 비스듬히
export function SealStamp({ accent }: { accent: string }) {
  return (
    <div style={{ border: `1.5px solid ${accent}`, color: accent, fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", transform: "rotate(-8deg)", letterSpacing: "1px", opacity: 0.9 }}>
      수익 실현
    </div>
  );
}
