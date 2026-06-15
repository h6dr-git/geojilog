// 책상 위 영수증 더미 — 집무실에서 증빙을 올리는 진입점 (문구 없음, 오브젝트 탭).
const STROKE = "#6b5340";

type Props = {
  onTap: () => void;
  busy?: boolean;
};

export default function DeskReceiptTap({ onTap, busy }: Props) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="영수증 사진"
      className={`office-receipt-tap ${busy ? "office-receipt-tap--busy" : ""}`}
    >
      <svg width="44" height="52" viewBox="0 0 44 52" aria-hidden="true">
        {/* 아래 깔린 영수증 */}
        <rect x="6" y="14" width="30" height="36" rx="1.5" fill="#e8e0d0" stroke={STROKE} strokeWidth="0.8" opacity="0.85" />
        <line x1="10" y1="22" x2="32" y2="22" stroke={STROKE} strokeWidth="0.4" opacity="0.35" />
        <line x1="10" y1="28" x2="28" y2="28" stroke={STROKE} strokeWidth="0.4" opacity="0.35" />

        {/* 가운데 */}
        <rect x="8" y="10" width="30" height="36" rx="1.5" fill="#f2ebe0" stroke={STROKE} strokeWidth="0.8" opacity="0.92" />
        <line x1="12" y1="18" x2="34" y2="18" stroke={STROKE} strokeWidth="0.4" opacity="0.4" />
        <line x1="12" y1="24" x2="30" y2="24" stroke={STROKE} strokeWidth="0.4" opacity="0.4" />
        <line x1="12" y1="30" x2="26" y2="30" stroke={STROKE} strokeWidth="0.4" opacity="0.4" />

        {/* 맨 위 — 살짝 들린 증빙 */}
        <g className="office-receipt-tap__top">
          <path
            d="M10,6 L38,6 L38,40 Q38,44 34,44 L14,44 Q10,44 10,40 Z"
            fill="#faf6ec"
            stroke={STROKE}
            strokeWidth="0.9"
          />
          {/* 영수증 톱니 */}
          <path
            d="M10,6 L12,8 L14,6 L16,8 L18,6 L20,8 L22,6 L24,8 L26,6 L28,8 L30,6 L32,8 L34,6 L36,8 L38,6"
            fill="none"
            stroke={STROKE}
            strokeWidth="0.7"
          />
          <line x1="14" y1="14" x2="34" y2="14" stroke={STROKE} strokeWidth="0.5" opacity="0.45" />
          <line x1="14" y1="20" x2="30" y2="20" stroke={STROKE} strokeWidth="0.5" opacity="0.45" />
          <line x1="14" y1="26" x2="24" y2="26" stroke={STROKE} strokeWidth="0.5" opacity="0.45" />
          {/* 빈 줄 = 아직 안 적힌 증빙 */}
          <rect x="14" y="32" width="18" height="2" rx="0.5" fill={STROKE} opacity="0.12" />
        </g>
      </svg>
    </button>
  );
}
