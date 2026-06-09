// 회장님(프로필) — 사적 서재. (P0 토큰 + P1: stat 2칸 위계·카드 padding·여백 정돈)
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { won } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import Jarureu from "@/components/Jarureu";
import { Download, ChevronRight, LogOut, Pencil, Check, X } from "lucide-react";

type Entry = { date: string; profit: number };

function startOfRecentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}
function butlerSettlement(weekCount: number): string {
  if (weekCount === 0) return "이번 주는 아직 조용하군요. 한 끼 남겨보시지요.";
  return `회장님, 이번 주 ${weekCount}끼를 알뜰히 지켜내셨습니다.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line rounded-card py-4 px-3 text-center">
      <p className="text-micro text-ink-soft">{label}</p>
      <p className="font-mono text-title font-semibold text-ink mt-1.5 tabular-nums">{value}</p>
    </div>
  );
}

export default function Profile({ onGoRecords }: { onGoRecords: () => void }) {
  const { isAuthenticated, user, logout } = useAuth();
  const utils = trpc.useUtils();
  const updateName = trpc.user.updateName.useMutation({
    onSettled: () => utils.auth.me.invalidate(),
  });
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });

  const list = entries as Entry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;

  const weekStart = startOfRecentWeek();
  const weekList = list.filter((e) => new Date(e.date + "T00:00:00") >= weekStart);
  const weekProfit = weekList.reduce((s, e) => s + (e.profit || 0), 0);
  const weekCount = weekList.length;

  const isKakao = user?.loginMethod === "kakao";
  const displayName = user?.name || "회장님";

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  function startEdit() {
    setDraftName(displayName);
    setEditing(true);
  }
  function saveName() {
    const name = draftName.trim().slice(0, 20);
    if (name && name !== displayName) {
      utils.auth.me.setData(undefined, (prev) => (prev ? { ...prev, name } : prev));
      updateName.mutate({ name });
    }
    setEditing(false);
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-5 pt-12 pb-28 bg-cream">
      {/* 회장님 헤더 — 자르르 + 닉네임(✎) + 로그인 상태 */}
      <header className="text-center mb-7">
        <div className="flex justify-center mb-3">
          <Jarureu level={Math.min(1, total / 50000)} size={92} />
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
              className="w-40 text-center text-title font-semibold text-ink bg-white border border-gold/50 rounded-lg px-2 py-1 outline-none focus:border-gold"
            />
            <button onClick={saveName} aria-label="저장" className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center active:scale-95 transition-transform">
              <Check size={16} />
            </button>
            <button onClick={() => setEditing(false)} aria-label="취소" className="w-8 h-8 rounded-lg bg-line text-ink-soft flex items-center justify-center active:scale-95 transition-transform">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="inline-flex items-center gap-1.5" aria-label="닉네임 수정">
            <span className="text-title font-semibold text-ink">{displayName}</span>
            <Pencil size={14} className="text-gold" />
          </button>
        )}

        <p className="text-caption text-ink-soft mt-1.5">
          {isKakao ? "카카오 로그인됨" : `${josa(CHARACTER_NAME, "과", "와")} 함께 절약 중`}
        </p>
      </header>

      {/* 김집사 주간 결산 — 이번 주 +수익 (사적 영역이라 숫자 노출 OK). 탭하면 장부로. */}
      <button onClick={onGoRecords} className="w-full text-left bg-butler border border-butler-line rounded-card p-5 mb-3 active:opacity-90 transition-opacity">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-caption font-medium shrink-0" style={{ background: "#eadfc6", color: "#a9863f" }}>집</span>
          <p className="text-micro text-gold tracking-wide">김집사의 주간 결산</p>
        </div>
        <p className="text-micro text-ink-soft">이번 주 지켜낸 돈</p>
        <p className="font-mono text-hero font-bold text-emerald-500 tabular-nums leading-tight mt-1">+{won(weekProfit)}</p>
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-caption" style={{ color: "#5c5647" }}>{butlerSettlement(weekCount)}</p>
          <ChevronRight size={16} className="shrink-0" style={{ color: "#cbb98c" }} />
        </div>
      </button>

      {/* 누적 — 조용한 참고용 스탯 (2칸 위계) */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <Stat label="지금까지 지켜낸 총액" value={won(total)} />
        <Stat label="총 기록" value={`${count}건`} />
      </div>

      {/* 계정 — 게스트면 카카오 로그인 유도, 로그인됨이면 로그아웃 */}
      {!isKakao ? (
        <a href="/api/auth/kakao" className="w-full flex items-center justify-between rounded-card px-4 py-3.5 mb-2.5 bg-[#FEE500] active:opacity-90 transition-opacity">
          <span className="flex flex-col text-left">
            <span className="text-body font-semibold text-[#191600]">카카오로 로그인</span>
            <span className="text-micro text-[#191600]/60">다른 기기에서도 보고, 기록을 안전하게</span>
          </span>
          <ChevronRight size={16} className="text-[#191600]/40" />
        </a>
      ) : (
        <button onClick={() => logout()} className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-2.5 active:bg-cream transition-colors">
          <span className="flex items-center gap-2.5 text-body text-ink">
            <LogOut size={17} className="text-ink-soft" /> 로그아웃
          </span>
          <ChevronRight size={16} className="text-ink-faint" />
        </button>
      )}

      {/* 데이터 내보내기 */}
      <button onClick={onGoRecords} className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 active:bg-cream transition-colors">
        <span className="flex items-center gap-2.5 text-body text-ink">
          <Download size={17} className="text-emerald-500" /> 데이터 내보내기
        </span>
        <ChevronRight size={16} className="text-ink-faint" />
      </button>

      <p className="text-center text-micro text-ink-faint mt-10 font-mono tracking-wider">
        {APP_NAME} · {josa(CHARACTER_NAME, "과", "와")} 함께
      </p>
    </div>
  );
}
