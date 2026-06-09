// 회장님(프로필) — 사적 서재. 의도적으로 들어오는 공간이라 수익·결산·누적을 여기서 보여준다.
// 구성: 자르르 + 박회장님(✎ 닉네임 수정) + 로그인 상태 + 김집사 주간 결산(이번 주 +수익) +
//       누적(조용한 스탯) + 데이터 내보내기 / 로그아웃.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { won } from "@/lib/format";
import { useAuth } from "@/_core/hooks/useAuth";
import Hwasubun from "@/components/Hwasubun";
import { Download, ChevronRight, LogOut, Pencil, Check, X } from "lucide-react";

type Entry = { date: string; profit: number };

function startOfRecentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6); // 오늘 포함 최근 7일
  return d;
}

function butlerSettlement(weekCount: number): string {
  if (weekCount === 0) return "이번 주는 아직 조용하군요. 한 끼 남겨보시지요.";
  return `회장님, 이번 주 ${weekCount}끼를 알뜰히 지켜내셨습니다.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#efe9dc] rounded-2xl py-3.5 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-[#1A1A17] mt-1 tabular-nums">{value}</p>
    </div>
  );
}

export default function Profile({ onGoRecords }: { onGoRecords: () => void }) {
  const { isAuthenticated, user, logout } = useAuth();
  const utils = trpc.useUtils();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const list = entries as Entry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;
  const best = list.reduce((m, e) => Math.max(m, e.profit || 0), 0);

  const weekStart = startOfRecentWeek();
  const weekList = list.filter((e) => new Date(e.date + "T00:00:00") >= weekStart);
  const weekProfit = weekList.reduce((s, e) => s + (e.profit || 0), 0);
  const weekCount = weekList.length;

  const isKakao = user?.loginMethod === "kakao";
  const displayName = user?.name || "회장님";

  // ── 닉네임 수정 (✎) ──────────────────────────────────────────
  // 저장은 화면 즉시 반영(낙관적). 새로고침 후에도 유지하려면 A의 user.updateName 연결 필요.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  function startEdit() {
    setDraftName(displayName);
    setEditing(true);
  }
  function saveName() {
    const name = draftName.trim().slice(0, 20);
    if (name) {
      // 낙관적: auth.me 캐시에 새 이름을 즉시 반영
      utils.auth.me.setData(undefined, (prev) => (prev ? { ...prev, name } : prev));
      // TODO(A2 의존): A가 trpc.user.updateName 추가하면 아래 한 줄로 서버 저장.
      //   trpc.user.updateName.mutate({ name })  // 그래야 새로고침/다른 기기에도 유지됨
    }
    setEditing(false);
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-12 pb-28 bg-[#FAF8F3]">
      {/* 회장님 헤더 — 자르르 + 닉네임(✎) + 로그인 상태 */}
      <header className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <Hwasubun level={Math.min(1, total / 50000)} size={92} />
        </div>

        {editing ? (
          <div className="flex items-center justify-center gap-1.5">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditing(false);
              }}
              maxLength={20}
              placeholder="회장님"
              className="w-40 text-center text-base font-semibold text-[#1A1A17] bg-white border border-[#E0A92E]/50 rounded-lg px-2 py-1 outline-none focus:border-[#E0A92E]"
            />
            <button
              onClick={saveName}
              aria-label="저장"
              className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setEditing(false)}
              aria-label="취소"
              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95 transition-transform"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 group"
            aria-label="닉네임 수정"
          >
            <span className="text-base font-semibold text-[#1A1A17]">{displayName}</span>
            <Pencil size={14} className="text-[#E0A92E]" />
          </button>
        )}

        <p className="text-xs text-gray-400 mt-1">
          {isKakao ? "카카오 로그인됨" : `${josa(CHARACTER_NAME, "과", "와")} 함께 절약 중`}
        </p>
      </header>

      {/* 김집사 주간 결산 — 이번 주 +수익 (사적 영역이라 숫자 노출 OK). 탭하면 장부로. */}
      <button
        onClick={onGoRecords}
        className="w-full text-left bg-[#fbf7ee] border border-[#efe4cd] rounded-2xl p-4 mb-3 active:bg-[#f7f0e0] transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-lg bg-[#eadfc6] flex items-center justify-center text-[#a9863f] text-[13px] font-medium shrink-0">
            집
          </span>
          <p className="text-[11px] text-[#b09a63]">김집사의 주간 결산</p>
        </div>
        <p className="text-[11px] text-gray-400">이번 주 지켜낸 돈</p>
        <p className="font-mono text-3xl font-bold text-emerald-500 tabular-nums leading-tight mt-0.5">
          +{won(weekProfit)}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[12px] text-[#5c5647]">{butlerSettlement(weekCount)}</p>
          <ChevronRight size={16} className="text-[#cbb98c] shrink-0" />
        </div>
      </button>

      {/* 누적 — 조용한 참고용 스탯 (트로피 아님) */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat label="지금까지" value={won(total)} />
        <Stat label="기록" value={`${count}건`} />
        <Stat label="최고 한 건" value={won(best)} />
      </div>

      {/* 계정 — 게스트면 카카오 로그인 유도, 로그인됨이면 로그아웃 */}
      {!isKakao ? (
        <a
          href="/api/auth/kakao"
          className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2.5 bg-[#FEE500] active:opacity-90 transition-opacity"
        >
          <span className="flex flex-col text-left">
            <span className="text-sm font-semibold text-[#191600]">카카오로 로그인</span>
            <span className="text-[11px] text-[#191600]/60">
              다른 기기에서도 보고, 기록을 안전하게
            </span>
          </span>
          <ChevronRight size={16} className="text-[#191600]/40" />
        </a>
      ) : (
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-between bg-white border border-[#efe9dc] rounded-2xl px-4 py-3.5 mb-2.5 active:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2.5 text-sm text-gray-700">
            <LogOut size={17} className="text-gray-400" /> 로그아웃
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      )}

      {/* 데이터 내보내기 */}
      <button
        onClick={onGoRecords}
        className="w-full flex items-center justify-between bg-white border border-[#efe9dc] rounded-2xl px-4 py-3.5 active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm text-gray-700">
          <Download size={17} className="text-emerald-500" /> 데이터 내보내기
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>

      <p className="text-center text-[11px] text-gray-300 mt-10 font-mono tracking-wider">
        {APP_NAME} · {josa(CHARACTER_NAME, "과", "와")} 함께
      </p>
    </div>
  );
}
