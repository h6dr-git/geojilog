// 집무실(홈) = "자르르의 방" — 자르르가 화면 주인공. 김집사가 말풍선으로 인사, 단일 기록 액션, 도사 한 줄.
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import Jarureu from "@/components/Jarureu";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import { deskNoteOfDay, jarureuLine, type JarureuSay } from "@/lib/voice";
import JarureuShelf, { shelfScore, unlockedItems } from "@/components/JarureuShelf";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, Check } from "lucide-react";

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

function butlerGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "회장님, 깊은 밤까지 고생이 많으십니다.";
  if (h < 11) return "회장님, 좋은 아침입니다. 오늘 첫 끼도 알뜰히 챙기시지요.";
  if (h < 14) return "회장님, 점심은 드셨는지요. 한 끼 남겨두시겠습니까.";
  if (h < 18) return "회장님, 나른한 오후입니다. 한 끼만 기록해 두시지요.";
  if (h < 22) return "회장님, 오늘 하루도 무탈히 지켜내셨습니다.";
  return "회장님, 늦은 시각입니다. 오늘의 한 끼만 정리하고 쉬시지요.";
}

type Props = {
  onCapture: () => void;
  onOpenProfile: () => void;
  onGoRecords: () => void;
  job: CaptureJob | null;
  onOpenConfirm: () => void;
  onCompleteDraft: (d: Draft) => void;
};

