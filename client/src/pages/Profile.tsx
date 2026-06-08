// 프로필 탭 — 누적·건수·최고(진짜) + 자랑/내보내기(기록 탭으로 연결).
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Hwasubun from "@/components/Hwasubun";
import { Share2, Download, ChevronRight } from "lucide-react";

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
type Entry = { profit: number };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl py-3.5 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

export default function Profile({ onGoRecords }: { onGoRecords: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const list = entries as Entry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;
  const best = list.reduce((m, e) => Math.max(m, e.profit || 0), 0);

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-12 pb-24">
      <header className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <Hwasubun level={Math.min(1, total / 50000)} size={92} />
        </div>
        <p className="text-base font-semibold text-gray-800">회장님</p>
        <p className="text-xs text-gray-400 mt-0.5">자르르와 함께 절약 중</p>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat label="누적 수익" value={won(total)} />
        <Stat label="총 기록" value={`${count}건`} />
        <Stat label="최고 한 건" value={won(best)} />
      </div>

      <button
        onClick={onGoRecords}
        className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3.5 mb-2.5 active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm text-gray-700">
          <Share2 size={17} className="text-emerald-500" /> 자랑 카드 만들기
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      <button
        onClick={onGoRecords}
        className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3.5 active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm text-gray-700">
          <Download size={17} className="text-emerald-500" /> 데이터 내보내기
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>

      <p className="text-center text-[11px] text-gray-300 mt-10 font-mono tracking-wider">
        거지록 · 화수분 자르르와 함께
      </p>
    </div>
  );
}
