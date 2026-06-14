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

  return (
    <div
      className="min-h-dvh max-w-lg mx-auto px-5 pb-24 flex flex-col"
      style={{ background: lobbyBg() }}
    >
      <header className="pt-12 pb-2 flex items-center justify-between animate-fade-up">
        <div className="flex items-center gap-2.5">
          <div
            className="rounded-xl px-3.5 py-2"
            style={{
              background: "linear-gradient(145deg, #2f281c 0%, #1f1a12 100%)",
              border: "1px solid rgba(224,169,46,0.4)",
              boxShadow: "0 4px 16px rgba(26,26,23,0.2), 0 1px 0 rgba(224,169,46,0.15) inset",
            }}
          >
            <p className="text-micro font-bold tracking-wide" style={{ color: "#E0A92E" }}>{displayName} 절약사무소</p>
          </div>
          <span className="text-micro font-mono text-ink-faint tracking-[0.25em] uppercase">{APP_NAME}</span>
        </div>
        <LoginChip onClick={() => setShowAccount(true)} />
      </header>

      {/* ══ #62 사장님의 책상 — 벽(시간대 톤) 아래 책상면, 그 위에 쌀집이와 비품 ══ */}
      <div className="mt-7 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <div
          className="relative rounded-t-[24px] px-4 pt-6 pb-4 texture-paper"
          style={{
            background: "linear-gradient(180deg, #e2cfa8 0%, #d4bc8f 12%, #c9ae7e 100%)",
            boxShadow: "inset 0 3px 0 rgba(255,255,255,0.4), 0 -8px 24px rgba(120,90,40,0.12), 0 2px 0 rgba(120,90,40,0.08)",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-[4px] rounded-t-[24px]" style={{ background: "linear-gradient(90deg, transparent, rgba(120,90,40,0.3) 20%, rgba(120,90,40,0.3) 80%, transparent)" }} aria-hidden="true" />

          <div className="flex items-end justify-center gap-5">
            {/* 쌀집이 — 책상 위 계산기 (탭: 코드 → 월 수익 → 마스킹) */}
            <div
              className="relative cursor-pointer select-none transition-transform duration-150 active:scale-[0.95]"
              onClick={tapCalc}
            >
              <SsalCalc
                level={level}
                size={104}
                analyzing={!!analyzingJob}
                glow={calcStage === "code" && !!calcCode?.rare}
                display={
                  analyzingJob ? "······"
                  : calcStage === "code" && calcCode ? calcCode.code
                  : calcStage === "amount" ? `+${monthProfit.toLocaleString("ko-KR")}`
                  : "-----"
                }
              />
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-20 h-3 rounded-[50%] bg-black/15 blur-md" aria-hidden="true" />
            </div>

            {/* 비품 — 기록이 쌓일수록 책상이 풍성해진다 (investment) */}
            <div className="pb-1">
              <JarureuShelf score={score} highlightKey={newProp} rail={false} />
            </div>
          </div>

          {/* 디스플레이 캡션 — 코드 뜻(점등 동안) / 첫 리빌 힌트 */}
          <div className="h-5 mt-2 text-center">
            {calcStage === "code" && calcCode ? (
              <p key={calcCode.code} className="text-micro font-mono animate-bubble-in" style={{ color: calcCode.rare ? "#B07F1E" : "#6b5b3e" }}>
                {calcCode.rare ? "✨ " : ""}{calcCode.code} — {calcCode.meaning}
              </p>
            ) : !revealHintDone ? (
              <p className="text-micro font-mono animate-pulse" style={{ color: "#6b5b3e" }}>쌀집이를 탭해 보세요</p>
            ) : null}
          </div>
        </div>

        <div className="h-4 rounded-b-2xl" style={{ background: "linear-gradient(180deg, #a88c61 0%, #8a7048 60%, #7a6340 100%)", boxShadow: "0 4px 12px rgba(120,90,40,0.15)" }} aria-hidden="true" />
      </div>

      <button
        onClick={onGoRecords}
        className="relative mt-5 w-full text-left surface-paper texture-paper px-4 py-4 active:scale-[0.99] transition-transform animate-fade-up"
        style={{ transform: "rotate(-0.35deg)", animationDelay: "0.1s" }}
      >
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 rounded-sm" style={{ background: "rgba(224,169,46,0.32)", boxShadow: "0 1px 2px rgba(120,90,40,0.1)" }} aria-hidden="true" />
        <span className="flex items-center gap-2 mb-1.5">
          <SpeakerBadge speaker="cpa" size={20} />
          <span className="text-micro text-gold tracking-wide font-medium">{CPA_NAME}의 책상 메모</span>
          <ChevronRight size={12} className="text-ink-faint ml-auto" />
        </span>
        <p key={memoFlash ?? "memo"} className="text-body leading-relaxed animate-bubble-in" style={{ color: "#4a4437" }}>
          {memoFlash ?? intelDeskLine(entries as unknown as SavingsEntry[], fedToday)}
        </p>
        <span className="flex items-center justify-between mt-2.5">
          <span className="text-micro" style={{ color: "#8a7f63" }}>
            {fedToday ? "금일 계상 ✓" : "금일 계상 전"}
          </span>
          <span className="flex items-end gap-1.5" aria-label="이번 주 기록 현황">
            {weekDots.map((d) => (
              <span key={d.ds} className="flex flex-col items-center gap-1">
                <span
                  className={`rounded-full transition-colors ${
                    d.isToday ? "w-2 h-2 ring-2 ring-emerald-200" : "w-1.5 h-1.5"
                  } ${d.has ? "bg-emerald-400" : d.future ? "bg-line/50" : "bg-line"}`}
                />
              </span>
            ))}
          </span>
        </span>
      </button>

      {/* 단일 액션 — 큰 기록 버튼 / 진행 상태칩 */}
      {analyzingJob ? (
        <div className="mt-7 flex items-center gap-3 surface-elevated p-4 animate-fade-up" style={{ borderColor: "rgba(16,185,129,0.2)" }}>
          <img src={analyzingJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-emerald-100" />
          <div className="text-left">
            <p className="text-body font-medium text-emerald-700">회시생이 두드리고 있어요</p>
            <p className="text-micro text-emerald-600">잠시 둘러보고 계셔도 됩니다</p>
          </div>
        </div>
      ) : readyJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 surface-elevated p-3.5 text-left active:scale-[0.99] transition-transform animate-fade-up" style={{ borderColor: "rgba(16,185,129,0.25)" }}>
          <img src={readyJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-emerald-100" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-ink truncate">{readyJob.data.title || "분석 완료"}</p>
            <p className="text-micro text-emerald-600 flex items-center gap-0.5"><Check size={12} /> 분석 완료 · 확인하고 저장</p>
          </div>
          <ChevronRight size={16} className="text-emerald-400 shrink-0" />
        </button>
      ) : dupJob ? (
        <div className="mt-7 w-full border border-amber-200 bg-amber-50 rounded-card p-3 shadow-sm">
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
            <button onClick={onDismissDup} className="flex-1 py-2 text-caption text-ink-soft border border-amber-200 rounded-lg active:bg-amber-100 transition-colors">
              괜찮아요, 안 올릴게요
            </button>
            <button onClick={onIgnoreDup} className="flex-1 py-2 text-caption font-medium text-amber-800 border border-amber-300 bg-white rounded-lg active:bg-amber-100 transition-colors">
              그래도 기록
            </button>
          </div>
        </div>
      ) : errorJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 border border-line bg-white rounded-card p-3 text-left shadow-sm active:bg-cream transition-colors">
          <img src={errorJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-ink">분석을 못 했어요</p>
            <p className="text-micro text-ink-soft">탭해서 직접 입력하기</p>
          </div>
          <ChevronRight size={16} className="text-ink-faint shrink-0" />
        </button>
      ) : null /* 기록 버튼 없음 — 기록은 장부에서 (인터페이스 철학) */}

      {topDraft && (
        <button onClick={() => onCompleteDraft(topDraft)} className="mt-2.5 w-full flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-card px-3.5 py-3 text-left active:bg-amber-100 transition-colors">
          <img src={topDraft.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-amber-800">아직 안 끝낸 기록 {drafts.length}개</p>
            <p className="text-micro text-amber-600 truncate">탭해서 마저 채우기</p>
          </div>
          <ChevronRight size={16} className="text-amber-400 shrink-0" />
        </button>
      )}


      {/* (F7, 2026-06-12) '이번 달 수익' 카드 제거 — 월 수익 표시면은 쌀집이 디스플레이가 유일 */}

      {/* #40 — 설치 유도 (미설치 + 미해제일 때만, 조용한 한 줄) */}
      {!standalone && !installDismissed && (
        <div className="mt-2.5 flex items-center gap-2 surface-paper px-4 py-3.5">
          <button onClick={handleInstall} className="flex-1 text-left active:opacity-80 transition-opacity">
            <p className="text-caption font-medium" style={{ color: "#5c5647" }}>홈 화면에 거지로그를 두세요</p>
            <p className="text-micro" style={{ color: "#a9863f" }}>앱처럼 열리고, 회시생의 저녁 보고도 받을 수 있어요 — 탭해서 설치</p>
          </button>
          <button onClick={dismissInstall} aria-label="닫기" className="w-6 h-6 flex items-center justify-center text-ink-faint active:text-ink-soft shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* 오늘의 쪽지 — 갱신 기준은 '기록 행동'(총 기록 수): 기록할 때마다 다음 쪽지로 넘어간다 */}
      {(() => {
        const note = deskNote((entries as Entry[]).length);
        const LABELS = { dosa: "고문의 자문", cpa: "회시생의 업무 팁", ssal: "쌀집이의 출력" } as const;
        return (
          <div className="mt-10 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="relative surface-paper texture-paper px-5 py-5 overflow-hidden">
              {note.speaker === "dosa" && (
                <span className="absolute -top-3 right-3 text-[68px] leading-none font-serif text-gold/20 select-none" aria-hidden="true">”</span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <SpeakerBadge speaker={note.speaker} size={20} />
                <p className="text-micro text-gold tracking-wide font-medium">{LABELS[note.speaker]}</p>
              </div>
              <p className={`text-body leading-relaxed relative ${note.speaker === "dosa" ? "italic" : ""}`} style={{ color: "#5c5647" }}>
                {note.text}
              </p>
            </div>
          </div>
        );
      })()}


      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      {showInstallGuide && <InstallGuideSheet onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
