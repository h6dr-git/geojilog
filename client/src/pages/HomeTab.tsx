// 집무실(홈) = "회시생의 사무소" — 진짜 홈. 기록 행위는 장부에서(인터페이스 철학, 피드백 #28).
// 말풍선 기본 화자는 쌀집이(숫자어) — 회시생 채널은 쪽지·결산·푸시. (#41 v3)
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CPA_NAME } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import SsalCalc from "@/components/SsalCalc";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import type { SavingsEntry } from "@/lib/ledger";
import { deskNote, ssalDisplay, type SsalCode } from "@/lib/voice";
import { intelDeskLine } from "@/lib/intel";
import JarureuShelf, { shelfScore, unlockedItems } from "@/components/JarureuShelf";
import SpeakerBadge from "@/components/SpeakerBadge";
import AccountSheet from "@/components/AccountSheet";
import InstallGuideSheet from "@/components/InstallGuideSheet";
import { useInstall } from "@/lib/install";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
// 시간대별 로비 분위기 — 에셋 없이 상단 그라데이션 톤만 바뀐다 (집무실 안 B 라이트)
function lobbyBg(): string {
  const h = new Date().getHours();
  const top =
    h < 6 ? "rgba(74,90,110,0.14)"
    : h < 11 ? "rgba(224,169,46,0.16)"
    : h < 17 ? "rgba(16,185,129,0.10)"
    : h < 21 ? "rgba(228,138,84,0.14)"
    : "rgba(74,90,110,0.16)";
  const mid = h >= 11 && h < 17 ? "rgba(224,169,46,0.06)" : "rgba(16,185,129,0.06)";
  return `radial-gradient(ellipse 130% 55% at 50% -5%, ${top} 0%, ${mid} 28%, rgba(250,248,243,0) 62%), radial-gradient(ellipse 60% 30% at 90% 15%, rgba(224,169,46,0.04) 0%, transparent 50%), #FAF8F3`;
}
function lobbyGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "고요한 밤, 사무실 불만 켜 두었습니다";
  if (h < 11) return "아침 사무실 — 오늘도 차분히";
  if (h < 17) return "낮 사무실 — 기록은 장부에서";
  if (h < 21) return "저녁 사무실 — 하루를 정리할 시간";
  return "밤 사무실 — 내일을 위해";
}


type Props = {
  onGoRecords: () => void;
  job: CaptureJob | null;
  onIgnoreDup?: () => void; // #48 — 중복 경고에서 "그래도 기록"
  onDismissDup?: () => void; // #48 — 중복 경고 닫기
  onOpenConfirm: () => void;
  onCompleteDraft: (d: Draft) => void;
};

