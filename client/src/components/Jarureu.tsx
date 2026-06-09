// 거지로그 메인 캐릭터 '자르르' — 아낄수록 차오르는 단지.
// level(0~1)에 따라 금빛이 차오르고, 표정이 밝아진다.
// 상시 애니메이션(숨쉬기/눈깜빡/살랑/반짝임) + 절약액이 늘거나 탭하면 폴짝+금화+반짝 리액션.
// analyzing=true면 돋보기로 사진을 들여다보는 '분석 중' 모션, 끝나면 폭 튀는 비트.
// 라이브러리 없이 SVG + CSS만 사용. (프로토타입 — 추후 정식 디자인 교체)
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { CHARACTER_NAME } from "@/lib/brand";

type Props = {
  /** 0(텅) ~ 1(가득). 누적/주간 수익에 비례. */
  level?: number;
  /** px 크기 */
  size?: number;
  /** 사진 분석 중이면 true — 돋보기로 들여다보는 모션 */
  analyzing?: boolean;
};

const JAR = "M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z";
const STAR = "M0,-4.2 L1.1,-1.1 L4.2,0 L1.1,1.1 L0,4.2 L-1.1,1.1 L-4.2,0 L-1.1,-1.1 Z";

const STYLE = `
.zr-swayG{transform-box:fill-box;transform-origin:50% 96%;animation:zr-sway 5s ease-in-out infinite}
.zr-breatheG{transform-box:fill-box;transform-origin:50% 92%;animation:zr-breathe 3.2s ease-in-out infinite}
.zr-charG{transform-box:fill-box;transform-origin:50% 92%}
.zr-eyes{transform-box:fill-box;transform-origin:center;animation:zr-blink 4.6s ease-in-out infinite}
.zr-spark{transform-box:fill-box;transform-origin:center;animation:zr-twinkle 2.4s ease-in-out infinite}
.zr-coin{transform-box:fill-box;transform-origin:center;animation:zr-coin .6s ease-in forwards}
.zr-bstar{transform-box:fill-box;transform-origin:center;opacity:0}
.zr-b0{animation:zr-burst0 .66s ease-out forwards}
.zr-b1{animation:zr-burst1 .66s ease-out forwards}
.zr-b2{animation:zr-burst2 .66s ease-out forwards}
.zr-b3{animation:zr-burst3 .66s ease-out forwards}
.zr-b4{animation:zr-burst4 .66s ease-out forwards}
.zr-b5{animation:zr-burst5 .66s ease-out forwards}
.zr-mag{transform-box:fill-box;transform-origin:center;animation:zr-mag 1.5s ease-in-out infinite}
@keyframes zr-sway{0%,100%{transform:rotate(-2.4deg)}50%{transform:rotate(2.4deg)}}
@keyframes zr-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.035,1.02)}}
@keyframes zr-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes zr-twinkle{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:1;transform:scale(1)}}
@keyframes zr-coin{0%{opacity:0;transform:translate(50px,5px)}20%{opacity:1}85%{opacity:1;transform:translate(50px,20px) scaleY(.7)}100%{opacity:0;transform:translate(50px,23px) scaleY(.4)}}
@keyframes zr-burst0{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(26px,36px) scale(1.05)}}
@keyframes zr-burst1{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(74px,36px) scale(1.05)}}
@keyframes zr-burst2{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(20px,58px) scale(1.05)}}
@keyframes zr-burst3{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(80px,58px) scale(1.05)}}
@keyframes zr-burst4{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(37px,26px) scale(1.05)}}
@keyframes zr-burst5{0%{opacity:1;transform:translate(50px,56px) scale(.2)}70%{opacity:1}100%{opacity:0;transform:translate(63px,26px) scale(1.05)}}
@keyframes zr-mag{0%,100%{transform:translate(72px,42px) rotate(-10deg)}50%{transform:translate(63px,56px) rotate(10deg)}}
@media (prefers-reduced-motion:reduce){.zr-swayG,.zr-breatheG,.zr-eyes,.zr-spark,.zr-mag{animation:none}}
`;

