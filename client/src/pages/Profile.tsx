// 프로필 탭 — 누적·건수·최고(진짜) + 계정(카카오 로그인) + 자랑/내보내기.
import { trpc } from "@/lib/trpc";
import { APP_NAME, CHARACTER_NAME, josa } from "@/lib/brand";
import { useAuth } from "@/_core/hooks/useAuth";
import Hwasubun from "@/components/Hwasubun";
import { Share2, Download, ChevronRight, LogOut } from "lucide-react";

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
type Entry = { profit: number };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl py-3.5 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

export default function Profile({ onGoRecords }: { onGoRecords: () => void }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const list = entries as Entry[];
  const total = list.reduce((s, e) => s + (e.profit || 0), 0);
  const count = list.length;
  const best = list.reduce((m, e) => Math.max(m, e.profit || 0), 0);

  const isKakao = user?.loginMethod === "kakao";
  const displayName = isKakao && user?.name ? user.name : "회장님";

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-12 pb-24">
      <header className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <Hwasubun level={Math.min(1, total / 50000)} size={92} />
        </div>
        <p className="text-base font-semibold text-gray-800">{displayName}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isKakao ? "카카오 로그인됨" : `${josa(CHARACTER_NAME, "과", "와")} 함께 절약 중`}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat label="누적 수익" value={won(total)} />
        <Stat label="총 기록" value={`${count}건`} />
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
          className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3.5 mb-2.5 active:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2.5 text-sm text-gray-700">
            <LogOut size={17} className="text-gray-400" /> 로그아웃
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      )}

      <button
        onClick={onGoRecords}
        className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3.5 mb-2.5 active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm text-gray-700">
          <Share2 size={17} className="text-emerald-500" /> 자랑 카드 만들기
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      <button
        onClick={onGoRecords}
        className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3.5 active:bg-gray-50 transition-colors"
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
