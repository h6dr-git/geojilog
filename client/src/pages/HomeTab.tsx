// 새 홈 탭 — 자르르 + 최근 7일 수익(진짜) + 사진기록 버튼(진짜).
// 김집사 브리핑·절약 이야기 카드는 아직 '틀'(고정 텍스트) — 다음 단계에서 실제 계산으로 채움.
import { type ChangeEvent, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { won } from "@/lib/format";
import { useAuth } from "@/_core/hooks/useAuth";
import Hwasubun from "@/components/Hwasubun";
import QuickRecord from "@/components/QuickRecord";
import { useDrafts, type Draft } from "@/lib/drafts";
import { Camera, ChevronRight } from "lucide-react";

const WEEKLY_GOAL = 50000; // 자르르가 가득 차는 한 주 목표 (추후 조정)

type Entry = { date: string; profit: number };

function recentWeekProfit(entries: Entry[]): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6); // 오늘 포함 최근 7일
  return entries
    .filter((e) => new Date(e.date + "T00:00:00") >= cutoff)
    .reduce((s, e) => s + (e.profit || 0), 0);
}

export default function HomeTab({ onRecord }: { onRecord: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const weekProfit = recentWeekProfit(entries as Entry[]);
  const level = Math.min(1, weekProfit / WEEKLY_GOAL);

  const drafts = useDrafts();
  const topDraft = drafts[0];
  const cameraRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<File | null>(null);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f) {
      setActiveDraft(null);
      setCaptured(f);
      setSheetOpen(true);
    }
  }
  function openDraft(d: Draft) {
    setCaptured(null);
    setActiveDraft(d);
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
    setCaptured(null);
    setActiveDraft(null);
  }

  return (
    <>
    <div className="min-h-screen max-w-lg mx-auto px-4 pb-24">
      <header className="pt-12 pb-1 text-center">
        <p className="text-[11px] font-mono text-gray-400 tracking-widest uppercase">{APP_NAME}</p>
      </header>

      {/* 자르르 + 최근 7일 수익 (진짜 데이터) */}
      <div className="flex flex-col items-center text-center">
        <Hwasubun level={level} size={132} />
        <p className="mt-3 text-sm text-gray-500">최근 7일, {josa(CHARACTER_NAME, "이", "가")} 이만큼 찼어요</p>
        <p className="font-mono text-4xl font-bold text-emerald-500 tabular-nums leading-tight">
          +{won(weekProfit)}
        </p>
      </div>

      {/* 핵심 행동 — 카메라 바로 (1탭 기록) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <button
        onClick={() => cameraRef.current?.click()}
        className="mt-6 w-full bg-emerald-500 text-white font-medium py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        <Camera size={18} /> 사진으로 한 끼 기록하기
      </button>

      {/* 미완성(나중에 채우기) 배지 */}
      {topDraft && (
        <button
          onClick={() => openDraft(topDraft)}
          className="mt-2.5 w-full flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-2xl px-3.5 py-3 text-left active:bg-amber-100 transition-colors"
        >
          <img src={topDraft.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-amber-800">금액 안 채운 기록 {drafts.length}개</p>
            <p className="text-[11px] text-amber-600 truncate">탭해서 마저 채우기</p>
          </div>
          <ChevronRight size={16} className="text-amber-400 shrink-0" />
        </button>
      )}

      {/* 전체 기록 보기 */}
      <button
        onClick={onRecord}
        className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-400 py-2"
      >
        전체 기록 보기 <ChevronRight size={13} />
      </button>

      {/* 김집사 주간 브리핑 (틀) */}
      <div className="mt-5 flex gap-2.5 bg-[#faf7f0] border border-[#efe8d8] rounded-2xl p-3.5">
        <div className="w-7 h-7 rounded-lg bg-[#eadfc6] flex items-center justify-center text-[#a9863f] shrink-0 text-[13px] font-medium">
          집
        </div>
        <div className="text-left">
          <p className="text-[11px] text-[#b09a63] mb-0.5">김집사의 주간 브리핑</p>
          <p className="text-[13px] text-[#5c5647] leading-relaxed">
            회장님, 이번 주도 알뜰히 운용 중이십니다. (주간 브리핑은 곧 자동으로 채워집니다.)
          </p>
        </div>
      </div>

      {/* 절약 이야기 카드 (틀) */}
      <p className="mt-6 mb-2 text-[11px] text-gray-400">내 절약 이야기</p>
      <div className="flex gap-2.5">
        <div className="flex-1 border border-gray-100 rounded-2xl p-3 text-center">
          <div className="text-xl" aria-hidden="true">🍗</div>
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            이번 달 아낀 돈<br />치킨 환산 <span className="text-gray-300">(준비중)</span>
          </p>
        </div>
        <div className="flex-1 border border-gray-100 rounded-2xl p-3 text-center">
          <div className="text-xl" aria-hidden="true">🥇</div>
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            절약 1위<br />카테고리 <span className="text-gray-300">(준비중)</span>
          </p>
        </div>
      </div>

      {/* 도사 한 마디 */}
      <div className="mt-5 border border-gray-100 rounded-2xl px-4 py-3">
        <p className="text-[12px] text-gray-500 italic leading-relaxed">
          “남에게 보이려 쓰는 돈이, 너를 가난하게 한다.” <span className="not-italic text-gray-400">— 도사</span>
        </p>
      </div>
    </div>
      {sheetOpen && <QuickRecord file={captured} draft={activeDraft} onClose={closeSheet} />}
    </>
  );
}
