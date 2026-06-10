// 앱 셸 — 온보딩(첫 방문) + 하단 탭(집무실/장부/회장님) + 사진 캡처를 앱 상단에서 관리.
// 탭바는 순수 탭 3개 — 캡처 진입점은 집무실 메인 버튼·장부 '기록 추가'.
// 분석은 백그라운드(비차단). 탭을 옮겨다녀도 분석이 끊기지 않고, 끝나면 막지 않고 '확인하기'로만 알린다.
import { useRef, useState, type ChangeEvent } from "react";
import Ledger from "@/pages/Ledger";
import HomeTab from "@/pages/HomeTab";
import Profile from "@/pages/Profile";
import Onboarding from "@/components/Onboarding";
import BottomNav, { type MainNavTab } from "@/components/BottomNav";
import LoginFailNotice from "@/components/LoginFailNotice";
import QuickRecord from "@/components/QuickRecord";
import { trpc } from "@/lib/trpc";
import type { CaptureJob, Prefill } from "@/lib/capture";
import type { Draft } from "@/lib/drafts";
import { Loader2, Check } from "lucide-react";

const ONBOARDED_KEY = "geojilog:onboarded";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
    r.readAsDataURL(file);
  });
}

function emptyData(imageUrl: string): Prefill {
  return { imageUrl, title: "", category: "식비", originalAmount: null, actualAmount: null };
}

export default function Shell() {
  const [tab, setTab] = useState<MainNavTab>("home");
  // 장부 딥링크 — 회장님 탭 '주간 결산' → 장부 달력의 주간 상세로 바로
  const [ledgerFocus, setLedgerFocus] = useState<"week" | null>(null);
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [confirmData, setConfirmData] = useState<Prefill | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // 첫 방문(기기당 1회)에만 온보딩 포털을 보여준다.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY);
    } catch {
      return false; // localStorage 비활성 환경에선 온보딩 생략
    }
  });

  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadImage = trpc.ai.uploadImage.useMutation();

  function triggerCapture() {
    cameraRef.current?.click();
  }

  function finishOnboarding() {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* 무시 */
    }
    setShowOnboarding(false);
    triggerCapture(); // 가입 없이 바로 첫 기록으로
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setJob({ status: "analyzing", preview });
    setTab("home"); // 촬영 직후 집무실(홈)으로 — 자르르가 분석하는 동안 안전한 로비에서 대기

    let base64 = "";
    try {
      base64 = await fileToBase64(file);
    } catch {
      setJob({ status: "error", preview, data: emptyData("") });
      return;
    }
    try {
      const r = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
      setJob({
        status: "ready",
        preview,
        data: {
          imageUrl: r.imageUrl,
          title: r.title,
          category: r.category,
          originalAmount: r.estimatedOriginalAmount,
          actualAmount: r.estimatedActualAmount,
          aiReason: r.reason,
        },
      });
    } catch {
      let imageUrl = "";
      try {
        const u = await uploadImage.mutateAsync({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
        imageUrl = u.imageUrl;
      } catch {
        /* 사진 저장도 실패 */
      }
      setJob({ status: "error", preview, data: emptyData(imageUrl) });
    }
  }

  function openConfirmFromJob() {
    if (job && job.status !== "analyzing") setConfirmData(job.data);
  }
  function completeDraft(d: Draft) {
    setConfirmData({
      imageUrl: d.imageUrl,
      title: d.title,
      category: d.category,
      originalAmount: d.originalAmount,
      actualAmount: d.actualAmount,
      aiReason: d.aiReason,
      date: d.date,
      draftId: d.id,
    });
  }
  function changeTab(t: MainNavTab) {
    setLedgerFocus(null); // 일반 탭 이동 시 딥링크 초기화
    setTab(t);
  }
  function openWeeklyLedger() {
    setLedgerFocus("week");
    setTab("records");
  }
  function onResolved() {
    setJob(null);
    setConfirmData(null);
  }
  function closeSheet() {
    setConfirmData(null);
  }

  return (
    <>
      {/* 캡처 입력 — 항상 마운트(온보딩 버튼에서도 바로 호출) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      {showOnboarding ? (
        <Onboarding onStart={finishOnboarding} />
      ) : (
        <>
          <LoginFailNotice />

          {/* 탭 콘텐츠 — key로 가벼운 전환 트랜지션 */}
          <main key={tab} className="animate-tab-in">
            {tab === "home" && (
              <HomeTab
                onCapture={triggerCapture}
                onOpenProfile={() => setTab("profile")}
                job={job}
                onOpenConfirm={openConfirmFromJob}
                onCompleteDraft={completeDraft}
              />
            )}
            {tab === "records" && <Ledger initialFocus={ledgerFocus} />}
            {tab === "profile" && <Profile onOpenWeekly={openWeeklyLedger} />}
          </main>

          {/* 다른 탭에 있을 때 비차단 알림 칩 — 탭바 위로 띄운다 */}
          {job && tab !== "home" && (
            <button
              onClick={() => (job.status === "analyzing" ? setTab("home") : openConfirmFromJob())}
              className="fixed left-1/2 -translate-x-1/2 bottom-[76px] z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-body font-medium bg-white border border-line active:scale-[0.98] transition-transform"
            >
              {job.status === "analyzing" ? (
                <>
                  <Loader2 size={15} className="animate-spin text-emerald-500" />
                  <span className="text-ink">자르르가 분석 중…</span>
                </>
              ) : (
                <>
                  <Check size={15} className="text-emerald-500" />
                  <span className="text-ink">한 끼 분석 완료 · 확인하기</span>
                </>
              )}
            </button>
          )}

          <BottomNav tab={tab} onChange={changeTab} />

          {confirmData && <QuickRecord data={confirmData} onClose={closeSheet} onSaved={onResolved} />}
        </>
      )}
    </>
  );
}