export default function HomeTab({ onGoRecords, job, onOpenConfirm, onCompleteDraft, onIgnoreDup, onDismissDup }: Props) {
  // 계정 시트 — 프로필 칩에서 (구조 재편: 계정 기능은 탭이 아니라 칩 뒤로)
  const [showAccount, setShowAccount] = useState(false);

  // #40 — 설치 유도: 미설치 환경에서만, 한 번 닫으면 다시 안 보임(계정 시트에 상시 입구)
  const { standalone, canPrompt, promptInstall } = useInstall();
  const [installDismissed, setInstallDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem("geojilog:install-dismissed") === "1"; } catch { return true; }
  });
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  function dismissInstall() {
    setInstallDismissed(true);
    try { localStorage.setItem("geojilog:install-dismissed", "1"); } catch { /* 무시 */ }
    // #40 2차 — 닫아도 어디서 다시 찾는지 알려준다
    toast("설치 안내는 위 프로필(이름) → '홈 화면에 추가'에 있어요", { duration: 3500 });
  }
  async function handleInstall() {
    if (canPrompt) {
      const ok = await promptInstall();
      if (ok) dismissInstall();
    } else {
      setShowInstallGuide(true);
    }
  }
  const { isAuthenticated, user } = useAuth();
  const displayName = user?.name || "사장님";
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const level = Math.min(1, recentWeekProfit(entries as Entry[]) / WEEKLY_GOAL);
  const drafts = useDrafts();
  const topDraft = drafts[0];
  const analyzingJob = job && job.status === "analyzing" ? job : null;
  const readyJob = job && job.status === "ready" ? job : null;
  const errorJob = job && job.status === "error" ? job : null;
  const dupJob = job && job.status === "duplicate" ? job : null; // #48

  // 쌀집이 말풍선 — 탭하면 숫자어 한 마디(3.2초). 오늘 기록 여부로 코드가 갈린다.
  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const fedToday = (entries as Entry[]).some((e) => e.date === today);
  // 살림 선반(B′) — '이달' 복합 점수(건수+만원당 1점). 매달 초기화(피드백), 숫자는 화면에 안 보임.
  const ym = today.slice(0, 7);
  const monthEntries = (entries as Entry[]).filter((e) => e.date.startsWith(ym));
  const monthProfit = monthEntries.reduce((s, e) => s + (e.profit || 0), 0);
  const score = shelfScore(monthEntries.length, monthProfit);

  // 이번 달 수익 — 탭 투 리빌(#36 확정): 기본 마스킹, 탭하면 3초 노출 후 다시 가림.
  // 동기부여(매일 보고 싶은 숫자)와 안전 로비(어깨너머 방어)의 절충 — 잔액 숨김은 핀테크 문법 그대로.
  const [revealHintDone, setRevealHintDone] = useState<boolean>(() => {
    try { return localStorage.getItem("geo_reveal_hint_done") === "1"; } catch { return true; }
  });
  function markRevealHintDone() {
    if (revealHintDone) return;
    setRevealHintDone(true);
    try { localStorage.setItem("geo_reveal_hint_done", "1"); } catch {}
  }


  // 이번 주(월~일) 기록 점 7개 — 돈 액수 없는 상태 표시 (집무실 안 A · 스트릭은 보류)
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
  // #62 — 디스플레이 시퀀스: 탭 → 숫자어 코드 점등(뜻 캡션) → 이번 달 수익 점등 → 마스킹.
  // 말풍선 폐지: 계산기는 디스플레이로 말한다 (치는 건 회시생이라는 설정 그대로 — 제4조 정합).
  type CalcStage = "idle" | "code" | "amount";
  const [calcStage, setCalcStage] = useState<CalcStage>("idle");
  const [calcCode, setCalcCode] = useState<(SsalCode & { rare: boolean }) | null>(null);
  const seqTimers = useRef<number[]>([]);
  const lastLine = useRef<string | null>(null);
  function clearSeq() { seqTimers.current.forEach((t) => window.clearTimeout(t)); seqTimers.current = []; }
  function tapCalc() {
    if (calcStage !== "idle") return; // 시퀀스 중 재탭 무시
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

  // 비품 해금 연출 — 새 비품이 생기면 메모에 한 줄 + 소품이 통통 (월별 1회)
  const [newProp, setNewProp] = useState<string | null>(null);
  const [memoFlash, setMemoFlash] = useState<string | null>(null);
  const unlockedCount = unlockedItems(score).length;
  useEffect(() => {
    if (!isAuthenticated || monthEntries.length === 0) return;
    const KEY = `geojilog:shelf-seen:${ym}`; // 월 단위 초기화와 함께 리셋
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

  const sideNote = deskNote((entries as Entry[]).length);
  const SIDE_LABELS = { dosa: "고문의 자문", cpa: "회시생의 업무 팁", ssal: "쌀집이의 출력" } as const;

  return (
    <div className="home-office" style={{ background: lobbyBg() }}>
      <div className="home-topbar animate-fade-up">
        <LoginChip onClick={() => setShowAccount(true)} />
      </div>

      <div className="home-hero animate-fade-up" style={{ animationDelay: "0.03s" }}>
        <div className="home-nameplate">
          <span className="home-nameplate-main">{displayName} 절약사무소</span>
          <span className="home-nameplate-app">{APP_NAME}</span>
        </div>
        <p className="home-greeting">{lobbyGreeting()}</p>
      </div>

      {/* ══ 사장님의 책상 — 방 프레임 안에 책상·쌀집이·비품·메모 ══ */}
      <div className="home-stage animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <div className="home-room">
          <div className="home-desk-surface texture-paper">
            <div className="home-desk-items">
              <div className="home-calc-wrap" onClick={tapCalc}>
                <SsalCalc
                  level={level}
                  size={118}
                  analyzing={!!analyzingJob}
                  glow={calcStage === "code" && !!calcCode?.rare}
                  display={
                    analyzingJob ? "······"
                    : calcStage === "code" && calcCode ? calcCode.code
                    : calcStage === "amount" ? `+${monthProfit.toLocaleString("ko-KR")}`
                    : "-----"
                  }
                />
                <div className="home-calc-shadow" aria-hidden="true" />
              </div>

              <div className="pb-1">
                <JarureuShelf score={score} highlightKey={newProp} rail={false} />
              </div>
            </div>

            <div className="home-calc-caption">
              {calcStage === "code" && calcCode ? (
                <p key={calcCode.code} className="text-micro font-mono animate-bubble-in" style={{ color: calcCode.rare ? "#B07F1E" : "#6b5b3e" }}>
                  {calcCode.rare ? "✨ " : ""}{calcCode.code} — {calcCode.meaning}
                </p>
              ) : !revealHintDone ? (
                <p className="text-micro font-mono animate-pulse" style={{ color: "#6b5b3e" }}>쌀집이를 탭해 보세요</p>
              ) : null}
            </div>
          </div>

          <div className="home-desk-edge" aria-hidden="true" />

          <div className="home-memo texture-paper">
            <span className="home-memo-tape" aria-hidden="true" />
            <div className="home-memo-head">
              <SpeakerBadge speaker="cpa" size={20} />
              <span className="voice-label">{CPA_NAME}의 책상 메모</span>
            </div>
            <p key={memoFlash ?? "memo"} className="home-memo-body animate-bubble-in">
              {memoFlash ?? intelDeskLine(entries as unknown as SavingsEntry[], fedToday)}
            </p>
            <div className="home-memo-foot">
              <span className="home-memo-status">
                {fedToday ? "금일 계상 ✓" : "금일 계상 전"}
              </span>
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
            <button type="button" onClick={onGoRecords} className="btn-primary home-memo-cta">
              장부 열기
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 진행 상태 · 초안 · 설치 안내 */}
      <div className="home-status animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {analyzingJob ? (
          <div className="home-status-chip home-status-chip--emerald">
            <img src={analyzingJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-emerald-100" />
            <div className="text-left">
              <p className="text-body font-medium text-emerald-700">회시생이 두드리고 있어요</p>
              <p className="text-micro text-emerald-600">잠시 둘러보고 계셔도 됩니다</p>
            </div>
          </div>
        ) : readyJob ? (
          <button type="button" onClick={onOpenConfirm} className="home-status-chip home-status-chip--emerald w-full">
            <img src={readyJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-emerald-100" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-body font-medium text-ink truncate">{readyJob.data.title || "분석 완료"}</p>
              <p className="text-micro text-emerald-600 flex items-center gap-0.5"><Check size={12} /> 분석 완료 · 확인하고 저장</p>
            </div>
            <ChevronRight size={16} className="text-emerald-400 shrink-0" />
          </button>
        ) : dupJob ? (
          <div className="home-status-chip--warn">
            <div className="flex items-center gap-3">
              <img src={dupJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-amber-800">이미 기록한 사진이에요</p>
                <p className="text-micro text-amber-700 truncate">
                  {dupJob.dup.date.slice(5).replace("-", ".")} · {dupJob.dup.title} · +₩{dupJob.dup.profit.toLocaleString("ko-KR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5">
              <button type="button" onClick={onDismissDup} className="flex-1 py-2 text-caption text-ink-soft border border-amber-200 rounded-lg active:bg-amber-100 transition-colors">
                괜찮아요, 안 올릴게요
              </button>
              <button type="button" onClick={onIgnoreDup} className="flex-1 py-2 text-caption font-medium text-amber-800 border border-amber-300 bg-white rounded-lg active:bg-amber-100 transition-colors">
                그래도 기록
              </button>
            </div>
          </div>
        ) : errorJob ? (
          <button type="button" onClick={onOpenConfirm} className="home-status-chip w-full">
            <img src={errorJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-body font-medium text-ink">분석을 못 했어요</p>
              <p className="text-micro text-ink-soft">탭해서 직접 입력하기</p>
            </div>
            <ChevronRight size={16} className="text-ink-faint shrink-0" />
          </button>
        ) : null /* 기록 버튼 없음 — 기록은 장부에서 (인터페이스 철학) */}

        {topDraft && (
          <button type="button" onClick={() => onCompleteDraft(topDraft)} className="home-status-chip home-status-chip--amber w-full">
            <img src={topDraft.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-body font-medium text-amber-800">아직 안 끝낸 기록 {drafts.length}개</p>
              <p className="text-micro text-amber-600 truncate">탭해서 마저 채우기</p>
            </div>
            <ChevronRight size={16} className="text-amber-400 shrink-0" />
          </button>
        )}

        {!standalone && !installDismissed && (
          <div className="home-install-banner">
            <button type="button" onClick={handleInstall} className="flex-1 text-left active:opacity-80 transition-opacity">
              <p className="text-caption font-medium" style={{ color: "#5c5647" }}>홈 화면에 거지로그를 두세요</p>
              <p className="text-micro" style={{ color: "#a9863f" }}>앱처럼 열리고, 회시생의 저녁 보고도 받을 수 있어요 — 탭해서 설치</p>
            </button>
            <button type="button" onClick={dismissInstall} aria-label="닫기" className="w-6 h-6 flex items-center justify-center text-ink-faint active:text-ink-soft shrink-0">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 오늘의 쪽지 — 갱신 기준은 '기록 행동'(총 기록 수) */}
      <div className="home-side-note animate-fade-up" style={{ animationDelay: "0.15s" }}>
        <span className="home-side-note-pin" aria-hidden="true" />
        {sideNote.speaker === "dosa" && (
          <span className="absolute -top-3 right-3 text-[68px] leading-none font-serif text-gold/20 select-none" aria-hidden="true">"</span>
        )}
        <div className="home-side-note-head">
          <SpeakerBadge speaker={sideNote.speaker} size={20} />
          <p className="voice-label">{SIDE_LABELS[sideNote.speaker]}</p>
        </div>
        <p className={`home-side-note-body ${sideNote.speaker === "dosa" ? "home-side-note-body--dosa" : ""}`}>
          {sideNote.text}
        </p>
      </div>

      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      {showInstallGuide && <InstallGuideSheet onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
