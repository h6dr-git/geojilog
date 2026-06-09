// 집무실(홈) — 남이 봐도 안전한 '로비'. (P0 토큰 + P1 레이아웃: 도사 카드 골드틴트 격상·하단 앵커로 여백 리듬)
// 원칙: 수익·통계·결산·내 기록(숫자) 절대 노출 금지. 어깨너머·스샷·데모에 보여도 안전해야 한다.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { useAuth } from "@/_core/hooks/useAuth";
import Hwasubun from "@/components/Hwasubun";
import LoginChip from "@/components/LoginChip";
import { useDrafts, type Draft } from "@/lib/drafts";
import type { CaptureJob } from "@/lib/capture";
import { Camera, ChevronRight, Check } from "lucide-react";

const WEEKLY_GOAL = 50000; // 자르르가 차오르는 한 주 목표 (캐릭터 연출용, 숫자는 노출 안 함)

type Entry = { date: string; profit: number };

function recentWeekProfit(entries: Entry[]): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  return entries
    .filter((e) => new Date(e.date + "T00:00:00") >= cutoff)
    .reduce((s, e) => s + (e.profit || 0), 0);
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
    <div className="min-h-screen max-w-lg mx-auto px-5 pb-28 bg-cream flex flex-col">
      {/* 헤더 — 앱 이름 + 로그인 칩(박회장님). 숫자 없음. */}
      <header className="pt-12 pb-3 flex items-center justify-between">
        <p className="text-caption font-mono text-ink-soft tracking-wider">{APP_NAME}</p>
        <LoginChip onClick={onOpenProfile} />
      </header>

      {/* 자르르 + 김집사 인사 한 줄 (숫자 없음) */}
      <div className="flex flex-col items-center text-center mt-6">
        <Hwasubun level={level} size={136} analyzing={!!analyzingJob} />
        <p className="mt-5 text-body text-ink/85 leading-relaxed px-4">
          {analyzingJob
            ? `${josa(CHARACTER_NAME, "이", "가")} 사진을 살펴보는 중이에요…`
            : butlerGreeting()}
        </p>
      </div>

      {/* 행동 영역 — 큰 기록 버튼이 기본. 진행 중일 땐 상태칩(금액 미노출). */}
      {analyzingJob ? (
        <div className="mt-7 flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-card p-3.5">
          <img src={analyzingJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
          <div className="text-left">
            <p className="text-body font-medium text-emerald-700">{CHARACTER_NAME}가 분석하고 있어요</p>
            <p className="text-micro text-emerald-600">잠시 둘러보고 계셔도 됩니다</p>
          </div>
        </div>
      ) : readyJob ? (
        <button
          onClick={onOpenConfirm}
          className="mt-7 w-full flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-card p-3 text-left active:bg-emerald-100 transition-colors"
        >
          <img src={readyJob.preview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-ink truncate">{readyJob.data.title || "분석 완료"}</p>
            <p className="text-micro text-emerald-600 flex items-center gap-0.5">
              <Check size={12} /> 분석 완료 · 확인하고 저장
            </p>
          </div>
          <ChevronRight size={16} className="text-emerald-400 shrink-0" />
        </button>
      ) : errorJob ? (
        <button
          onClick={onOpenConfirm}
          className="mt-7 w-full flex items-center gap-3 border border-line bg-white rounded-card p-3 text-left active:bg-cream transition-colors"
        >
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
          className="mt-7 w-full bg-emerald-500 text-white font-medium py-4 rounded-card flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-md shadow-emerald-500/20"
        >
          <Camera size={18} /> 사진으로 한 끼 기록하기
        </button>
      )}

      {/* 미완성(나중에 채우기) — 건수만, 금액 없음 */}
      {topDraft && (
        <button
          onClick={() => onCompleteDraft(topDraft)}
          className="mt-2.5 w-full flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-card px-3.5 py-3 text-left active:bg-amber-100 transition-colors"
        >
          <img src={topDraft.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body font-medium text-amber-800">아직 안 끝낸 기록 {drafts.length}개</p>
            <p className="text-micro text-amber-600 truncate">탭해서 마저 채우기</p>
          </div>
          <ChevronRight size={16} className="text-amber-400 shrink-0" />
        </button>
      )}

      {/* 도사 오늘의 한 마디 — 하단 앵커 + 골드틴트로 격상(집무실의 유일한 진지함) */}
      <div className="mt-auto pt-8">
        <div className="bg-butler border border-butler-line rounded-card px-5 py-4">
          <p className="text-micro text-gold mb-1.5 tracking-wide">도사의 오늘 한 마디</p>
          <p className="text-body italic leading-relaxed" style={{ color: "#5c5647" }}>
            “{dosaLineOfDay()}”
          </p>
        </div>
      </div>
    </div>
  );
}
