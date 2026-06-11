// 데이터 내보내기 시트 — 장부·서재 어디서든 같은 내보내기 UI. (Notion MD 복사 / CSV 다운로드)
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Check, X } from "lucide-react";
import {
  SavingsEntry, ExportRange, fmt, todayStr, filterByRange, toMarkdownTable, toCsv,
} from "@/lib/ledger";

export default function ExportSheet({ entries, onClose }: { entries: SavingsEntry[]; onClose: () => void }) {
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [copied, setCopied] = useState(false);

  const exportEntries = useMemo(
    () => filterByRange(entries, exportRange, customFrom, customTo),
    [entries, exportRange, customFrom, customTo]
  );

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
    const label = { all: "전체", month: "이번달", week: "이번주", custom: "기간" }[exportRange];
    a.download = `거지로그_${label}_${todayStr()}.csv`;
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
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8"
        style={{ animation: "exUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">데이터 내보내기</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <p className="text-caption text-ink-soft mb-2">기간 선택</p>
        <div className="flex gap-2 flex-wrap">
          {(["all", "month", "week", "custom"] as ExportRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setExportRange(r)}
              className={`px-3 py-1.5 text-caption rounded-full border transition-colors ${
                exportRange === r
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-line text-ink-soft active:bg-cream"
              }`}
            >
              {{ all: "전체", month: "이번 달", week: "이번 주", custom: "직접 선택" }[r]}
            </button>
          ))}
        </div>
        {exportRange === "custom" && (
          <div className="flex gap-2 mt-2.5">
            <input
              type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 text-caption border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400"
            />
            <span className="text-caption text-ink-soft self-center">~</span>
            <input
              type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 text-caption border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400"
            />
          </div>
        )}

        <div className="bg-cream rounded-card px-3.5 py-2.5 mt-4">
          <p className="text-caption text-ink-soft">
            {exportEntries.length}건 · 수익{" "}
            <span className="font-semibold text-emerald-600">₩{fmt(exportEntries.reduce((s, e) => s + e.profit, 0))}</span>
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCopyMd} disabled={exportEntries.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-body border border-line rounded-xl active:bg-cream disabled:opacity-40 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            Notion MD 복사
          </button>
          <button
            onClick={handleDownloadCsv} disabled={exportEntries.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-body border border-line rounded-xl active:bg-cream disabled:opacity-40 transition-colors"
          >
            <Download size={14} />
            CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
