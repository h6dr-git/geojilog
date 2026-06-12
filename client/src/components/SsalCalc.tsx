// 거지로그 마스코트 '쌀집이' (#41 v3) — 회시생의 쌀집 계산기 (모델명 SJ-40B).
// 무생물이다(제4조): 인격은 회시생의 우기기. 디스플레이 숫자/기호 + 모션은 '그가 치는 중' 연출(손은 안 그림).
// level(0~1)에 따라 LCD·골드 키에 생기가 돌고(연출), analyzing=true면 회시생이 두드리는 중(타닥타닥).
// 라이브러리 없이 SVG + CSS만. (자르르 단지(Jarureu.tsx)는 보류 자산으로 동면)
import { useId } from "react";
import { CHARACTER_NAME, CALC_MODEL } from "@/lib/brand";

type Props = {
  /** 0(텅) ~ 1(가득). 수익 레벨 — LCD 생기·골드 키 광택 */
  level?: number;
  /** px 너비 */
  size?: number;
  /** 계산 중(분석 중) — 키 타닥타닥 + 디스플레이 점멸 */
  analyzing?: boolean;
  /** LCD 표시 내용 (기본 "-----") — 집무실은 이번 달 수익(마스킹/리빌), 장부 빈 상태는 "E" 등 */
  display?: string;
};

const STYLE = `
.sc-sway{transform-box:fill-box;transform-origin:50% 96%;animation:sc-sway 5.4s ease-in-out infinite}
.sc-breathe{transform-box:fill-box;transform-origin:50% 92%;animation:sc-breathe 3.4s ease-in-out infinite}
.sc-blink{animation:sc-blink 1.1s steps(2,start) infinite}
.sc-led{animation:sc-led 2.6s ease-in-out infinite}
.sc-k{transform-box:fill-box;transform-origin:center}
.sc-p0{animation:sc-press 0.72s ease-in-out infinite}
.sc-p1{animation:sc-press 0.72s ease-in-out .18s infinite}
.sc-p2{animation:sc-press 0.72s ease-in-out .36s infinite}
.sc-p3{animation:sc-press 0.72s ease-in-out .54s infinite}
@keyframes sc-sway{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
@keyframes sc-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,1.012)}}
@keyframes sc-blink{50%{opacity:.25}}
@keyframes sc-led{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes sc-press{0%,100%{transform:translateY(0)}30%{transform:translateY(1.6px) scale(.96)}}
`;

export default function SsalCalc({ level = 0, size = 120, analyzing = false, display = "" }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const lv = Math.max(0, Math.min(1, level));
  const text = analyzing ? "······" : display || "-----";
  // LCD 글자 크기 — 길면 줄임 (세그먼트 느낌은 mono + letterSpacing)
  const fs = text.length > 9 ? 8.2 : text.length > 7 ? 9.5 : 11;
  const keyRows = [0, 1, 2, 3];
  const keyCols = [0, 1, 2, 3];
  return (
    <svg width={size} height={Math.round(size * 1.18)} viewBox="0 0 100 118" role="img" aria-label={`${CHARACTER_NAME} (${CALC_MODEL})`}>
      <style>{STYLE}</style>
      <defs>
        <linearGradient id={`scBody${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#27272c" />
        </linearGradient>
        <linearGradient id={`scLcd${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6e0c8" />
          <stop offset="1" stopColor="#c2cfb2" />
        </linearGradient>
      </defs>
      <g className="sc-sway">
        <g className="sc-breathe">
          {/* 몸체 */}
          <rect x="8" y="6" width="84" height="106" rx="10" fill={`url(#scBody${uid})`} stroke="#1b1b1f" strokeWidth="1.5" />
          <rect x="8" y="6" width="84" height="10" rx="8" fill="#ffffff" opacity="0.06" />
          {/* 브랜드 라인 + 솔라 패널 */}
          <text x="14" y="17.5" fontSize="4.6" fontWeight="700" fill="#b8b2a6" style={{ letterSpacing: "0.8px" }}>{CALC_MODEL}</text>
          <g>
            <rect x="62" y="11.5" width="24" height="7" rx="1.4" fill="#14141a" stroke="#000" strokeWidth="0.6" />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1={68 + i * 6} y1="11.8" x2={68 + i * 6} y2="18.2" stroke="#2c2c36" strokeWidth="0.8" />
            ))}
          </g>
          {/* LED — 수익 레벨 따라 살아남 */}
          <circle cx="16.5" cy="14.8" r="1.7" fill="#E0A92E" opacity={0.25 + lv * 0.75} className={lv > 0.6 ? "sc-led" : undefined} />
          {/* LCD */}
          <rect x="13" y="22" width="74" height="20" rx="3.5" fill={`url(#scLcd${uid})`} stroke="#171a14" strokeWidth="1.2" opacity={0.78 + lv * 0.22} />
          <text
            x="83"
            y="36.2"
            textAnchor="end"
            fontSize={fs}
            fontWeight="700"
            fill="#243024"
            className={analyzing ? "sc-blink" : undefined}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "1.2px" }}
          >
            {text}
          </text>
          {/* 키패드 4×4 — 우하단 골드 = 키 */}
          {keyRows.map((r) =>
            keyCols.map((c) => {
              const isGold = r === 3 && c === 3;
              const x = 13 + c * 19;
              const y = 48 + r * 16;
              const pressCls = analyzing ? `sc-p${(r + c) % 4}` : undefined;
              return (
                <g key={`${r}${c}`} className={`sc-k ${pressCls ?? ""}`}>
                  <rect
                    x={x} y={y} width="16" height="12" rx="3"
                    fill={isGold ? "#E0A92E" : "#4a4a52"}
                    stroke={isGold ? "#9a7416" : "#1f1f24"}
                    strokeWidth="1"
                    opacity={isGold ? 0.75 + lv * 0.25 : 1}
                  />
                  <rect x={x} y={y} width="16" height="4.5" rx="2.6" fill="#ffffff" opacity={isGold ? 0.22 : 0.07} />
                </g>
              );
            })
          )}
        </g>
      </g>
    </svg>
  );
}
