// 서재 v3 (#45) — "기간 대시보드 + 결산은 이벤트".
// 진단(2026-06-11): v2는 카드마다 행동이 달랐고(주간=스토리, 월간=토글, 총람=정적),
// 공유가 4스텝 스토리 안에 묻혀 있었다. 유사 앱 패턴(Apple Health Summary·토스 내 소비·Spotify Wrapped)에서:
//   ① 탭의 기본 = 즉시 읽히는 단일 보고서 (탭 없이 스크롤로 전부)
//   ② 시간 단위가 IA의 제1축 — [주간|월간|전체] 세그먼트 + ‹› 기간 이동
//   ③ 스토리(Wrapped)는 일상 동선이 아니라 이벤트 — 주말(일·월)에만 배너로 등장
//   ④ 공유는 직행 — '결산 카드' 버튼 → 시트(카드+스킨+캡처), 스토리 통과 불필요
import { useMemo, useState } from "react";
import { UNCLASSIFIED } from "@shared/incomeSources";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import WeeklyWrapped from "@/components/WeeklyWrapped";
import SpeakerBadge from "@/components/SpeakerBadge";
import ShareCardSheet from "@/components/ShareCardSheet";
import ShelfCardViewer, { type ShelfCard } from "@/components/ShelfCardViewer";
import { themeById } from "@/components/cardSkin";
import { SavingsEntry, fmt } from "@/lib/ledger";
import { cpaWeeklyComment, dosaLineOfDay } from "@/lib/voice";
import { dayOfWeekRhythm, weeklyTrend, monthlyTrend, monthHeatmap, allTimeRecords, cumulativeCurve } from "@/lib/stats";
import { WeekRhythm, TrendBars, MonthHeat, RecordsRow, CumulativeCurve } from "@/components/StatsBlocks";
import { ChevronLeft, ChevronRight, Sparkles, BookMarked } from "lucide-react";

