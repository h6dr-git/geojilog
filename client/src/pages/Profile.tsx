// 서재 v2 — "김집사가 정리해 둔 보고서" 서가. (2026-06-10 무너뜨리고 재출발)
// 원칙: 단일 시각 언어(보고서 카드 양식의 반복) = 정갈함. 서재는 2차 생산지(통계·콘텐츠),
//       원본 관리는 장부(상세 시트)가 전담. 톤·개연성을 해치는 것은 두지 않는다.
// 보류(배선 해제, 코드 보존): 이달의 카드 꾸미기(AlbumKit) → #23 카드 스킨 프로젝트에서 명분 있게 재진입.
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { won } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import WeeklyWrapped from "@/components/WeeklyWrapped";
import SpeakerBadge from "@/components/SpeakerBadge";
import { SavingsEntry, fmt } from "@/lib/ledger";
import { ChevronRight } from "lucide-react";

function startOfRecentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}
function butlerSettlement(weekCount: number): string {
  if (weekCount === 0) return "이번 주는 아직 조용하군요.";
  return `이번 주 ${weekCount}건을 정리해 두었습니다.`;
}

// 보고서 카드 — 서재의 단일 양식 (주간·월간이 같은 형식으로 반복된다)
function ReportCard({
  label,
  hero,
  children,
  onClick,
  footnote,
}: {
  label: string;
  hero: string;
  children?: React.ReactNode;
  onClick?: () => void;
  footnote?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full text-left bg-butler border border-butler-line rounded-card p-5 mb-3 ${
        onClick ? "active:scale-[0.99] active:opacity-90 transition-all" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <SpeakerBadge speaker="butler" size={22} />
          <p className="text-micro text-gold tracking-wide font-medium">{label}</p>
        </div>
        {onClick && <ChevronRight size={15} style={{ color: "#cbb98c" }} />}
      </div>
      <p className="font-mono text-hero font-bold text-emerald-500 tabular-nums leading-tight">{hero}</p>
      {children}
      {footnote && (
        <p className="text-caption mt-2.5" style={{ color: "#5c5647" }}>{footnote}</p>
      )}
    </Tag>
  );
}

export default function Profile({ onOpenWeekly }: { onOpenWeekly: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });

  const list = entries as SavingsEntry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;

  // 주간 보고 (최근 7일)
  const weekStart = startOfRecentWeek();
  const weekList = list.filter((e) => new Date(e.date + "T00:00:00") >= weekStart);
  const weekProfit = weekList.reduce((s, e) => s + (e.profit || 0), 0);
  const weekCount = weekList.length;

  // 월간 보고 (이번 달 + 지난달 같은 기간 대비)
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth = now.getDate();

  const monthList = useMemo(() => list.filter((e) => e.date.startsWith(ym)), [list, ym]);
  const monthTotal = monthList.reduce((s, e) => s + e.profit, 0);
  // 지난달 '같은 기간'(1일~오늘 일자)과 비교 — 공정한 추이
  const prevSamePeriod = useMemo(
    () => list.filter((e) => e.date.startsWith(prevYm) && Number(e.date.slice(8, 10)) <= dayOfMonth),
    [list, prevYm, dayOfMonth]
  );
  const prevTotal = prevSamePeriod.reduce((s, e) => s + e.profit, 0);
  const diff = monthTotal - prevTotal;

  const monthByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthList.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + e.profit; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthList]);

  const [showWrapped, setShowWrapped] = useState(false);

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 pt-12 pb-24 bg-cream">
      <header className="pb-5">
        <p className="text-title font-semibold text-ink">서재</p>
        <p className="text-caption text-ink-soft mt-0.5">김집사가 정리해 둔 보고서</p>
      </header>

      {count === 0 ? (
        /* 빈 서재 */
        <div className="text-center py-16">
          <p className="text-body text-ink-soft leading-relaxed">
            아직 보고서가 없습니다.<br />
            첫 기록이 쌓이면 김집사가 정리해 올립니다.
          </p>
        </div>
      ) : (
        <>
          {/* 주간 보고 — 탭하면 브리핑(Wrapped) */}
          <ReportCard
            label="주간 보고"
            hero={`+${won(weekProfit)}`}
            onClick={() => (weekCount > 0 ? setShowWrapped(true) : onOpenWeekly())}
            footnote={butlerSettlement(weekCount)}
          />

          {/* 월간 보고 — 카테고리 구성 + 지난달 같은 기간 대비 */}
          <ReportCard
            label={`${now.getMonth() + 1}월 보고`}
            hero={`+₩${fmt(monthTotal)}`}
            footnote={
              prevSamePeriod.length > 0 || prevTotal > 0
                ? diff >= 0
                  ? `지난달 같은 기간보다 ₩${fmt(Math.abs(diff))} 더 벌었습니다.`
                  : `지난달 같은 기간보다 ₩${fmt(Math.abs(diff))} 적습니다.`
                : `${monthList.length}건을 정리해 두었습니다.`
            }
          >
            {monthByCategory.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {monthByCategory.map(([cat, profit]) => {
                  const pct = monthTotal > 0 ? Math.round((profit / monthTotal) * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-caption mb-0.5">
                        <span style={{ color: "#5c5647" }}>{cat}</span>
                        <span className="tabular-nums" style={{ color: "#5c5647" }}>+₩{fmt(profit)} ({pct}%)</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#efe4cd" }}>
                        <div className="h-full bg-emerald-400/80 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ReportCard>

          {/* 총람 — 조용한 한 줄 */}
          <div className="flex items-center justify-between px-1 pt-2">
            <span className="text-caption text-ink-soft">지금까지</span>
            <span className="text-caption text-ink-soft tabular-nums">
              누적 <span className="font-mono font-semibold text-ink">+{won(total)}</span> · {count}건
            </span>
          </div>
        </>
      )}

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
    </div>
  );
}
