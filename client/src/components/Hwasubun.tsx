// 거지로그 메인 캐릭터 '화수분' — 아낄수록 차오르는 단지.
// level(0~1)에 따라 금빛이 단지 안에 차오릅니다. (프로토타입 — 추후 정식 디자인 교체)
type Props = {
  /** 0(텅) ~ 1(가득). 누적 수익에 비례. */
  level?: number;
  /** px 크기 */
  size?: number;
};

export default function Hwasubun({ level = 0.4, size = 116 }: Props) {
  const lv = Math.max(0, Math.min(1, level));
  const top = 34;
  const bottom = 94;
  const fillTop = bottom - lv * (bottom - top);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="화수분"
    >
      <defs>
        <clipPath id="hsb-jar">
          <path d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z" />
        </clipPath>
      </defs>

      {/* 단지 몸통 (바탕) */}
      <path
        d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z"
        fill="#ece0c8"
      />

      {/* 금빛 차오름 (클립으로 깔끔하게) */}
      <g clipPath="url(#hsb-jar)">
        <rect x="6" y={fillTop} width="88" height={bottom - fillTop + 8} fill="#f2c94c" />
        <ellipse cx="50" cy={fillTop} rx="42" ry="3.5" fill="#f7dd86" />
      </g>

      {/* 몸통 외곽선 (차오름 위에 덧그려 깔끔하게) */}
      <path
        d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z"
        fill="none"
        stroke="#a3744a"
        strokeWidth="2.5"
      />

      {/* 금땜 자국 (시그니처 — 깨진 데 금으로 때움) */}
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

      {/* 얼굴 */}
      <circle cx="42" cy="64" r="3.3" fill="#2b2b2b" />
      <circle cx="58" cy="64" r="3.3" fill="#2b2b2b" />
      <ellipse cx="33" cy="72" rx="4.5" ry="3" fill="#f0b9b0" />
      <ellipse cx="67" cy="72" rx="4.5" ry="3" fill="#f0b9b0" />
      <path d="M44,72 Q50,77 56,72" fill="none" stroke="#7a5536" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
