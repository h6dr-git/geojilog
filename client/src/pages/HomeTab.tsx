// 집무실(홈) = "자르르의 방" — 자르르가 화면 주인공. 김집사가 말풍선으로 인사, 단일 기록 액션, 도사 한 줄.
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import Jarureu from "@/components/Jarureu";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import { dosaLineOfDay, jarureuLine } from "@/lib/voice";
import { useRef, useState } from "react";
import { Camera, ChevronRight, Check } from "lucide-react";

const WEEKLY_GOAL = 50000;
type Entry = { date: string; profit: number };

function recentWeekProfit(entries: Entry[]): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  return entries.filter((e) => new Date(e.date + "T00:00:00") >= cutoff).reduce((s, e) => s + (e.profit || 0), 0);
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
  job: CaptureJob | null;
  onOpenConfirm: () => void;
  onCompleteDraft: (d: Draft) => void;
};

export default function HomeTab({ onCapture, onOpenProfile, job, onOpenConfirm, onCompleteDraft }: Props) {
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
  const [jarLine, setJarLine] = useState<string | null>(null);
  const jarTimer = useRef<number | undefined>(undefined);
  const lastLine = useRef<string | null>(null);
  function pokeJarureu() {
    const line = jarureuLine(fedToday, lastLine.current); // 연속 같은 대사 방지
    lastLine.current = line;
    setJarLine(line);
    window.clearTimeout(jarTimer.current);
    jarTimer.current = window.setTimeout(() => setJarLine(null), 3200);
  }

  return (
    <div
      className="min-h-dvh max-w-lg mx-auto px-5 pb-24 flex flex-col"
      style={{ background: "radial-gradient(130% 52% at 50% 0%, rgba(224,169,46,0.10) 0%, rgba(16,185,129,0.05) 26%, rgba(250,248,243,0) 58%), #FAF8F3" }}
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

        <div className="relative mt-7 w-full max-w-[19.5rem]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-line rotate-45" aria-hidden="true" />
          <div className="relative bg-white border border-line rounded-card px-4 py-3 shadow-sm flex items-start gap-2.5">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center text-micro font-medium shrink-0"
              style={jarLine ? { background: "#f7e9c4", color: "#b07f1e" } : { background: "#eadfc6", color: "#a9863f" }}
            >
              {jarLine ? "자" : "집"}
            </span>
            <p key={jarLine ?? "butler"} className="text-body text-ink/85 leading-relaxed text-left animate-bubble-in">
              {jarLine ?? (analyzingJob ? `${josa(CHARACTER_NAME, "이", "가")} 사진을 살펴보는 중이에요…` : butlerGreeting())}
            </p>
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
          <Camera size={19} /> 사진으로 절약 기록하기
        </button>
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

      {/* 오늘의 장부 상태 — 안 A: 액수 없는 상태창 (민감정보 0 유지) */}
      <div className="mt-2.5 flex items-center justify-between bg-white border border-line rounded-card px-4 py-3">
        <p className="text-caption text-ink-soft flex items-center gap-1.5">
          {fedToday ? (
            <>
              <Check size={13} className="text-emerald-500" /> 오늘 절약 기록 완료
            </>
          ) : (
            "오늘은 아직 기록 전"
          )}
        </p>
        <div className="flex items-center gap-1.5" aria-label="이번 주 기록 현황">
          {weekDots.map((d) => (
            <span
              key={d.ds}
              className={`rounded-full transition-colors ${
                d.isToday ? "w-2 h-2 ring-2 ring-emerald-200" : "w-1.5 h-1.5"
              } ${d.has ? "bg-emerald-400" : d.future ? "bg-line/50" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      {/* 도사 한 마디 */}
      <div className="mt-10">
        <div className="relative bg-butler border border-butler-line rounded-card px-5 py-5 overflow-hidden">
          <span className="absolute -top-3 right-3 text-[68px] leading-none font-serif text-gold/20 select-none" aria-hidden="true">”</span>
          <p className="text-micro text-gold mb-2 tracking-wide font-medium">도사의 오늘 한 마디</p>
          <p className="text-body italic leading-relaxed relative" style={{ color: "#5c5647" }}>{dosaLineOfDay()}</p>
        </div>
      </div>
    </div>
  );
}
