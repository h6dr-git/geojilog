// 집무실(홈) = "자르르의 방" — 자르르가 화면 주인공. 김집사가 말풍선으로 인사, 단일 기록 액션, 도사 한 줄.
// 안전 로비: 수익·통계·결산·내 기록(숫자) 절대 노출 금지.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import Jarureu from "@/components/Jarureu";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
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
const DOSA_LINES = [
  "남에게 보이려 쓰는 돈이, 너를 가난하게 한다.",
  "아낀 한 끼는 사라지지 않는다. 너의 내일로 갈 뿐.",
  "가벼운 지갑이 부끄러운 게 아니라, 빈 마음이 부끄러운 것이다.",
  "오늘 참은 작은 것이, 내일의 큰 자유가 된다.",
  "쓰지 않은 돈은, 가장 조용한 효도다.",
  "검소함은 궁상이 아니라, 제 삶의 주인이 되는 길이다.",
  "필요와 욕심을 가릴 줄 아는 자가, 진짜 부자다.",
];
function dosaLineOfDay(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return DOSA_LINES[day % DOSA_LINES.length];
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

  return (
    <div
      className="min-h-screen max-w-lg mx-auto px-5 pb-28 flex flex-col"
      style={{ background: "radial-gradient(130% 52% at 50% 0%, rgba(224,169,46,0.10) 0%, rgba(16,185,129,0.05) 26%, rgba(250,248,243,0) 58%), #FAF8F3" }}
    >
      <header className="pt-12 pb-2 flex items-center justify-between">
        <p className="text-caption font-mono text-ink-soft tracking-wider">{APP_NAME}</p>
        <LoginChip onClick={onOpenProfile} />
      </header>

      {/* 자르르 주인공 + 김집사 말풍선 인사 */}
      <div className="flex flex-col items-center mt-10">
        <div className="relative">
          <Jarureu level={level} size={156} analyzing={!!analyzingJob} />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-24 h-3.5 rounded-[50%] bg-black/10 blur-md" aria-hidden="true" />
        </div>

        <div className="relative mt-7 w-full max-w-[19.5rem]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-line rotate-45" aria-hidden="true" />
          <div className="relative bg-white border border-line rounded-card px-4 py-3 shadow-sm flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-micro font-medium shrink-0" style={{ background: "#eadfc6", color: "#a9863f" }}>집</span>
            <p className="text-body text-ink/85 leading-relaxed text-left">
              {analyzingJob ? `${josa(CHARACTER_NAME, "이", "가")} 사진을 살펴보는 중이에요…` : butlerGreeting()}
            </p>
          </div>
        </div>
      </div>

      {/* 단일 액션 — 큰 기록 버튼 / 진행 상태칩 */}
      {analyzingJob ? (
        <div className="mt-7 flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-card p-3.5 shadow-sm">
          <img src={analyzingJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
          <div className="text-left">
            <p className="text-body font-medium text-emerald-700">{CHARACTER_NAME}가 분석하고 있어요</p>
            <p className="text-micro text-emerald-600">잠시 둘러보고 계셔도 됩니다</p>
          </div>
        </div>
      ) : readyJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-card p-3 text-left shadow-sm active:bg-emerald-100 transition-colors">
          <img src={readyJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-ink truncate">{readyJob.data.title || "분석 완료"}</p>
            <p className="text-micro text-emerald-600 flex items-center gap-0.5"><Check size={12} /> 분석 완료 · 확인하고 저장</p>
          </div>
          <ChevronRight size={16} className="text-emerald-400 shrink-0" />
        </button>
      ) : errorJob ? (
        <button onClick={onOpenConfirm} className="mt-7 w-full flex items-center gap-3 border border-line bg-white rounded-card p-3 text-left shadow-sm active:bg-cream transition-colors">
          <img src={errorJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
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
          <Camera size={19} /> 사진으로 한 끼 기록하기
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

      {/* 도사 한 마디 — 하단 앵커 */}
      <div className="mt-auto pt-8">
        <div className="relative bg-butler border border-butler-line rounded-card px-5 py-5 overflow-hidden">
          <span className="absolute -top-3 right-3 text-[68px] leading-none font-serif text-gold/20 select-none" aria-hidden="true">”</span>
          <p className="text-micro text-gold mb-2 tracking-wide font-medium">도사의 오늘 한 마디</p>
          <p className="text-body italic leading-relaxed relative" style={{ color: "#5c5647" }}>{dosaLineOfDay()}</p>
        </div>
      </div>
    </div>
  );
}