type Period = "week" | "month" | "all";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mmdd = (s: string) => s.slice(5).replace("-", ".");

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Profile({ onOpenWeekly }: { onOpenWeekly: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const list = entries as SavingsEntry[];

  // ── 기간 축: 세그먼트 + 오프셋(0=현재, 1=이전…) ──
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const changePeriod = (p: Period) => { setPeriod(p); setOffset(0); };

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const range = useMemo(() => {
    if (period === "week") {
      const mon = mondayOf(today);
      mon.setDate(mon.getDate() - 7 * offset);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const endD = offset === 0 && today < sun ? today : sun;
      return {
        start: iso(mon), end: iso(endD),
        label: offset === 0 ? "이번 주" : `${mmdd(iso(mon))} ~ ${mmdd(iso(sun))}`,
        cardLabel: "거지로그 주간 결산",
        cardPeriod: `${mmdd(iso(mon))} – ${mmdd(iso(endD))}`,
        shelfKey: { periodType: "week" as const, startDate: iso(mon) },
      };
    }
    if (period === "month") {
      const m = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const isThisYear = m.getFullYear() === today.getFullYear();
      return {
        start: iso(m), end: iso(last),
        label: offset === 0 ? `${m.getMonth() + 1}월` : isThisYear ? `${m.getMonth() + 1}월` : `${m.getFullYear()}.${pad(m.getMonth() + 1)}`,
        cardLabel: `거지로그 ${m.getMonth() + 1}월 결산`,
        cardPeriod: `${m.getFullYear()}.${pad(m.getMonth() + 1)}`,
        shelfKey: { periodType: "month" as const, startDate: iso(m) },
      };
    }
    return { start: "0000-01-01", end: "9999-12-31", label: "전체", cardLabel: "거지로그 총결산", cardPeriod: "ALL TIME", shelfKey: null };
  }, [period, offset, today]);

  // ── 기간 데이터 ──
  const scoped = useMemo(
    () => list.filter((e) => e.date >= range.start && e.date <= range.end),
    [list, range.start, range.end]
  );
  const profit = scoped.reduce((s, e) => s + (e.profit || 0), 0);
  const count = scoped.length;
  const best = useMemo(
    () => (scoped.length ? scoped.reduce((a, b) => (b.profit > a.profit ? b : a)) : null),
    [scoped]
  );

  // 구성 — 수익원(기본) / 카테고리
  const [compBy, setCompBy] = useState<"source" | "category">("source");
  const composition = useMemo(() => {
    const map: Record<string, number> = {};
    scoped.forEach((e) => {
      const k = compBy === "source" ? (e.incomeSource ?? UNCLASSIFIED) : e.category;
      map[k] = (map[k] ?? 0) + e.profit;
    });
    return Object.entries(map).sort((a, b) =>
      a[0] === UNCLASSIFIED ? 1 : b[0] === UNCLASSIFIED ? -1 : b[1] - a[1]
    );
  }, [scoped, compBy]);
  const topSource = useMemo(() => {
    const m: Record<string, number> = {};
    scoped.forEach((e) => { if (e.incomeSource) m[e.incomeSource] = (m[e.incomeSource] ?? 0) + e.profit; });
    const arr = Object.entries(m).sort((a, b) => b[1] - a[1]);
    return arr[0] ? { name: arr[0][0], profit: arr[0][1] } : null;
  }, [scoped]);

  // 비교 한 줄 — 이번 달일 때만 지난달 같은 기간 (공정 비교)
  const monthCompare = useMemo(() => {
    if (period !== "month" || offset !== 0) return null;
    const dayOfMonth = today.getDate();
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevYm = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
    const prevList = list.filter((e) => e.date.startsWith(prevYm) && Number(e.date.slice(8, 10)) <= dayOfMonth);
    if (prevList.length === 0) return null;
    const prevTotal = prevList.reduce((s, e) => s + e.profit, 0);
    return profit - prevTotal;
  }, [period, offset, list, profit, today]);

  // 집사 코멘트 — 기간별
  const comment = useMemo(() => {
    if (count === 0) return period === "week" && offset === 0 ? "이번 주는 아직 조용하군요." : "이 기간엔 기록이 없습니다.";
    if (period === "week") return cpaWeeklyComment(count, profit);
    if (period === "month") return `${count}건을 정리해 두었습니다.`;
    return `지금까지 ${count}건, 전부 장부에 있습니다.`;
  }, [period, offset, count, profit]);

  // ── Wrapped 이벤트 배너 — 주말 결산 시점(일·월)에만, 이번 주 기록이 있을 때 ──
  const dow = new Date().getDay();
  const thisWeekCount = useMemo(() => {
    const mon = iso(mondayOf(today));
    return list.filter((e) => e.date >= mon && e.date <= iso(today)).length;
  }, [list, today]);
  const showBanner = (dow === 0 || dow === 1) && thisWeekCount > 0;

  // ── #51 통계 다원화 — 전부 클라 계산. 기간 탭별로 맞는 것만 보여 과밀을 피한다 ──
  const rhythm = useMemo(() => (period === "week" && offset === 0 ? dayOfWeekRhythm(list) : null), [period, offset, list]);
  const weekTrend = useMemo(
    () => (period === "week" && offset === 0 ? weeklyTrend(list).map((w) => ({ label: `${Number(w.start.slice(5, 7))}.${Number(w.start.slice(8, 10))}`, profit: w.profit, current: w.current })) : null),
    [period, offset, list]
  );
  const monthTrendData = useMemo(
    () => (period === "month" && offset === 0 ? monthlyTrend(list).map((mo) => ({ label: mo.label, profit: mo.profit, current: mo.current })) : null),
    [period, offset, list]
  );
  const heat = useMemo(
    () => (period === "month" ? monthHeatmap(list, range.start.slice(0, 7)) : null),
    [period, list, range.start]
  );
  const records = useMemo(() => (period === "all" ? allTimeRecords(list) : null), [period, list]);
  const curve = useMemo(() => (period === "all" ? cumulativeCurve(list) : null), [period, list]);

  const [showWrapped, setShowWrapped] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // ── #50 서가 — 소장된 결산 카드 (완결된 세계: 만든 카드는 앱 안에 남는다) ──
  const { data: shelf = [] } = trpc.reportCards.list.useQuery(undefined, { enabled: isAuthenticated });
  const [shelfCard, setShelfCard] = useState<ShelfCard | null>(null);
  const [briefingRange, setBriefingRange] = useState<{ start: string; end: string } | null>(null);

  const segBtn = (key: Period, label: string) => (
    <button
      key={key}
      onClick={() => changePeriod(key)}
      className={`flex-1 py-2 rounded-full text-caption font-medium transition-colors ${
        period === key ? "bg-ink text-white" : "text-ink-soft active:bg-line/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 pt-12 pb-24 bg-cream">
      <header className="pb-4">
        <p className="text-title font-semibold text-ink">서재</p>
        <p className="text-caption text-ink-soft mt-0.5">회시생이 정리해 둔 보고서</p>
      </header>

      {list.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-body text-ink-soft leading-relaxed">
            아직 보고서가 없습니다.<br />
            첫 기록이 쌓이면 회시생이 정리해 올립니다.
          </p>
        </div>
      ) : (
        <>
          {/* 주말 이벤트 — 결산 브리핑 (Wrapped 스토리 진입은 여기로만) */}
          {showBanner && (
            <button
              onClick={() => setShowWrapped(true)}
              className="w-full flex items-center gap-2.5 mb-4 px-4 py-3 rounded-card text-left active:scale-[0.99] transition-transform"
              style={{ background: "#16201A", border: "1px solid rgba(224,169,46,0.35)" }}
            >
              <Sparkles size={16} style={{ color: "#E0A92E" }} className="shrink-0" />
              <span className="flex-1 text-caption font-medium" style={{ color: "#F4EFE3" }}>
                주간 결산 브리핑이 도착했습니다
              </span>
              <ChevronRight size={14} style={{ color: "#E0A92E" }} className="shrink-0" />
            </button>
          )}

          {/* 기간 세그먼트 */}
          <div className="flex gap-1 p-1 bg-white border border-line rounded-full mb-3">
            {segBtn("week", "주간")}
            {segBtn("month", "월간")}
            {segBtn("all", "전체")}
          </div>

          {/* 기간 네비 — 전체에선 숨김 */}
          {period !== "all" && (
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setOffset((o) => o + 1)} aria-label="이전 기간" className="min-w-[40px] min-h-[36px] flex items-center justify-center rounded-lg text-ink-soft active:bg-line/60 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <p className="text-body font-medium text-ink">{range.label}</p>
              <button
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                aria-label="다음 기간"
                className="min-w-[40px] min-h-[36px] flex items-center justify-center rounded-lg text-ink-soft active:bg-line/60 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── 단일 보고서 — 탭 없이 스크롤로 전부 읽힌다 ── */}
          <div className="bg-butler border border-butler-line rounded-card p-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <SpeakerBadge speaker="cpa" size={22} />
                <p className="text-micro text-gold tracking-wide font-medium">
                  {period === "week" ? "주간 보고" : period === "month" ? "월간 보고" : "총람"}
                </p>
              </div>
              {period === "week" && offset === 0 && count > 0 && (
                <button onClick={onOpenWeekly} className="text-micro text-ink-soft underline-offset-2 active:text-ink flex items-center gap-0.5">
                  장부에서 보기 <ChevronRight size={11} />
                </button>
              )}
            </div>

            <p className="font-mono text-hero font-bold text-emerald-500 tabular-nums leading-tight">+₩{fmt(profit)}</p>
            <p className="text-caption mt-1" style={{ color: "#5c5647" }}>
              {count}건
              {monthCompare != null && (
                <> · 지난달 같은 기간보다 {monthCompare >= 0 ? `₩${fmt(Math.abs(monthCompare))} 더 벌었습니다` : `₩${fmt(Math.abs(monthCompare))} 적습니다`}</>
              )}
            </p>

            {/* #51 — 누적 우상향 곡선 (전체 탭의 얼굴) */}
            {curve && curve.length > 1 && (
              <div className="mt-4">
                <CumulativeCurve points={curve} />
              </div>
            )}

            {/* 구성 — 수익원(기본)/카테고리 */}
            {count > 0 && (
              <div className="mt-4">
                <div className="flex gap-1 mb-2.5">
                  {([["source", "수익원"], ["category", "카테고리"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCompBy(key)}
                      className="px-2.5 py-1 rounded-full text-micro transition-colors"
                      style={
                        compBy === key
                          ? { background: "#5c5647", color: "#F4EFE3" }
                          : { background: "#efe4cd", color: "#8a7f63" }
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {composition.map(([name, p]) => {
                    const pct = profit > 0 ? Math.round((p / profit) * 100) : 0;
                    const dim = name === UNCLASSIFIED;
                    return (
                      <div key={name} style={dim ? { opacity: 0.55 } : undefined}>
                        <div className="flex justify-between text-caption mb-0.5">
                          <span style={{ color: "#5c5647" }}>{name}</span>
                          <span className="tabular-nums" style={{ color: "#5c5647" }}>+₩{fmt(p)} ({pct}%)</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "#efe4cd" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: dim ? "#cdbfa0" : compBy === "source" ? "rgba(224,169,46,0.85)" : "rgba(52,211,153,0.8)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* #51 — 기간별 통계: 주간=요일 리듬+8주 추이 / 월간=히트맵+6개월 추이 / 전체=기록 지표 */}
            {rhythm && rhythm.some((r) => r.avg > 0) && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid #efe4cd" }}>
                <WeekRhythm data={rhythm} />
              </div>
            )}
            {weekTrend && weekTrend.some((w) => w.profit > 0) && (
              <div className="mt-4">
                <TrendBars title="최근 8주 추이" data={weekTrend} />
              </div>
            )}
            {heat && heat.some((h) => h.profit > 0) && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid #efe4cd" }}>
                <MonthHeat ym={range.start.slice(0, 7)} data={heat} />
              </div>
            )}
            {monthTrendData && monthTrendData.some((m2) => m2.profit > 0) && (
              <div className="mt-4">
                <TrendBars title="최근 6개월 추이" data={monthTrendData} />
              </div>
            )}
            {records && count > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid #efe4cd" }}>
                <RecordsRow avgPerEntry={records.avgPerEntry} bestWeek={records.bestWeek} longestStreak={records.longestStreak} />
              </div>
            )}

            {/* 최고의 한 수 */}
            {best && best.profit > 0 && (
              <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #efe4cd" }}>
                {best.imageUrl
                  ? <img src={best.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-xl shrink-0" style={{ background: "#efe4cd" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-micro" style={{ color: "#8a7f63" }}>최고의 한 수</p>
                  <p className="text-body font-medium text-ink truncate">{best.title}</p>
                </div>
                <p className="text-body font-mono font-semibold text-emerald-600 tabular-nums shrink-0">+₩{fmt(best.profit)}</p>
              </div>
            )}

            {/* 회시생 코멘트 */}
            <p className="text-caption mt-4" style={{ color: "#5c5647" }}>{comment}</p>
          </div>

          {/* 결산 카드 — 만들어 서가에 소장 (#50 완결된 세계) */}
          {count > 0 && period !== "all" && (
            <button
              onClick={() => setShowShare(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-card border border-line bg-white text-body text-ink font-medium active:bg-cream transition-colors"
            >
              <BookMarked size={15} className="text-gold" />
              결산 카드 만들기
            </button>
          )}

          {/* ── #50 서가 — 소장 카드들 ── */}
          {(shelf as ShelfCard[]).length > 0 && (
            <section className="mt-6">
              <p className="text-caption font-mono text-ink-soft tracking-widest uppercase mb-2 px-1">서가</p>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                {(shelf as ShelfCard[]).map((c) => {
                  const t = themeById(c.theme);
                  const d = new Date(c.startDate + "T00:00:00");
                  const lbl = c.periodType === "week" ? `${d.getMonth() + 1}.${d.getDate()}~ 주간` : `${d.getMonth() + 1}월`;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setShelfCard(c)}
                      className="shrink-0 w-24 rounded-xl px-3 py-3 text-left active:scale-95 transition-transform"
                      style={{ background: t.bg, border: `1px solid ${t.border}` }}
                    >
                      <p style={{ fontSize: "8px", letterSpacing: "2px", color: t.label }}>GEOJILOG</p>
                      <p className="text-caption font-medium mt-1.5" style={{ color: t.title }}>{lbl}</p>
                      <p className="text-micro mt-0.5" style={{ color: t.sub }}>{c.periodType === "week" ? "주간 결산" : "월간 결산"}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
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

      {/* #50 — 지난 주 브리핑 재생 (서가에서) */}
      {briefingRange && (
        <WeeklyWrapped
          entries={list}
          range={briefingRange}
          onClose={() => setBriefingRange(null)}
          onGoDetail={() => setBriefingRange(null)}
        />
      )}

      {/* #50 — 서가 카드 뷰어 */}
      {shelfCard && (
        <ShelfCardViewer
          card={shelfCard}
          entries={list}
          onClose={() => setShelfCard(null)}
          onPlayBriefing={(r) => {
            setShelfCard(null);
            setBriefingRange(r);
          }}
        />
      )}

      {showShare && range.shelfKey && (
        <ShareCardSheet
          label={range.cardLabel}
          period={range.cardPeriod}
          periodType={range.shelfKey.periodType}
          startDate={range.shelfKey.startDate}
          amount={profit}
          subline={`${count}${period === "week" ? "끼" : "건"} 기록${best && best.profit > 0 ? ` · 최고의 한 수 ${best.title}` : ""}`}
          topSource={topSource}
          comment={comment}
          quote={dosaLineOfDay()}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
