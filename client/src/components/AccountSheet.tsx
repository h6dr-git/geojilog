// 계정 시트 — 집무실 상단 프로필 칩에서 연다. (구조 재편: 계정 기능은 탭이 아니라 칩 뒤로)
// 닉네임 수정 · 카카오 로그인/로그아웃 · 데이터 내보내기. "크게 중요하지 않은 기능"이라 조용한 곳에.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { CHARACTER_NAME, josa } from "@/lib/brand";
import Jarureu from "@/components/Jarureu";
import ExportSheet from "@/components/ExportSheet";
import type { SavingsEntry } from "@/lib/ledger";
import { useEffect } from "react";
import { toast } from "sonner";
import { X, Pencil, Check, LogOut, Download, ChevronRight, Bell, BellOff, Loader2, SquarePlus } from "lucide-react";
import InstallGuideSheet from "@/components/InstallGuideSheet";
import { useInstall } from "@/lib/install";

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const updateName = trpc.user.updateName.useMutation({ onSettled: () => utils.auth.me.invalidate() });
  const { data: entries = [] } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: authConfig } = trpc.auth.config.useQuery();
  const kakaoEnabled = authConfig?.kakaoEnabled ?? false;

  const isKakao = user?.loginMethod === "kakao";
  const displayName = user?.name || "사장님";

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const { standalone, canPrompt, promptInstall } = useInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // ── 웹 푸시 — 회시생의 저녁 보고 (금액 없는 알림) ──
  const { data: pushConfig } = trpc.push.config.useQuery();
  const subscribePush = trpc.push.subscribe.useMutation();
  const unsubscribePush = trpc.push.unsubscribe.useMutation();
  const [pushState, setPushState] = useState<"unsupported" | "off" | "on" | "busy">("busy");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !pushConfig?.enabled) {
        setPushState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : "off");
      } catch {
        setPushState("unsupported");
      }
    })();
  }, [pushConfig?.enabled]);

  function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function togglePush() {
    if (pushState === "busy" || pushState === "unsupported" || !pushConfig?.publicKey) return;
    const prev = pushState;
    setPushState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      if (prev === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush.mutateAsync({ endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setPushState("off");
        toast.success("저녁 보고 알림을 껐습니다");
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setPushState("off");
          toast.error("브라우저 알림 권한이 필요합니다");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
        });
        const json = sub.toJSON();
        await subscribePush.mutateAsync({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
        setPushState("on");
        toast.success("매일 저녁, 회시생이 보고를 올립니다");
      }
    } catch {
      setPushState(prev);
      toast.error("알림 설정에 실패했습니다");
    }
  }

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

        {/* 정체성 — 쌀집이 + 닉네임 */}
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
                placeholder="사장님"
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
        {/* 풀 로그아웃 — 앱 쿠키 + 카카오 세션까지 (콘솔에 Logout Redirect URI 등록 필요) */}
        {isKakao && (
          <a href="/api/auth/kakao/logout" className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-2.5 active:bg-cream transition-colors">
            <span className="flex items-center gap-2.5 text-body text-ink">
              <LogOut size={17} className="text-ink-soft" /> 로그아웃
            </span>
            <ChevronRight size={16} className="text-ink-faint" />
          </a>
        )}

        {/* 저녁 보고 알림 — 푸시 미지원/미설정 환경에선 숨김 */}
        {pushState !== "unsupported" && (
          <button
            onClick={togglePush}
            disabled={pushState === "busy"}
            className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-2.5 active:bg-cream disabled:opacity-60 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-body text-ink">
              {pushState === "busy" ? (
                <Loader2 size={17} className="animate-spin text-ink-soft" />
              ) : pushState === "on" ? (
                <Bell size={17} className="text-gold" />
              ) : (
                <BellOff size={17} className="text-ink-soft" />
              )}
              회시생의 저녁 보고
            </span>
            <span className={`text-caption font-medium ${pushState === "on" ? "text-emerald-600" : "text-ink-faint"}`}>
              {pushState === "on" ? "받는 중" : pushState === "busy" ? "" : "꺼짐"}
            </span>
          </button>
        )}

        {/* 홈 화면에 추가 (#40) — 이미 설치된 환경에선 숨김 */}
        {!standalone && (
          <button
            onClick={async () => {
              if (canPrompt) await promptInstall();
              else setShowInstallGuide(true);
            }}
            className="w-full flex items-center justify-between bg-white border border-line rounded-card px-4 py-3.5 mb-2.5 active:bg-cream transition-colors"
          >
            <span className="flex items-center gap-2.5 text-body text-ink">
              <SquarePlus size={17} className="text-gold" /> 홈 화면에 추가
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
      {showInstallGuide && <InstallGuideSheet onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
