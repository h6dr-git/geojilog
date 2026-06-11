// 수익원 선택 칩 (#37+#38) — QuickRecord·수동입력·상세시트 편집 공용.
// gold 계열로 카테고리(emerald)와 시각 구분: 카테고리="어디에 쓴 돈", 수익원="어떻게 번 돈".
import { INCOME_SOURCES } from "@shared/incomeSources";

export default function IncomeSourceChips({
  value,
  onChange,
  allowNone = false,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  /** true면 선택 해제(미분류) 허용 — 같은 칩 다시 탭 */
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INCOME_SOURCES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(allowNone && value === s ? null : s)}
          className={`px-2.5 py-1.5 rounded-full text-caption transition-colors ${
            value === s ? "bg-gold text-white" : "bg-cream text-ink-soft active:bg-line"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