export default function HomeTab({ onCapture, onOpenProfile, onGoRecords, job, onOpenConfirm, onCompleteDraft }: Props) {
  const { isAuthenticated } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const level = Math.min(1, recentWeekProfit(entries as Entry[]) / WEEKLY_GOAL);
  const drafts = useDrafts();
  const topDraft = drafts[0];
  const analyzingJob = job && job.status === "analyzing" ? job : null;
  const readyJob = job && job.status === "ready" ? job : null;
  const errorJob = job && job.status === "error" ? job : null;

  // 자르르 말풍선 — 탭하면 김집사 인사 대신 자르르가 한 마디(3.2초). 오늘 기록 여부로 톤이 갈린다.
  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const fedToday = (entries as Entry[]).some((e) => e.date === today);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  })();
  const fedYesterday = (entries as Entry[]).some((e) => e.date === yesterday);

  // 살림 선반(B′) — 복합 점수(건수+만원당 1점). 숫자는 화면에 안 보임.
  const totalProfit = (entries as Entry[]).reduce((s, e) => s + (e.profit || 0), 0);
  const score = shelfScore((entries as Entry[]).length, totalProfit);

  // 최근 사진 스트립(D — 절제 버전): 액수·제목 없이 동그란 썸네일만
  const recentPhotos = (entries as Entry[]).filter((e) => e.imageUrl).slice(0, 3);

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
    const line = jarureuLine(fedToday, lastLine.current); // 연속 같은 대사 방지
    lastLine.current = line.text;
    say(line, line.rare ? 6000 : 3200); // 희귀 대사는 캡처할 시간을 준다
  }

  // 살림 해금 연출 — 새 소품이 생기면 자르르가 알려준다 (기기당 1회)
  const unlockedCount = unlockedItems(score).length;
  useEffect(() => {
    if (!isAuthenticated || (entries as Entry[]).length === 0) return;
    const KEY = "geojilog:shelf-seen";
    let seen = 0;
    try { seen = Number(localStorage.getItem(KEY) || "0"); } catch { /* 무시 */ }
    if (unlockedCount > seen) {
      try { localStorage.setItem(KEY, String(unlockedCount)); } catch { /* 무시 */ }
      if (seen > 0) {
        const newest = unlockedItems(score)[unlockedCount - 1];
        say({ text: `새 살림이 생겼어!! ${newest.name} 봐봐~`, rare: true }, 6000);
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
        <LoginChip onClick={onOpenProfile} />
      </header>

      {/* 자르르 주인공 + 김집사 말풍선 인사 */}
      <div className="flex flex-col items-center mt-10">
        <div className="relative" onClick={pokeJarureu}>
          <Jarureu level={level} size={156} analyzing={!!analyzingJob} />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-24 h-3.5 rounded-[50%] bg-black/10 blur-md" aria-hidden="true" />
        </div>

        {/* 살림 선반 — 기록이 쌓일수록 소품이 늘어난다 (숫자 미표기) */}
        <div className="mt-3">
          <JarureuShelf score={score} />
        </div>

        <div className="relative mt-7 w-full max-w-[19.5rem]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-line rotate-45" aria-hidden="true" />
          <div
            className="relative border rounded-card px-4 py-3 shadow-sm flex items-start gap-2.5 transition-colors"
            style={jarLine?.rare ? { background: "#FFFBEF", borderColor: "#E0A92E" } : { background: "#ffffff", borderColor: "#EFE9DC" }}
          >
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center text-micro font-medium shrink-0"
              style={jarLine ? { background: "#f7e9c4", color: "#b07f1e" } : { background: "#eadfc6", color: "#a9863f" }}
            >
              {jarLine ? "자" : "집"}
            </span>
            <span className="flex-1 text-left">
              {jarLine?.rare && (
                <span key={jarLine.text + "-tag"} className="block text-micro text-gold font-medium mb-0.5 animate-bubble-in">
                  ✨ 희귀 한 마디
                </span>
              )}
              <p key={jarLine?.text ?? "butler"} className="text-body text-ink/85 leading-relaxed animate-bubble-in">
                {jarLine?.text ?? (analyzingJob ? `${josa(CHARACTER_NAME, "이", "가")} 사진을 살펴보는 중이에요…` : butlerGreeting())}
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
            <p className="text-body font-medium text-emerald-700">{CHARACTER_NAME}가 분석하고 있어요</p>
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
      ) : errorJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 border border-line bg-white rounded-card p-3 text-left shadow-sm active:bg-cream transition-colors">
          <img src={errorJob.preview} alt="" className="w-12 h-12 rounded-card object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-ink">분석을 못 했어요</p>
            <p className="text-micro text-ink-soft">탭해서 직접 입력하기</p>
          </div>
          <ChevronRight size={16} className="text-ink-faint shrink-0" />
        </button>
      ) : (
        <button
          onClick={onCapture}
          className="mt-7 w-full text-white font-semibold py-4 rounded-card flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(180deg, #34d399 0%, #10b981 100%)", boxShadow: "0 10px 22px -8px rgba(16,185,129,0.55)" }}
        >
          <Camera size={19} /> 사진으로 수익 기록하기
        </button>
      )}

      {/* 어제 기록이 비었으면 — 조용한 한 줄 (EXIF 자동 날짜) */}
      {!fedYesterday && !analyzingJob && !readyJob && !errorJob && (
        <p className="mt-2 text-center text-micro text-ink-faint">
          어제 사진이 있다면 그냥 올려보세요 — 날짜는 자르르가 알아서 읽어요
        </p>
      )}

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

      {/* 오늘의 쪽지 — 화자 하루 로테이션(도사·김집사·자르르), 매일 다른 내용 */}
      {(() => {
        const note = deskNoteOfDay();
        const meta = {
          dosa: { label: "도사의 오늘 한 마디", badge: "道", badgeBg: "#efe4cd", badgeColor: "#a9863f", italic: true },
          butler: { label: "김집사의 집무 메모", badge: "집", badgeBg: "#eadfc6", badgeColor: "#a9863f", italic: false },
          jarureu: { label: "자르르의 낙서", badge: "자", badgeBg: "#f7e9c4", badgeColor: "#b07f1e", italic: false },
        }[note.speaker];
        return (
          <div className="mt-10">
            <div className="relative bg-butler border border-butler-line rounded-card px-5 py-5 overflow-hidden">
              {note.speaker === "dosa" && (
                <span className="absolute -top-3 right-3 text-[68px] leading-none font-serif text-gold/20 select-none" aria-hidden="true">”</span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-micro font-medium" style={{ background: meta.badgeBg, color: meta.badgeColor }}>
                  {meta.badge}
                </span>
                <p className="text-micro text-gold tracking-wide font-medium">{meta.label}</p>
              </div>
              <p className={`text-body leading-relaxed relative ${meta.italic ? "italic" : ""}`} style={{ color: "#5c5647" }}>
                {note.text}
              </p>
            </div>
          </div>
        );
      })()}

      {/* 최근 장부 — 사진 스트립(D 절제판): 액수·제목 없이 동그란 썸네일만, 탭하면 장부로 */}
      {recentPhotos.length >= 2 && (
        <button onClick={onGoRecords} className="mt-3 w-full flex items-center justify-between px-2 py-1.5 active:opacity-70 transition-opacity">
          <span className="text-micro text-ink-faint">최근 장부</span>
          <span className="flex items-center">
            <span className="flex -space-x-2.5">
              {recentPhotos.map((e, i) => (
                <img
                  key={i}
                  src={e.imageUrl!}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border-2"
                  style={{ borderColor: "#FAF8F3", zIndex: 3 - i }}
                />
              ))}
            </span>
            <ChevronRight size={13} className="text-ink-faint ml-1" />
          </span>
        </button>
      )}
    </div>
  );
}
