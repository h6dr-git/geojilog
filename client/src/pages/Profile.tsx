// 서재 — 회장님의 사적 콘텐츠 허브. (구 '회장님' 탭, 2026-06-10 구조 재편)
// 역할: 내 기록으로 만들어진 볼거리(주간 결산·월간 결산·이달의 카드·누적)를 꺼내 보는 곳.
// 계정 기능(닉네임·로그인·내보내기)은 집무실 프로필 칩 → 계정 시트로 이동.
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { won } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import WeeklyWrapped from "@/components/WeeklyWrapped";
import AlbumKit from "@/components/AlbumKit";
import { SavingsEntry, fmt } from "@/lib/ledger";
import { ChevronRight, Sparkles } from "lucide-react";

function startOfRecentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}
function butlerSettlement(weekCount: number): string {
  if (weekCount === 0) return "이번 주는 아직 조용하군요. 한 끼 남겨보시지요.";
  return `회장님, 이번 주 ${weekCount}끼를 알뜰히 지켜내셨습니다.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line rounded-card py-4 px-3 text-center">
      <p className="text-micro text-ink-soft">{label}</p>
      <p className="font-mono text-title font-semibold text-ink mt-1.5 tabular-nums">{value}</p>
    </div>
  );
}

export default function Profile({ onOpenWeekly }: { onOpenWeekly: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });

  const list = entries as SavingsEntry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;

  // 주간 (최근 7일)
  const weekStart = startOfRecentWeek();
  const weekList = list.filter((e) => new Date(e.date + "T00:00:00") >= weekStart);
  const weekProfit = weekList.reduce((s, e) => s + (e.profit || 0), 0);
  const weekCount = weekList.length;

  // 이번 달 (월간 결산 콘텐츠 — 구 사진 뷰에서 이사)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthList = useMemo(() => list.filter((e) => e.date.startsWith(ym)), [list, ym]);
  const monthTotal = monthList.reduce((s, e) => s + e.profit, 0);
  const monthPhotos = useMemo(() => monthList.filter((e) => e.imageUrl), [monthList]);
  const monthByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthList.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + e.profit; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthList]);

  const [showWrapped, setShowWrapped] = useState(false);
  const [showKit, setShowKit] = useState(false);

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 pt-12 pb-24 bg-cream">
      <header className="pb-5">
        <p className="text-title font-semibold text-ink">서재</p>
        <p className="text-caption text-ink-soft mt-0.5">기록이 만들어 준 볼거리들</p>
      </header>

      {/* 김집사의 주간 결산 — Wrapped 스토리 */}
      <button
        onClick={() => (weekCount > 0 ? setShowWrapped(true) : onOpenWeekly())}
        className="w-full text-left bg-butler border border-butler-line rounded-card p-5 mb-3 active:scale-[0.99] active:opacity-90 transition-all"
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-caption font-medium shrink-0" style={{ background: "#eadfc6", color: "#a9863f" }}>집</span>
          <p className="text-micro text-gold tracking-wide">김집사의 주간 결산</p>
        </div>
        <p className="text-micro text-ink-soft">이번 주 수익</p>
        <p className="font-mono text-hero font-bold text-emerald-500 tabular-nums leading-tight mt-1">+{won(weekProfit)}</p>
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-caption" style={{ color: "#5c5647" }}>{butlerSettlement(weekCount)}</p>
          <ChevronRight size={16} className="shrink-0" style={{ color: "#cbb98c" }} />
        </div>
      </button>

      {/* 월간 결산 — 카테고리 구성 (구 사진 뷰에서 이사) */}
      <div className="bg-white border border-line rounded-card p-5 mb-3">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-micro text-gold tracking-wide font-medium">{month + 1}월 결산</p>
          <p className="font-mono text-body font-bold text-emerald-500 tabular-nums">+₩{fmt(monthTotal)}</p>
        </div>
        {monthByCategory.length > 0 ? (
          <div className="space-y-1.5">
            {monthByCategory.map(([cat, profit]) => {
              const pct = monthTotal > 0 ? Math.round((profit / monthTotal) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-caption mb-0.5">
                    <span className="text-ink-soft">{cat}</span>
                    <span className="text-ink-soft tabular-nums">+₩{fmt(profit)} ({pct}%)</span>
                  </div>
                  <div className="h-1 bg-line rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-caption text-ink-faint text-center py-3">이 달엔 아직 기록이 없어요</p>
        )}
      </div>

      {/* 이달의 카드 — 꾸미기 (구 사진 뷰에서 이사, #23 카드 스킨 프로젝트의 집) */}
      <button
        onClick={() => setShowKit(true)}
        disabled={monthPhotos.length === 0}
        className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-3 active:bg-cream disabled:opacity-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-body text-ink">
          <Sparkles size={17} className="text-gold" /> 이달의 카드 꾸미기
        </span>
        <span className="flex items-center gap-1.5 text-caption text-ink-soft">
          사진 {monthPhotos.length}장
          <ChevronRight size={16} className="text-ink-faint" />
        </span>
      </button>

      {/* 누적 — 조용한 참고용 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="누적 수익" value={won(total)} />
        <Stat label="총 기록" value={`${count}건`} />
      </div>

      {showWrapped && (
        <WeeklyWrapped
          entries={list}
          onClose={() => setShowWrapped(false)}
          onGoDetail={() => {
            setShowWrapped(false);
            onOpenWeekly();
          }}
        />
      )}

      {showKit && (
        <AlbumKit
          year={year}
          month={month}
          photos={monthPhotos}
          count={monthList.length}
          total={monthTotal}
          onClose={() => setShowKit(false)}
        />
      )}
    </div>
  );
}
