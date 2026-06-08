// 앱 셸 — 하단 탭(홈/기록/프로필) + 사진 캡처/분석을 앱 상단에서 관리.
// 분석은 백그라운드(비차단). 사용자는 탭을 옮겨다녀도 분석이 끊기지 않고,
// 끝나면 막지 않고 '확인하기'로만 알린다. 확인 시트는 누를 때만(로딩 없이) 뜬다.
import { useRef, useState, type ChangeEvent } from "react";
import Home from "@/pages/Home";
import HomeTab from "@/pages/HomeTab";
import Profile from "@/pages/Profile";
import BottomNav, { type MainNavTab } from "@/components/BottomNav";
import LoginFailNotice from "@/components/LoginFailNotice";
import QuickRecord from "@/components/QuickRecord";
import { trpc } from "@/lib/trpc";
import type { CaptureJob, Prefill } from "@/lib/capture";
import type { Draft } from "@/lib/drafts";
import { Loader2, Check } from "lucide-react";

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
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [confirmData, setConfirmData] = useState<Prefill | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadImage = trpc.ai.uploadImage.useMutation();

  function triggerCapture() {
    cameraRef.current?.click();
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setJob({ status: "analyzing", preview });
    setTab("home"); // 촬영 직후 자르르의 집(홈)으로 — 분석 구경

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
  function onResolved() {
    setJob(null);
    setConfirmData(null);
  }
  function closeSheet() {
    setConfirmData(null);
  }

  return (
    <>
      <LoginFailNotice />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      {tab === "home" && (
        <HomeTab
          onRecord={() => setTab("records")}
          onCapture={triggerCapture}
          job={job}
          onOpenConfirm={openConfirmFromJob}
          onCompleteDraft={completeDraft}
        />
      )}
      {tab === "records" && <Home />}
      {tab === "profile" && <Profile onGoRecords={() => setTab("records")} />}

      {/* 다른 탭에 있을 때 비차단 알림 칩 */}
      {job && tab !== "home" && (
        <button
          onClick={() => (job.status === "analyzing" ? setTab("home") : openConfirmFromJob())}
          className="fixed left-1/2 -translate-x-1/2 bottom-[64px] z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium bg-white border border-gray-200 active:scale-[0.98] transition-transform"
        >
          {job.status === "analyzing" ? (
            <>
              <Loader2 size={15} className="animate-spin text-emerald-500" />
              <span className="text-gray-600">자르르가 분석 중…</span>
            </>
          ) : (
            <>
              <Check size={15} className="text-emerald-500" />
              <span className="text-gray-700">한 끼 분석 완료 · 확인하기</span>
            </>
          )}
        </button>
      )}

      <BottomNav tab={tab} onChange={setTab} />

      {confirmData && <QuickRecord data={confirmData} onClose={closeSheet} onSaved={onResolved} />}
    </>
  );
}
