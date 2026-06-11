// 집무실(홈) = "자르르의 방" — 진짜 홈. 기록 행위는 장부에서(인터페이스 철학, 피드백 #28).
// 말풍선은 자르르 전용(김집사 인사는 귀속 혼동으로 퇴장 — 김집사 채널은 쪽지·결산·푸시).
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { APP_NAME } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import Jarureu from "@/components/Jarureu";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import { deskNote, jarureuLine, jarureuIdleLine, type JarureuSay } from "@/lib/voice";
import JarureuShelf, { shelfScore, unlockedItems } from "@/components/JarureuShelf";
import SpeakerBadge from "@/components/SpeakerBadge";
import AccountSheet from "@/components/AccountSheet";
import InstallGuideSheet from "@/components/InstallGuideSheet";
import { useInstall } from "@/lib/install";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Check, Eye, EyeOff } from "lucide-react";

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
    h < 6 ? "rgba(74,90,110,0.12)"        // 새벽 — 푸른 어스름
    : h < 11 ? "rgba(224,169,46,0.13)"    // 아침 — 골드
    : h < 17 ? "rgba(16,185,129,0.08)"    // 낮 — 에메랄드
    : h < 21 ? "rgba(228,138,84,0.12)"    // 저녁 — 노을
    : "rgba(74,90,110,0.14)";             // 밤
  const mid = h >= 11 && h < 17 ? "rgba(224,169,46,0.05)" : "rgba(16,185,129,0.05)";
  return `radial-gradient(130% 52% at 50% 0%, ${top} 0%, ${mid} 26%, rgba(250,248,243,0) 58%), #FAF8F3`;
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
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const level = Math.min(1, recentWeekProfit(entries as Entry[]) / WEEKLY_GOAL);
  const drafts = useDrafts();
  const topDraft = drafts[0];
  const analyzingJob = job && job.status === "analyzing" ? job : null;
  const readyJob = job && job.status === "ready" ? job : null;
  const errorJob = job && job.status === "error" ? job : null;
  const dupJob = job && job.status === "duplicate" ? job : null; // #48

  // 자르르 말풍선 — 탭하면 김집사 인사 대신 자르르가 한 마디(3.2초). 오늘 기록 여부로 톤이 갈린다.
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
  const [revealed, setRevealed] = useState(false);
  const revealTimer = useRef<number | undefined>(undefined);
  function toggleReveal() {
    window.clearTimeout(revealTimer.current);
    if (revealed) {
      setRevealed(false);
      return;
    }
    setRevealed(true);
    revealTimer.current = window.setTimeout(() => setRevealed(false), 3000);
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
  const [jarLine, setJarLine] = useState<JarureuSay | null>(null);
  const jarTimer = useRef<number | undefined>(undefined);
  const lastLine = useRef<string | null>(null);
  function say(line: JarureuSay, ms: number) {
    setJarLine(line);
    window.clearTimeout(jarTimer.current);
    jarTimer.current = window.setTimeout(() => setJarLine(null), ms);
  }
  function pokeJarureu() {
    if (jarLine?.rare) return; // 희귀 대사 표시 중엔 탭 잠금 — 연타로 넘어가지 않게(피드백)
    const line = jarureuLine(fedToday, lastLine.current); // 연속 같은 대사 방지
    lastLine.current = line.text;
    say(line, line.rare ? 8000 : 3200); // 희귀 대사는 넉넉히 + 타이머 바 표시
  }

  // 살림 해금 연출 — 새 소품이 생기면 자르르가 알리고 소품이 통통 튀며 등장 (월별 1회)
  const [newProp, setNewProp] = useState<string | null>(null);
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
        say({ text: `새 살림이 생겼어!! ${newest.name} 봐봐~`, rare: true }, 8000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount, isAuthenticated]);

  return (
    <div
      className="min-h-dvh max-w-lg mx-auto px-5 pb-24 flex flex-col"
      style={{ background: lobbyBg() }}
    >
      <header className="pt-12 pb-2 flex items-center justify-between">
        <p className="text-caption font-mono text-ink-soft tracking-wider">{APP_NAME}</p>
        <LoginChip onClick={() => setShowAccount(true)} />
      </header>

      {/* 자르르 주인공 + 김집사 말풍선 인사 */}
      <div className="flex flex-col items-center mt-10">
        <div className="relative" onClick={pokeJarureu}>
          <Jarureu level={level} size={156} analyzing={!!analyzingJob} />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-24 h-3.5 rounded-[50%] bg-black/10 blur-md" aria-hidden="true" />
        </div>

        {/* 살림 선반 — 기록이 쌓일수록 소품이 늘어난다 (숫자 미표기) */}
        <div className="mt-3">
          <JarureuShelf score={score} highlightKey={newProp} />
        </div>

        <div className="relative mt-7 w-full max-w-[19.5rem]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-line rotate-45" aria-hidden="true" />
          <div
            className="relative border rounded-card px-4 py-3 shadow-sm flex items-start gap-2.5 transition-colors overflow-hidden"
            style={jarLine?.rare ? { background: "#FFFBEF", borderColor: "#E0A92E" } : { background: "#ffffff", borderColor: "#EFE9DC" }}
          >
            {/* 희귀 잔여시간 바 — 사라지기 전을 시각적으로 알림 */}
            {jarLine?.rare && (
              <span
                key={jarLine.text + "-bar"}
                className="absolute bottom-0 left-0 h-0.5 bg-gold/70"
                style={{ animation: "rare-bar 8s linear forwards" }}
                aria-hidden="true"
              />
            )}
            <SpeakerBadge speaker="jarureu" />
            <span className="flex-1 text-left">
              {jarLine?.rare && (
                <span key={jarLine.text + "-tag"} className="block text-micro text-gold font-medium mb-0.5 animate-bubble-in">
                  ✨ 희귀 한 마디
                </span>
              )}
              <p key={jarLine?.text ?? "idle"} className="text-body text-ink/85 leading-relaxed animate-bubble-in">
                {jarLine?.text ?? (analyzingJob ? "사진 보고 있어! 잠깐만 기다려줘~" : jarureuIdleLine())}
              </p>
            </span>
          </div>
        </div>
      </div>

      {/* 단일 액션 — 큰 기록 버튼 / 진행 상태칩 */}
      {analyzingJob ? (
        <div className="mt-7 flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-card p-3.5 shadow-sm">
          <img src={analyzingJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
          <div className="text-left">
            <p className="text-body font-medium text-emerald-700">자르르가 분석하고 있어요</p>
            <p className="text-micro text-emerald-600">잠시 둘러보고 계셔도 됩니다</p>
          </div>
        </div>
      ) : readyJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-card p-3 text-left shadow-sm active:bg-emerald-100 transition-colors">
          <img src={readyJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
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

      {/* 오늘의 장부 상태 — 안 A: 액수 없는 상태창 (민감정보 0 유지). 탭하면 장부로 */}
      <button
        onClick={onGoRecords}
        className="mt-2.5 flex items-center justify-between bg-white border border-line rounded-card px-4 py-3 w-full active:bg-line/30 transition-colors"
      >
        <span className="text-caption text-ink-soft flex items-center gap-1.5">
          {fedToday ? (
            <>
              <Check size={13} className="text-emerald-500" /> 오늘 수익 기록 완료
            </>
          ) : (
            "오늘 수익은 아직 기록 전"
          )}
        </span>
        <span className="flex items-end gap-1.5" aria-label="이번 주 기록 현황">
          {weekDots.map((d, i) => (
            <span key={d.ds} className="flex flex-col items-center gap-1">
              <span
                className={`rounded-full transition-colors ${
                  d.isToday ? "w-2 h-2 ring-2 ring-emerald-200" : "w-1.5 h-1.5"
                } ${d.has ? "bg-emerald-400" : d.future ? "bg-line/50" : "bg-line"}`}
              />
              <span
                className={d.isToday ? "text-emerald-500 font-medium" : "text-ink-faint"}
                style={{ fontSize: "9px", lineHeight: "10px" }}
              >
                {"월화수목금토일"[i]}
              </span>
            </span>
          ))}
        </span>
      </button>

      {/* 이번 달 수익 — 기본 마스킹·탭 투 리빌 (#36): 노출은 3초, 어깨너머엔 ●●●● */}
      <button
        onClick={toggleReveal}
        className="mt-2.5 w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3 active:bg-line/30 transition-colors"
      >
        <span className="text-caption text-ink-soft flex items-center gap-1.5">
          {revealed ? <Eye size={13} className="text-emerald-500" /> : <EyeOff size={13} className="text-ink-faint" />}
          이번 달 수익
        </span>
        <span
          key={revealed ? "on" : "off"}
          className={`font-mono text-body font-semibold tabular-nums animate-bubble-in ${revealed ? "text-emerald-600" : "text-ink-faint tracking-widest"}`}
        >
          {revealed ? `+₩${monthProfit.toLocaleString("ko-KR")}` : "₩ ●●●●●"}
        </span>
      </button>

      {/* #40 — 설치 유도 (미설치 + 미해제일 때만, 조용한 한 줄) */}
      {!standalone && !installDismissed && (
        <div className="mt-2.5 flex items-center gap-2 bg-butler border border-butler-line rounded-card px-4 py-3">
          <button onClick={handleInstall} className="flex-1 text-left active:opacity-80 transition-opacity">
            <p className="text-caption font-medium" style={{ color: "#5c5647" }}>홈 화면에 거지로그를 두세요</p>
            <p className="text-micro" style={{ color: "#a9863f" }}>앱처럼 열리고, 김집사의 저녁 보고도 받을 수 있어요 — 탭해서 설치</p>
          </button>
          <button onClick={dismissInstall} aria-label="닫기" className="w-6 h-6 flex items-center justify-center text-ink-faint active:text-ink-soft shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* 오늘의 쪽지 — 갱신 기준은 '기록 행동'(총 기록 수): 기록할 때마다 다음 쪽지로 넘어간다 */}
      {(() => {
        const note = deskNote((entries as Entry[]).length);
        const LABELS = { dosa: "도사의 한 마디", butler: "김집사의 집무 메모", jarureu: "자르르의 낙서" } as const;
        return (
          <div className="mt-10">
            <div className="relative bg-butler border border-butler-line rounded-card px-5 py-5 overflow-hidden">
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
