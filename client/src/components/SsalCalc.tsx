// 거지로그 마스코트 '쌀집이' — 빈티지 쌀집 계산기 (SJ-40B). 무생물(제4조).
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
.sc-sway{transform-box:fill-box;transform-origin:50% 96%;animation:sc-sway 6.5s ease-in-out infinite}
.sc-breathe{transform-box:fill-box;transform-origin:50% 92%;animation:sc-breathe 4s ease-in-out infinite}
.sc-blink{animation:sc-blink 0.95s steps(2,start) infinite}
.sc-led{animation:sc-led 2.2s ease-in-out infinite}
.sc-glow-lcd{animation:sc-glow-lcd 2s ease-in-out infinite}
.sc-k{transform-box:fill-box;transform-origin:center}
.sc-p0{animation:sc-press 0.65s ease-in-out infinite}
.sc-p1{animation:sc-press 0.65s ease-in-out .14s infinite}
.sc-p2{animation:sc-press 0.65s ease-in-out .28s infinite}
.sc-p3{animation:sc-press 0.65s ease-in-out .42s infinite}
@keyframes sc-sway{0%,100%{transform:rotate(-0.9deg)}50%{transform:rotate(0.9deg)}}
@keyframes sc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.015,1.008)}}
@keyframes sc-blink{50%{opacity:.15}}
@keyframes sc-led{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes sc-glow-lcd{0%,100%{stroke:rgba(201,160,90,.4)}50%{stroke:rgba(224,169,46,.9)}}
@keyframes sc-press{0%,100%{transform:translateY(0)}30%{transform:translateY(2px) scale(.94)}}
`;

function lcdPalette(text: string, analyzing: boolean, glow: boolean) {
  if (analyzing) return { text: "#3d4a38", top: "#d4dfc6", bot: "#becbad", stroke: "#6a7a62" };
  if (text.startsWith("+")) return { text: "#0a6b4e", top: "#cce8d8", bot: "#b0d4c0", stroke: "#4a8a6a" };
  if (glow) return { text: "#7a5a18", top: "#ebe0c4", bot: "#d8c8a4", stroke: "#a08030" };
  if (text !== "-----") return { text: "#3d4a38", top: "#d4dfc6", bot: "#becbad", stroke: "#6a7a62" };
  return { text: "#6a7562", top: "#d0dac0", bot: "#bcc6ae", stroke: "#8a9482" };
}

export default function SsalCalc({ level = 0, size = 120, analyzing = false, display = "", glow = false }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const lv = Math.max(0, Math.min(1, level));
  const text = analyzing ? "······" : display || "-----";
  const fs = text.length > 9 ? 7.5 : text.length > 7 ? 9 : text.length > 5 ? 10 : 11;
  const lcd = lcdPalette(text, analyzing, glow);

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
        <linearGradient id={`scB${uid}`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#7a7268" />
          <stop offset="0.5" stopColor="#5c564e" />
          <stop offset="1" stopColor="#4a4540" />
        </linearGradient>
        <linearGradient id={`scL${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lcd.top} />
          <stop offset="1" stopColor={lcd.bot} />
        </linearGradient>
      </defs>

      <g className="sc-sway">
        <ellipse cx="50" cy="114" rx="32" ry="3" fill="#3a3228" opacity="0.35" />

        <g className="sc-breathe">
          <rect x="7" y="5" width="86" height="108" rx="11" fill={`url(#scB${uid})`} stroke="#3a342c" strokeWidth="1.2" />
          <rect x="9" y="7" width="82" height="14" rx="8" fill="#fff" opacity="0.08" />

          <text x="13" y="18" fontSize="4.2" fontWeight="700" fill="#c9c0b0" style={{ letterSpacing: "1px" }}>{CALC_MODEL}</text>
          <rect x="60" y="12" width="26" height="7" rx="1" fill="#3a342c" stroke="#2a241c" strokeWidth="0.5" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={65 + i * 5.5} y1="12.5" x2={65 + i * 5.5} y2="18.5" stroke="#524a40" strokeWidth="0.6" />
          ))}

          <circle cx="54" cy="15.5" r="1.5" fill="#c9a05a" opacity={0.35 + lv * 0.65} className={lv > 0.5 ? "sc-led" : undefined} />

          <rect
            x="12" y="23" width="76" height="21" rx="3"
            fill={`url(#scL${uid})`}
            stroke={lcd.stroke}
            strokeWidth={glow ? 1.5 : 1}
            className={glow ? "sc-glow-lcd" : undefined}
          />
          <rect x="12" y="23" width="76" height="6" rx="3" fill="#fff" opacity="0.18" />
          <text
            x="84" y="37"
            textAnchor="end"
            fontSize={fs}
            fontWeight="700"
            fill={lcd.text}
            className={analyzing ? "sc-blink" : undefined}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.8px" }}
          >
            {text}
          </text>

          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const gold = r === 3 && c === 3;
              const x = 12 + c * 19.5;
              const y = 49 + r * 15.5;
              return (
                <g key={`${r}${c}`} className={`sc-k ${analyzing ? `sc-p${(r + c) % 4}` : ""}`}>
                  <rect
                    x={x} y={y} width="15.5" height="11.5" rx="2.5"
                    fill={gold ? "#c9a05a" : "#e8e2d4"}
                    stroke={gold ? "#8f7048" : "#c4bcb0"}
                    strokeWidth="0.8"
                  />
                  <rect x={x} y={y} width="15.5" height="4" rx="2" fill="#fff" opacity={gold ? 0.35 : 0.2} />
                </g>
              );
            })
          )}
        </g>
      </g>
    </svg>
  );
}
