// 계정 시트 — 집무실 상단 프로필 칩에서 연다. (구조 재편: 계정 기능은 탭이 아니라 칩 뒤로)
// 닉네임 수정 · 카카오 로그인/로그아웃 · 데이터 내보내기. "크게 중요하지 않은 기능"이라 조용한 곳에.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { CHARACTER_NAME, josa } from "@/lib/brand";
import Jarureu from "@/components/Jarureu";
import ExportSheet from "@/components/ExportSheet";
import type { SavingsEntry } from "@/lib/ledger";
import { X, Pencil, Check, LogOut, Download, ChevronRight } from "lucide-react";

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { isAuthenticated, user, logout } = useAuth();
  const utils = trpc.useUtils();
  const updateName = trpc.user.updateName.useMutation({ onSettled: () => utils.auth.me.invalidate() });
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: authConfig } = trpc.auth.config.useQuery();
  const kakaoEnabled = authConfig?.kakaoEnabled ?? false;

  const isKakao = user?.loginMethod === "kakao";
  const displayName = user?.name || "회장님";

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [showExport, setShowExport] = useState(false);

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      style={{ animation: "acFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes acUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes acFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8"
        style={{ animation: "acUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">계정</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {/* 정체성 — 자르르 + 닉네임 */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <Jarureu level={0.6} size={72} />
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
              <Pencil size={13} className="text-gold" />
            </button>
          )}
          <p className="text-caption text-ink-soft mt-1">
            {isKakao ? "카카오 로그인됨" : `${josa(CHARACTER_NAME, "과", "와")} 함께 (게스트)`}
          </p>
        </div>

        {/* 카카오 로그인 / 로그아웃 */}
        {!isKakao && kakaoEnabled && (
          <a href="/api/auth/kakao" className="w-full flex items-center justify-between rounded-card px-4 py-3.5 mb-2.5 bg-[#FEE500] active:opacity-90 transition-opacity">
            <span className="flex flex-col text-left">
              <span className="text-body font-semibold text-[#191600]">카카오로 로그인</span>
              <span className="text-micro text-[#191600]/60">다른 기기에서도 보고, 기록을 안전하게</span>
            </span>
            <ChevronRight size={16} className="text-[#191600]/40" />
          </a>
        )}
        {isKakao && (
          <button onClick={() => logout()} className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-2.5 active:bg-cream transition-colors">
            <span className="flex items-center gap-2.5 text-body text-ink">
              <LogOut size={17} className="text-ink-soft" /> 로그아웃
            </span>
            <ChevronRight size={16} className="text-ink-faint" />
          </button>
        )}

        {/* 데이터 내보내기 */}
        <button onClick={() => setShowExport(true)} className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 active:bg-cream transition-colors">
          <span className="flex items-center gap-2.5 text-body text-ink">
            <Download size={17} className="text-emerald-500" /> 데이터 내보내기
          </span>
          <ChevronRight size={16} className="text-ink-faint" />
        </button>
      </div>

      {showExport && <ExportSheet entries={entries as SavingsEntry[]} onClose={() => setShowExport(false)} />}
    </div>
  );
}
