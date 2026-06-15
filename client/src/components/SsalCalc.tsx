// 거지로그 마스코트 '쌀집이' (#41 v3) — 회시생의 쌀집 계산기 (모델명 SJ-40B).
// 무생물(제4조): 디스플레이 숫자/기호 + 모션만. 레이어: shadow→body→brand→led→lcd→keypad→fx
import { useId } from "react";
import { CHARACTER_NAME, CALC_MODEL } from "@/lib/brand";

type Props = {
  level?: number;
  size?: number;
  analyzing?: boolean;
  display?: string;
  glow?: boolean;
};

const STYLE = `
.sc-sway{transform-box:fill-box;transform-origin:50% 96%;animation:sc-sway 6s ease-in-out infinite}
.sc-breathe{transform-box:fill-box;transform-origin:50% 92%;animation:sc-breathe 3.8s ease-in-out infinite}
.sc-blink{animation:sc-blink 1s steps(2,start) infinite}
.sc-led{animation:sc-led 2.4s ease-in-out infinite}
.sc-glow-lcd{animation:sc-glow-lcd 1.8s ease-in-out infinite}
.sc-k{transform-box:fill-box;transform-origin:center}
.sc-p0{animation:sc-press 0.68s ease-in-out infinite}
.sc-p1{animation:sc-press 0.68s ease-in-out .16s infinite}
.sc-p2{animation:sc-press 0.68s ease-in-out .32s infinite}
.sc-p3{animation:sc-press 0.68s ease-in-out .48s infinite}
@keyframes sc-sway{0%,100%{transform:rotate(-1.1deg)}50%{transform:rotate(1.1deg)}}
@keyframes sc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.018,1.01)}}
@keyframes sc-blink{50%{opacity:.2}}
@keyframes sc-led{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes sc-glow-lcd{0%,100%{stroke:rgba(224,169,46,.35)}50%{stroke:rgba(224,169,46,.85)}}
@keyframes sc-press{0%,100%{transform:translateY(0)}28%{transform:translateY(1.8px) scale(.95)}}
`;

function lcdStyle(text: string, analyzing: boolean, glow: boolean) {
  if (analyzing) return { fill: "#243024", lcdTop: "#d6e0c8", lcdBot: "#c2cfb2", border: "#171a14" };
  if (text.startsWith("+")) return { fill: "#047857", lcdTop: "#cfe8d8", lcdBot: "#b8d4c4", border: "#0d5c44" };
  if (glow) return { fill: "#8a6318", lcdTop: "#e8dcc0", lcdBot: "#d4c8a8", border: "#9a7416" };
  if (text !== "-----") return { fill: "#243024", lcdTop: "#d6e0c8", lcdBot: "#c2cfb2", border: "#171a14" };
  return { fill: "#3d4a3d", lcdTop: "#d0d8c4", lcdBot: "#bcc8b0", border: "#171a14" };
}

export default function SsalCalc({ level = 0, size = 120, analyzing = false, display = "", glow = false }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const lv = Math.max(0, Math.min(1, level));
  const text = analyzing ? "······" : display || "-----";
  const fs = text.length > 9 ? 7.8 : text.length > 7 ? 9.2 : text.length > 5 ? 10.2 : 11;
  const lcd = lcdStyle(text, analyzing, glow);
  const ledPulse = lv > 0.55;
  const keyRows = [0, 1, 2, 3];
  const keyCols = [0, 1, 2, 3];

  return (
    <svg
      width={size}
      height={Math.round(size * 1.18)}
      viewBox="0 0 100 118"
      role="img"
      aria-label={`${CHARACTER_NAME} (${CALC_MODEL})`}
      className={glow ? "ssal-glow-wrap" : undefined}
    >
      <style>{STYLE}</style>
      <defs>
        <linearGradient id={`scBody${uid}`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#44444c" />
          <stop offset="0.45" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#27272c" />
        </linearGradient>
        <linearGradient id={`scLcd${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lcd.lcdTop} />
          <stop offset="1" stopColor={lcd.lcdBot} />
        </linearGradient>
        <filter id={`scSoft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>

      <g className="sc-sway">
        {/* shadow */}
        <ellipse cx="50" cy="113" rx="30" ry="3.5" fill="#000" opacity="0.18" />

        <g className="sc-breathe" filter={`url(#scSoft${uid})`}>
          {/* body */}
          <rect x="8" y="6" width="84" height="106" rx="10" fill={`url(#scBody${uid})`} stroke="#1b1b1f" strokeWidth="1.5" />
          <rect x="9" y="7" width="82" height="12" rx="8" fill="#fff" opacity="0.07" />
          <rect x="8" y="6" width="3" height="106" rx="2" fill="#fff" opacity="0.04" />

          {/* brand + solar */}
          <text x="14" y="17.5" fontSize="4.4" fontWeight="700" fill="#a8a29a" style={{ letterSpacing: "0.9px" }}>{CALC_MODEL}</text>
          <rect x="61" y="11" width="25" height="7.5" rx="1.2" fill="#121218" stroke="#000" strokeWidth="0.5" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={66 + i * 5.8} y1="11.5" x2={66 + i * 5.8} y2="18" stroke="#2a2a34" strokeWidth="0.7" />
          ))}

          {/* led */}
          <circle
            cx="55"
            cy="14.6"
            r="1.6"
            fill="#E0A92E"
            opacity={lv < 0.15 ? 0.22 : 0.3 + lv * 0.7}
            className={ledPulse ? "sc-led" : undefined}
          />

          {/* lcd */}
          <rect
            x="13"
            y="22"
            width="74"
            height="20"
            rx="3.5"
            fill={`url(#scLcd${uid})`}
            stroke={lcd.border}
            strokeWidth={glow ? 1.6 : 1.2}
            className={glow ? "sc-glow-lcd" : undefined}
            opacity={0.82 + lv * 0.18}
          />
          <text
            x="83"
            y="36"
            textAnchor="end"
            fontSize={fs}
            fontWeight="700"
            fill={lcd.fill}
            className={analyzing ? "sc-blink" : undefined}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "1px" }}
          >
            {text}
          </text>

          {/* keypad */}
          {keyRows.map((r) =>
            keyCols.map((c) => {
              const isGold = r === 3 && c === 3;
              const x = 13 + c * 19;
              const y = 48 + r * 16;
              const pressCls = analyzing ? `sc-p${(r + c) % 4}` : undefined;
              return (
                <g key={`${r}${c}`} className={`sc-k ${pressCls ?? ""}`}>
                  <rect
                    x={x}
                    y={y}
                    width="16"
                    height="12"
                    rx="3"
                    fill={isGold ? "#E0A92E" : "#4a4a52"}
                    stroke={isGold ? "#9a7416" : "#1f1f24"}
                    strokeWidth="1"
                    opacity={isGold ? 0.8 + lv * 0.2 : 0.95}
                  />
                  <rect x={x} y={y} width="16" height="4.5" rx="2.5" fill="#fff" opacity={isGold ? 0.28 : 0.08} />
                </g>
              );
            })
          )}

          {/* fx — LCD 유리 반사 */}
          <rect x="13" y="22" width="74" height="7" rx="3" fill="#fff" opacity="0.14" />
          <rect x="10" y="8" width="78" height="4" rx="2" fill="#fff" opacity="0.05" />
        </g>
      </g>
    </svg>
  );
}
