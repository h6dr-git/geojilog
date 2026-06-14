// 집무실(홈) = "회시생의 사무소" — 진짜 홈. 기록 행위는 장부에서(인터페이스 철학, 피드백 #28).
// 말풍선 기본 화자는 쌀집이(숫자어) — 회시생 채널은 쪽지·결산·푸시. (#41 v3)
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { CPA_NAME } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import SsalCalc from "@/components/SsalCalc";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import type { SavingsEntry } from "@/lib/ledger";
import { ssalDisplay, type SsalCode } from "@/lib/voice";
import { intelDeskLine } from "@/lib/intel";
import JarureuShelf, { shelfScore, unlockedItems } from "@/components/JarureuShelf";
import SpeakerBadge from "@/components/SpeakerBadge";
import AccountSheet from "@/components/AccountSheet";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Check } from "lucide-react";

const WEEKLY_GOAL = 50000;
const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
type Entry = { date: string; profit: number; imageUrl?: string | null };

function recentWeekProfit(entries: Entry[]): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  return entries.filter((e) => new Date(e.date + "T00:00:00") >= cutoff).reduce((s, e) => s + (e.profit || 0), 0);
}

function homeBrief(fedToday: boolean): { title: string; cta: string } {
  if (!fedToday) {
    return { title: "오늘 할 일: 장부에 증빙 올리기", cta: "장부에서 기록하기" };
  }
  return { title: "금일 계상 완료", cta: "장부 보기" };
}

type Props = {
  onGoRecords: () => void;
  job: CaptureJob | null;
  onIgnoreDup?: () => void;
  onDismissDup?: () => void;
  onOpenConfirm: () => void;
  onCompleteDraft: (d: Draft) => void;
};

