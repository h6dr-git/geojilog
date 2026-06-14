// 데이터 내보내기 시트 — 장부·서재 어디서든 같은 내보내기 UI. (Notion MD 복사 / CSV 다운로드)
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Check, X } from "lucide-react";
import {
  SavingsEntry, ExportRange, fmt, todayStr, filterByRange, toMarkdownTable, toCsv,
} from "@/lib/ledger";

const RANGE_LABELS: Record<ExportRange, string> = {
  all: "전체",
  month: "이번 달",
  week: "이번 주",
  custom: "직접 선택",
};

export default function ExportSheet({ entries, onClose }: { entries: SavingsEntry[]; onClose: () => void }) {
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [copied, setCopied] = useState(false);

  const exportEntries = useMemo(
    () => filterByRange(entries, exportRange, customFrom, customTo),
    [entries, exportRange, customFrom, customTo]
  );
  const exportTotal = useMemo(() => exportEntries.reduce((s, e) => s + e.profit, 0), [exportEntries]);

  const handleCopyMd = async () => {
    const md = toMarkdownTable(exportEntries);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("복사에 실패했습니다. 직접 선택하여 복사해주세요.");
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleDownloadCsv = () => {
    const csv = toCsv(exportEntries);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `거지로그_${RANGE_LABELS[exportRange]}_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 다운로드됩니다");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      style={{ animation: "exFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes exUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes exFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8"
        style={{ animation: "exUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-body font-semibold text-ink">데이터 내보내기</p>
            <p className="voice-label mt-0.5">회시생 · 장부 백업</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <p className="text-caption text-ink-soft mb-2">기간 선택</p>
        <div className="segment-track mb-2">
          {(["all", "month", "week", "custom"] as ExportRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setExportRange(r)}
              className={`flex-1 py-2 rounded-full text-caption font-medium transition-all min-w-0 px-1 ${
                exportRange === r ? "segment-active" : "text-ink-soft active:bg-line/60"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {exportRange === "custom" && (
          <div className="flex gap-2 mt-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-field text-caption py-2" />
            <span className="text-caption text-ink-soft self-center">~</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-field text-caption py-2" />
          </div>
        )}

        <div className="ledger-hero surface-elevated px-4 py-3.5 mt-4">
          <p className="voice-label mb-1.5">내보낼 요약</p>
          <p className="ledger-entry-profit text-title leading-tight">+₩{fmt(exportTotal)}</p>
          <p className="text-caption text-ink-soft mt-1">거래 {exportEntries.length}건 · {RANGE_LABELS[exportRange]}</p>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCopyMd}
            disabled={exportEntries.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 surface-elevated text-body disabled:opacity-40 active:scale-[0.99] transition-transform"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            Notion MD
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={exportEntries.length === 0}
            className="flex-1 btn-primary py-3 rounded-xl disabled:opacity-40"
          >
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>
    </div>
  );
}
