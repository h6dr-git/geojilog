// 수익 4분류 칩 — QuickRecord·상세·장부 수동입력 공용
import { PROFIT_KINDS, PROFIT_KIND_HINTS, PROFIT_KIND_LABELS, type ProfitKind } from "@shared/profitKinds";

export default function ProfitKindChips({
  value,
  onChange,
}: {
  value: ProfitKind;
  onChange: (v: ProfitKind) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {PROFIT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`ledger-chip px-2.5 py-1.5 transition-all ${
              value === k
                ? "bg-forest text-cream border border-forest font-semibold"
                : "ledger-chip-muted active:brightness-95"
            }`}
          >
            {PROFIT_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="text-micro text-ink-faint mt-1.5">{PROFIT_KIND_HINTS[value]}</p>
    </div>
  );
}

export function ProfitKindBadge({ kind }: { kind: ProfitKind | null | undefined }) {
  const k = kind ?? "save";
  return (
    <span className="ledger-chip ledger-chip-muted px-2 py-0.5 text-micro">
      {PROFIT_KIND_LABELS[k]}
    </span>
  );
}
