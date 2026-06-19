import { TrendingUp, TrendingDown } from "lucide-react";
import SpeakerBadge from "@/components/SpeakerBadge";
import { CPA_NAME } from "@/lib/brand";
import { fmt } from "@/lib/ledger";

export default function LedgerStatsBar({
  periodLabel,
  periodTotal,
  entryCount,
  periodCompare,
}: {
  periodLabel: string;
  periodTotal: number;
  entryCount: number;
  periodCompare: number | null;
}) {
  return (
    <div className="ledger-hero surface-elevated p-5 mb-4 animate-fade-up" style={{ animationDelay: "0.04s" }}>
      <div className="flex items-center gap-2 mb-3">
        <SpeakerBadge speaker="cpa" size={20} />
        <p className="voice-label">{CPA_NAME} · {periodLabel} 계상</p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="profit-hero tabular-nums leading-tight">+₩{fmt(periodTotal)}</p>
          <p className="text-caption text-ink-soft mt-1.5">
            거래 {entryCount}건
            {periodCompare != null && (
              <span className={periodCompare >= 0 ? " text-emerald-600" : " text-ink-soft"}>
                {" · "}지난달 같은 기간 대비 {periodCompare >= 0 ? "+" : "−"}₩{fmt(Math.abs(periodCompare))}
              </span>
            )}
          </p>
        </div>
        {periodCompare != null && (
          <span className={`ledger-trend-chip shrink-0 ${periodCompare >= 0 ? "ledger-trend-up" : "ledger-trend-down"}`}>
            {periodCompare >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {periodCompare >= 0 ? "+" : "−"}₩{fmt(Math.abs(periodCompare))}
          </span>
        )}
      </div>
    </div>
  );
}
