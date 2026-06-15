// 집무실(홈) = IP 무대 — 캐릭터·사무소 성장·기록 진입. 장부=유틸·목록.
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import LoginChip from "@/components/LoginChip";
import OfficeStage from "@/components/OfficeStage";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import type { SavingsEntry } from "@/lib/ledger";
import { deskNote, ssalDisplay, type SsalCode } from "@/lib/voice";
import { intelDeskLine } from "@/lib/intel";
import { shelfScore, unlockedItems } from "@/components/JarureuShelf";
import SpeakerBadge from "@/components/SpeakerBadge";
import AccountSheet from "@/components/AccountSheet";
import { IP_BEAT_LABELS, officeTagline } from "@/lib/officeIp";
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

type Props = {
  onGoRecords: () => void;
  onRecord: () => void;
  job: CaptureJob | null;
  onIgnoreDup?: () => void;
  onDismissDup?: () => void;
  onOpenConfirm: () => void;
  onCompleteDraft: (d: Draft) => void;
};

export default function HomeTab({ onGoRecords, onRecord, job, onOpenConfirm, onCompleteDraft, onIgnoreDup, onDismissDup }: Props) {
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
  const propCount = unlockedItems(score).length;
  const ipBeat = deskNote((entries as Entry[]).length);

  const profitDisplay = `+${monthProfit.toLocaleString("ko-KR")}`;

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

  type CalcStage = "profit" | "code";
  const [calcStage, setCalcStage] = useState<CalcStage>("profit");
  const [calcCode, setCalcCode] = useState<(SsalCode & { rare: boolean }) | null>(null);
  const seqTimers = useRef<number[]>([]);
  const lastLine = useRef<string | null>(null);
  function clearSeq() { seqTimers.current.forEach((t) => window.clearTimeout(t)); seqTimers.current = []; }
  function tapCalc() {
    if (calcStage !== "profit") return;
    const c = ssalDisplay(fedToday, lastLine.current);
    lastLine.current = c.code;
    setCalcCode(c);
    setCalcStage("code");
    clearSeq();
    const codeMs = c.rare ? 2600 : 1300;
    seqTimers.current.push(window.setTimeout(() => { setCalcStage("profit"); setCalcCode(null); }, codeMs));
  }
  useEffect(() => () => clearSeq(), []);

  const [newProp, setNewProp] = useState<string | null>(null);
  const [taglineFlash, setTaglineFlash] = useState<string | null>(null);
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
        setTaglineFlash(`새 비품 — ${newest.name}. 사무소가 풍성해졌습니다.`);
        window.setTimeout(() => setTaglineFlash(null), 8000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount, isAuthenticated]);

  const calcCaption = calcStage === "code" && calcCode ? (
    <p key={calcCode.code} className={`text-micro font-mono ${calcCode.rare ? "text-gold" : "text-ink-soft"}`}>
      {calcCode.rare ? "✨ " : ""}{calcCode.code} — {calcCode.meaning}
    </p>
  ) : null;

  return (
    <div className="home-office page-shell">
      <header className="home-header">
        <div className="home-nameplate-ip">
          <span className="home-nameplate-ip-main">{displayName} 절약사무소</span>
        </div>
        <LoginChip onClick={() => setShowAccount(true)} />
      </header>

      <div className="home-body">
        {activeJob && (
          <section className="home-job surface-elevated">
            {analyzingJob ? (
              <div className="home-status-row">
                <img src={analyzingJob.preview} alt="" className="home-status-thumb" />
                <div>
                  <p className="home-job-title text-emerald-700">회시생이 분석 중</p>
                  <p className="home-job-body text-emerald-600">잠시만 기다려 주세요</p>
                </div>
              </div>
            ) : readyJob ? (
              <button type="button" onClick={onOpenConfirm} className="home-status-row w-full text-left">
                <img src={readyJob.preview} alt="" className="home-status-thumb" />
                <div className="flex-1 min-w-0">
                  <p className="home-job-title truncate">{readyJob.data.title || "분석 완료"}</p>
                  <p className="home-job-body text-emerald-600 flex items-center gap-0.5">
                    <Check size={12} /> 확인하고 저장
                  </p>
                </div>
                <ChevronRight size={16} className="text-emerald-400 shrink-0" />
              </button>
            ) : dupJob ? (
              <>
                <div className="home-status-row">
                  <img src={dupJob.preview} alt="" className="home-status-thumb" />
                  <div className="flex-1 min-w-0">
                    <p className="home-job-title text-amber-800">이미 기록한 사진</p>
                    <p className="home-job-body text-amber-700 truncate">
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
                  <p className="home-job-title">분석 실패</p>
                  <p className="home-job-body">탭해서 직접 입력</p>
                </div>
                <ChevronRight size={16} className="text-ink-faint shrink-0" />
              </button>
            ) : null}
          </section>
        )}

        <OfficeStage
          tagline={taglineFlash ?? officeTagline(propCount)}
          level={level}
          analyzing={!!analyzingJob}
          glow={calcStage === "code" && !!calcCode?.rare}
          display={
            analyzingJob ? "······"
            : calcStage === "code" && calcCode ? calcCode.code
            : profitDisplay
          }
          onTapCalc={tapCalc}
          onRecord={onRecord}
          calcCaption={calcCaption}
          score={score}
          highlightKey={newProp}
        />

        <footer className="home-ip-footer">
          <div className="home-ip-beat">
            <div className="home-ip-beat-head">
              <SpeakerBadge speaker={ipBeat.speaker} size={18} />
              <span className="voice-label">{IP_BEAT_LABELS[ipBeat.speaker]}</span>
            </div>
            <p className={`home-ip-beat-text ${ipBeat.speaker === "dosa" ? "italic" : ipBeat.speaker === "ssal" ? "font-mono" : ""}`}>
              {ipBeat.text}
            </p>
          </div>

          {!activeJob && (
            <p className="home-cpa-whisper">
              <SpeakerBadge speaker="cpa" size={16} />
              <span>{intelDeskLine(entries as unknown as SavingsEntry[], fedToday)}</span>
            </p>
          )}

          <div className="home-ip-foot">
            <div className="home-week-dots" aria-label="이번 주 기록">
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
            <div className="home-ip-actions">
              {topDraft && (
                <button type="button" onClick={() => onCompleteDraft(topDraft)} className="home-link-btn">
                  미완 {drafts.length}
                </button>
              )}
              <button type="button" onClick={onGoRecords} className="home-link-btn home-link-btn--primary">
                장부로
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </footer>
      </div>

      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
    </div>
  );
}