export default function HomeTab({ onGoRecords, job, onOpenConfirm, onCompleteDraft, onIgnoreDup, onDismissDup }: Props) {
  const [showAccount, setShowAccount] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const displayName = user?.name || "사장님";
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const level = Math.min(1, recentWeekProfit(entries as Entry[]) / WEEKLY_GOAL);
  const drafts = useDrafts();
  const topDraft = drafts[0];
  const analyzingJob = job && job.status === "analyzing" ? job : null;
  const readyJob = job && job.status === "ready" ? job : null;
  const errorJob = job && job.status === "error" ? job : null;
  const dupJob = job && job.status === "duplicate" ? job : null;
  const activeJob = analyzingJob || readyJob || errorJob || dupJob;

  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const fedToday = (entries as Entry[]).some((e) => e.date === today);
  const ym = today.slice(0, 7);
  const monthEntries = (entries as Entry[]).filter((e) => e.date.startsWith(ym));
  const monthProfit = monthEntries.reduce((s, e) => s + (e.profit || 0), 0);
  const score = shelfScore(monthEntries.length, monthProfit);
  const brief = homeBrief(fedToday);

  const [revealHintDone, setRevealHintDone] = useState<boolean>(() => {
    try { return localStorage.getItem("geo_reveal_hint_done") === "1"; } catch { return true; }
  });
  function markRevealHintDone() {
    if (revealHintDone) return;
    setRevealHintDone(true);
    try { localStorage.setItem("geo_reveal_hint_done", "1"); } catch {}
  }

  const weekDots = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const mon = new Date(t);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const p2 = (n: number) => String(n).padStart(2, "0");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const ds = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      return {
        ds,
        has: (entries as Entry[]).some((e) => e.date === ds),
        isToday: d.getTime() === t.getTime(),
        future: d.getTime() > t.getTime(),
      };
    });
  })();

  type CalcStage = "idle" | "code" | "amount";
  const [calcStage, setCalcStage] = useState<CalcStage>("idle");
  const [calcCode, setCalcCode] = useState<(SsalCode & { rare: boolean }) | null>(null);
  const seqTimers = useRef<number[]>([]);
  const lastLine = useRef<string | null>(null);
  function clearSeq() { seqTimers.current.forEach((t) => window.clearTimeout(t)); seqTimers.current = []; }
  function tapCalc() {
    if (calcStage !== "idle") return;
    markRevealHintDone();
    const c = ssalDisplay(fedToday, lastLine.current);
    lastLine.current = c.code;
    setCalcCode(c);
    setCalcStage("code");
    clearSeq();
    const codeMs = c.rare ? 2600 : 1300;
    seqTimers.current.push(window.setTimeout(() => setCalcStage("amount"), codeMs));
    seqTimers.current.push(window.setTimeout(() => { setCalcStage("idle"); setCalcCode(null); }, codeMs + 3000));
  }
  useEffect(() => () => clearSeq(), []);

  const [newProp, setNewProp] = useState<string | null>(null);
  const [memoFlash, setMemoFlash] = useState<string | null>(null);
  const unlockedCount = unlockedItems(score).length;
  useEffect(() => {
    if (!isAuthenticated || monthEntries.length === 0) return;
    const KEY = `geojilog:shelf-seen:${ym}`;
    let seen = 0;
    try { seen = Number(localStorage.getItem(KEY) || "0"); } catch { /* 무시 */ }
    if (unlockedCount > seen) {
      try { localStorage.setItem(KEY, String(unlockedCount)); } catch { /* 무시 */ }
      if (seen > 0) {
        const newest = unlockedItems(score)[unlockedCount - 1];
        setNewProp(newest.key);
        window.setTimeout(() => setNewProp(null), 2600);
        setMemoFlash(`비품 추가 — ${newest.name}. 사무소가 좋아지는군요.`);
        window.setTimeout(() => setMemoFlash(null), 8000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount, isAuthenticated]);

  return (
    <div className="home-office page-shell">
      <header className="home-header">
        <p className="home-nameplate-compact">{displayName} 절약사무소</p>
        <LoginChip onClick={() => setShowAccount(true)} />
      </header>

      <div className="home-body">
        {activeJob ? (
          <section className="home-mission surface-elevated">
            {analyzingJob ? (
              <div className="home-status-row">
                <img src={analyzingJob.preview} alt="" className="home-status-thumb" />
                <div>
                  <p className="home-mission-title text-emerald-700">회시생이 분석 중입니다</p>
                  <p className="home-mission-body text-emerald-600">잠시 후 장부에서 확인하실 수 있습니다</p>
                </div>
              </div>
            ) : readyJob ? (
              <button type="button" onClick={onOpenConfirm} className="home-status-row w-full text-left">
                <img src={readyJob.preview} alt="" className="home-status-thumb" />
                <div className="flex-1 min-w-0">
                  <p className="home-mission-title truncate">{readyJob.data.title || "분석 완료"}</p>
                  <p className="home-mission-body text-emerald-600 flex items-center gap-0.5">
                    <Check size={12} /> 확인하고 저장하기
                  </p>
                </div>
                <ChevronRight size={16} className="text-emerald-400 shrink-0" />
              </button>
            ) : dupJob ? (
              <>
                <div className="home-status-row">
                  <img src={dupJob.preview} alt="" className="home-status-thumb" />
                  <div className="flex-1 min-w-0">
                    <p className="home-mission-title text-amber-800">이미 기록한 사진입니다</p>
                    <p className="home-mission-body text-amber-700 truncate">
                      {dupJob.dup.date.slice(5).replace("-", ".")} · {dupJob.dup.title}
                    </p>
                  </div>
                </div>
                <div className="home-dup-actions">
                  <button type="button" onClick={onDismissDup} className="home-dup-btn">닫기</button>
                  <button type="button" onClick={onIgnoreDup} className="home-dup-btn home-dup-btn--primary">그래도 기록</button>
                </div>
              </>
            ) : errorJob ? (
              <button type="button" onClick={onOpenConfirm} className="home-status-row w-full text-left">
                <img src={errorJob.preview} alt="" className="home-status-thumb" />
                <div className="flex-1 min-w-0">
                  <p className="home-mission-title">분석을 못 했습니다</p>
                  <p className="home-mission-body">탭해서 직접 입력하기</p>
                </div>
                <ChevronRight size={16} className="text-ink-faint shrink-0" />
              </button>
            ) : null}
          </section>
        ) : (
          <section className="home-mission surface-elevated">
            <div className="home-mission-head">
              <div className="home-mission-label">
                <SpeakerBadge speaker="cpa" size={18} />
                <span className="voice-label">오늘의 업무</span>
              </div>
              <div className="home-week-dots" aria-label="이번 주 기록 현황">
                {weekDots.map((d, i) => (
                  <span key={d.ds} className="home-week-dot-col">
                    <span className="home-week-dot-label">{WEEK_LABELS[i]}</span>
                    <span
                      className={`home-week-dot ${d.isToday ? "home-week-dot--today" : "home-week-dot--default"} ${
                        d.has ? "bg-emerald-400" : d.future ? "bg-line/50" : "bg-line"
                      }`}
                    />
                  </span>
                ))}
              </div>
            </div>
            <p className="home-mission-title">{brief.title}</p>
            <p key={memoFlash ?? "memo"} className="home-mission-body">
              {memoFlash ?? intelDeskLine(entries as unknown as SavingsEntry[], fedToday)}
            </p>
            <button type="button" onClick={onGoRecords} className="btn-primary home-mission-cta">
              {brief.cta}
              <ChevronRight size={14} />
            </button>
            {topDraft && (
              <button
                type="button"
                onClick={() => onCompleteDraft(topDraft)}
                className="home-draft-link"
              >
                아직 안 끝낸 기록 {drafts.length}개 · 마저 채우기
                <ChevronRight size={14} />
              </button>
            )}
          </section>
        )}

        <section className="home-calc-zone">
          <p className="home-calc-label">이번 달 수익 · 탭하면 확인</p>
          <div className="home-calc-wrap" onClick={tapCalc}>
            <SsalCalc
              level={level}
              size={96}
              analyzing={!!analyzingJob}
              glow={calcStage === "code" && !!calcCode?.rare}
              display={
                analyzingJob ? "······"
                : calcStage === "code" && calcCode ? calcCode.code
                : calcStage === "amount" ? `+${monthProfit.toLocaleString("ko-KR")}`
                : "-----"
              }
            />
          </div>
          <div className="home-calc-caption">
            {calcStage === "code" && calcCode ? (
              <p key={calcCode.code} className="text-micro font-mono" style={{ color: calcCode.rare ? "#B07F1E" : "#6b5b3e" }}>
                {calcCode.rare ? "✨ " : ""}{calcCode.code} — {calcCode.meaning}
              </p>
            ) : !revealHintDone ? (
              <p className="text-micro text-ink-soft">쌀집이를 탭해 보세요</p>
            ) : null}
          </div>
          <JarureuShelf score={score} highlightKey={newProp} rail={false} />
        </section>
      </div>

      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
    </div>
  );
}