export default function Jarureu({ level = 0.4, size = 116, analyzing = false }: Props) {
  const lv = Math.max(0, Math.min(1, level));
  const top = 34;
  const bottom = 94;
  const fillTop = bottom - lv * (bottom - top);
  const clipId = "zr-clip-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const mouthD =
    lv < 0.34
      ? "M43,71 Q50,75 57,71"
      : lv < 0.7
        ? "M42,70.5 Q50,78 58,70.5"
        : "M41.5,70 Q50,81 58.5,70";
  const blush = (0.35 + lv * 0.6).toFixed(2);

  const charRef = useRef<SVGGElement>(null);
  const [showFx, setShowFx] = useState(false);
  const [fxKey, setFxKey] = useState(0);
  const fxTimer = useRef<number | undefined>(undefined);

  // 폴짝(스케일)만 — 분석 완료 비트나 저장 축하에 공통으로 쓰임
  function pop() {
    charRef.current?.animate(
      [
        { transform: "scale(1,1)" },
        { transform: "scale(1.13,0.88)", offset: 0.2 },
        { transform: "scale(0.93,1.1)", offset: 0.45 },
        { transform: "scale(1.03,0.98)", offset: 0.7 },
        { transform: "scale(1,1)" },
      ],
      { duration: 520, easing: "ease-out" },
    );
  }

  // 폴짝 + 금화 + 반짝 (저장 축하)
  function fire() {
    setFxKey((k) => k + 1);
    setShowFx(true);
    pop();
    window.clearTimeout(fxTimer.current);
    fxTimer.current = window.setTimeout(() => setShowFx(false), 720);
  }

  useEffect(() => () => window.clearTimeout(fxTimer.current), []);

  // 절약액이 늘면(=기록 성공) 자동 축하. 첫 로딩 데이터로 터지지 않게 1.5초 후 무장.
  const armed = useRef(false);
  const prev = useRef(lv);
  useEffect(() => {
    const t = window.setTimeout(() => {
      armed.current = true;
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (armed.current && lv > prev.current + 0.0005) fire();
    prev.current = lv;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv]);

  // 분석이 끝나는 순간(true→false) 가볍게 폭
  const prevAnalyzing = useRef(analyzing);
  useEffect(() => {
    if (prevAnalyzing.current && !analyzing) pop();
    prevAnalyzing.current = analyzing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzing]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={analyzing ? `${CHARACTER_NAME} (분석 중)` : CHARACTER_NAME}
      onClick={fire}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={JAR} />
        </clipPath>
      </defs>
      <style>{STYLE}</style>

      <g className="zr-swayG">
        <g className="zr-breatheG">
          <g className="zr-charG" ref={charRef}>
            {/* 단지 몸통 (바탕) */}
            <path d={JAR} fill="#ece0c8" />

            {/* 금빛 차오름 (클립) */}
            <g clipPath={`url(#${clipId})`}>
              <rect x="6" y={fillTop} width="88" height={bottom - fillTop + 8} fill="#f2c94c" />
              {lv > 0.02 && <ellipse cx="50" cy={fillTop} rx="42" ry="3.2" fill="#f7dd86" />}
            </g>

            {/* 몸통 외곽선 */}
            <path d={JAR} fill="none" stroke="#a3744a" strokeWidth="2.5" />

            {/* 금땜 자국 (시그니처) */}
            <path
              d="M76,52 l-5,7 l5,7"
              fill="none"
              stroke="#e8b84a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 입구 테 + 뚜껑(모자) */}
            <ellipse cx="50" cy="27" rx="23" ry="6.5" fill="#cda35f" stroke="#8f6336" strokeWidth="2" />
            <ellipse cx="50" cy="21" rx="19" ry="5.8" fill="#b9854f" stroke="#8f6336" strokeWidth="2" />
            <circle cx="50" cy="15" r="3.5" fill="#e8b84a" stroke="#8f6336" strokeWidth="1.5" />

            {/* 볼터치 (가득 찰수록 진해짐) */}
            <ellipse cx="33" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity={blush} />
            <ellipse cx="67" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity={blush} />

            {/* 눈 (깜빡임) */}
            <g className="zr-eyes">
              <circle cx="42" cy="64" r="4" fill="#2b2b2b" />
              <circle cx="58" cy="64" r="4" fill="#2b2b2b" />
              <circle cx="40.6" cy="62.4" r="1.25" fill="#fff" />
              <circle cx="56.6" cy="62.4" r="1.25" fill="#fff" />
            </g>

            {/* 입 (레벨별 표정) */}
            <path d={mouthD} fill="none" stroke="#8a5a3a" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* 상시 반짝임 */}
      <g aria-hidden="true">
        <g transform="translate(16,50)">
          <path className="zr-spark" style={{ animationDelay: "0s" }} d={STAR} fill="#ffd75e" />
        </g>
        <g transform="translate(84,44) scale(0.8)">
          <path className="zr-spark" style={{ animationDelay: ".8s" }} d={STAR} fill="#ffd75e" />
        </g>
        <g transform="translate(74,26) scale(0.7)">
          <path className="zr-spark" style={{ animationDelay: "1.6s" }} d={STAR} fill="#ffd75e" />
        </g>
      </g>

      {/* 분석 중 — 돋보기 스캔 */}
      {analyzing && (
        <g className="zr-mag" aria-hidden="true">
          <circle cx="0" cy="0" r="6.5" fill="#ffffff" opacity="0.32" stroke="#7a5536" strokeWidth="2" />
          <line x1="4.8" y1="4.8" x2="9.5" y2="9.5" stroke="#7a5536" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}

      {/* 리액션 (금화 + 반짝 터짐) */}
      {showFx && (
        <g key={fxKey} aria-hidden="true">
          <ellipse className="zr-coin" cx="0" cy="0" rx="3.4" ry="3.4" fill="#f2c94c" stroke="#d9a93a" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} className={`zr-bstar zr-b${i}`} d={STAR} fill="#ffd75e" />
          ))}
        </g>
      )}
    </svg>
  );
}
