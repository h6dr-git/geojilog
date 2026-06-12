// 앱 셸 — 온보딩(첫 방문) + 하단 탭(집무실/장부/서재) + 사진 캡처를 앱 상단에서 관리.
// 탭바는 순수 탭 3개 — 캡처 진입점은 집무실 메인 버튼·장부 '기록 추가'.
// 분석은 백그라운드(비차단). 탭을 옮겨다녀도 분석이 끊기지 않고, 끝나면 막지 않고 '확인하기'로만 알린다.
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Ledger from "@/pages/Ledger";
import HomeTab from "@/pages/HomeTab";
import Profile from "@/pages/Profile";
import Onboarding from "@/components/Onboarding";
import BottomNav, { type MainNavTab } from "@/components/BottomNav";
import LoginFailNotice from "@/components/LoginFailNotice";
import SaveReveal from "@/components/SaveReveal";
import QuickRecord from "@/components/QuickRecord";
import FirstRecordGate from "@/components/FirstRecordGate";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { CaptureJob, Prefill } from "@/lib/capture";
import { getDrafts } from "@/lib/drafts";
import { sha256File } from "@/lib/fingerprint";
import { getExifDate } from "@/lib/exif";
import type { Draft } from "@/lib/drafts";
import { Loader2, Check, Copy } from "lucide-react";
import SsalCalc from "@/components/SsalCalc";
import { onAnalyzingCount } from "@/lib/analyzing";

const ONBOARDED_KEY = "geojilog:onboarded";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
    r.readAsDataURL(file);
  });
}

function emptyData(imageUrl: string, date?: string): Prefill {
  return { imageUrl, title: "", category: "식비", originalAmount: null, actualAmount: null, date };
}

export default function Shell() {
  const [tab, setTab] = useState<MainNavTab>("home");
  // 서재 '주간 보고' → 장부 주간 필터 딥링크 — keep-mounted 구조라 nonce 신호로 전달
  const [weekFocusNonce, setWeekFocusNonce] = useState(0);
  // #55 — 첫 기록 게이트의 '직접 적기' 탈출구: 장부 탭 + 기록 추가 시트 자동 오픈
  const [addSheetNonce, setAddSheetNonce] = useState(0);
  // 전역 '분석 중' 카운트 (장부 큐 포함) — 어느 탭에서든 쌀집이이 보인다 (#32)
  const [analyzingCount, setAnalyzingCount] = useState(0);
  useEffect(() => onAnalyzingCount(setAnalyzingCount), []);
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

  // 검증 계기판 (#53) — 앱 열람 핑: 기록 없이 둘러본 재방문도 D1/D7에 잡히게.
  const { isAuthenticated } = useAuth();
  // #55 — 첫 기록 게이트: 기록 0건이면 첫 기록(사진→원가 계산→리빌)까지 강제 유도
  const { data: gateEntries, isLoading: gateLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const showFirstGate =
    isAuthenticated && !showOnboarding && !gateLoading &&
    (gateEntries ?? []).length === 0 && !job && !confirmData &&
    getDrafts().length === 0; // 미완성(드래프트)이 있으면 이미 흐름을 경험한 것 — 막지 않는다
  const ping = trpc.user.ping.useMutation();
  const pinged = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !pinged.current) {
      pinged.current = true;
      ping.mutate(undefined, { onError: () => { /* 측정 실패는 무해 */ } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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

  // 온보딩에서 카카오 로그인 선택 — 온보딩 1회 처리 후 카카오로 이동
  function kakaoFromOnboarding() {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* 무시 */
    }
    window.location.href = "/api/auth/kakao";
  }

  // #48 — 중복 경고에서 '그래도 기록'을 위한 재시도 컨텍스트
  const retryCtx = useRef<{ base64: string; mimeType: string; preview: string; exifDate: string | null; imageSig: string | null } | null>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setJob({ status: "analyzing", preview });
    setTab("home"); // 촬영 직후 집무실(홈)으로 — 쌀집이이 두드리는 동안 안전한 로비에서 대기

    // 지난 사진이면 촬영 날짜를 그대로 쓴다 (장부 업로드 경로와 동일 — EXIF 일관성 버그 수정)
    const exifDate = await getExifDate(file).catch(() => null);
    const imageSig = await sha256File(file); // #48

    let base64 = "";
    try {
      base64 = await fileToBase64(file);
    } catch {
      setJob({ status: "error", preview, data: emptyData("", exifDate ?? undefined) });
      return;
    }
    retryCtx.current = { base64, mimeType: file.type || "image/jpeg", preview, exifDate, imageSig };
    await runAnalyze(false);
  }

  // 분석 실행 — ignoreDup=true면 중복 경고를 통과한 재시도 (#48)
  async function runAnalyze(ignoreDup: boolean) {
    const c = retryCtx.current;
    if (!c) return;
    const { base64, mimeType, preview, exifDate, imageSig } = c;
    if (ignoreDup) setJob({ status: "analyzing", preview });
    try {
      const r = await analyzeImage.mutateAsync({
        imageBase64: base64,
        mimeType,
        imageSig: imageSig ?? undefined,
        ignoreDuplicate: ignoreDup,
      });
      if (r.duplicate) {
        setJob({ status: "duplicate", preview, dup: r.duplicate }); // 사용자 선택 대기
        return;
      }
      setJob({
        status: "ready",
        preview,
        data: {
          imageUrl: r.imageUrl,
          title: r.title,
          category: r.category,
          // P2 — 내가 지난번 확정한 원가를 AI 추정보다 우선 제안 (기준가 일관성)
          originalAmount: r.prior?.originalAmount ?? r.estimatedOriginalAmount,
          actualAmount: r.estimatedActualAmount,
          aiReason: r.reason,
          date: exifDate ?? undefined,
          priorOriginalAmount: r.prior?.originalAmount,
          priorDate: r.prior?.date,
          priorUsualActual: r.prior?.usualActual,
          incomeSource: r.incomeSource, // #37+#38 — AI 분류 수익원
          sourceUsualActual: r.sourceUsual?.usualActual, // 유형 평소가 (보너스 기준)
          aiOriginalAmount: r.estimatedOriginalAmount,
          imageSig: imageSig ?? undefined, // #48
        },
      });
    } catch {
      let imageUrl = "";
      try {
        const u = await uploadImage.mutateAsync({ imageBase64: base64, mimeType });
        imageUrl = u.imageUrl;
      } catch {
        /* 사진 저장도 실패 */
      }
      setJob({ status: "error", preview, data: emptyData(imageUrl, exifDate ?? undefined) });
    }
  }

  function openConfirmFromJob() {
    if (job && (job.status === "ready" || job.status === "error")) setConfirmData(job.data);
  }
  // #48 — 중복 경고 카드의 두 갈래
  function ignoreDupAndAnalyze() {
    void runAnalyze(true);
  }
  function dismissDupJob() {
    setJob(null);
    retryCtx.current = null;
  }
  function completeDraft(d: Draft) {
    setConfirmData({
      imageUrl: d.imageUrl,
      title: d.title,
      category: d.category,
      originalAmount: d.originalAmount,
      actualAmount: d.actualAmount,
      aiReason: d.aiReason,
      memo: d.memo,
      date: d.date,
      draftId: d.id,
    });
  }
  function changeTab(t: MainNavTab) {
    setTab(t);
  }
  function openWeeklyLedger() {
    setWeekFocusNonce((n) => n + 1);
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
      {/* capture 속성 제거 — 모바일에서 '카메라 촬영 / 갤러리 선택'을 OS가 묻게 한다.
          (이미 찍어둔 점심 사진을 올리는 동선이 첫 무리 시연의 핵심) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      {showOnboarding ? (
        <Onboarding onStart={finishOnboarding} onKakao={kakaoFromOnboarding} />
      ) : (
        <>
          <LoginFailNotice />

          {/* 탭 콘텐츠 — 전부 마운트 유지, 숨김으로 전환.
              조건부 렌더(언마운트)는 장부 분석 큐·작성 중 입력을 날렸다(치명 버그 #27).
              전환 애니메이션은 transform 잔류·언마운트 문제로 제거. */}
          <main>
            <div className={tab === "home" ? "" : "hidden"}>
              <HomeTab
                onGoRecords={() => changeTab("records")}
                job={job}
                onOpenConfirm={openConfirmFromJob}
                onCompleteDraft={completeDraft}
                onIgnoreDup={ignoreDupAndAnalyze}
                onDismissDup={dismissDupJob}
              />
            </div>
            <div className={tab === "records" ? "" : "hidden"}>
              <Ledger weekFocusNonce={weekFocusNonce} openAddNonce={addSheetNonce} />
            </div>
            <div className={tab === "profile" ? "" : "hidden"}>
              <Profile onOpenWeekly={openWeeklyLedger} />
            </div>
          </main>

          {/* 전역 분석 인디케이터 — 회시생이 어느 탭에서든 두드리는 중 (#32) */}
          {(analyzingCount > 0 || (job && job.status === "analyzing")) && (
            <button
              onClick={() => (job && job.status === "analyzing" ? changeTab("home") : changeTab("records"))}
              aria-label="분석 진행 보기"
              className="fixed right-3 bottom-[92px] z-40 flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-white/95 border border-line shadow-lg active:scale-95 transition-transform"
            >
              <SsalCalc level={0.5} size={30} analyzing />
              <span className="text-micro font-medium text-ink-soft">계산하는 중{analyzingCount > 1 ? ` ${analyzingCount}` : ""}</span>
            </button>
          )}

          {/* 다른 탭에 있을 때 비차단 알림 칩 — 탭바 위로 띄운다 */}
          {job && tab !== "home" && (
            <button
              onClick={() => (job.status === "ready" || job.status === "error" ? openConfirmFromJob() : setTab("home"))}
              className="fixed left-1/2 -translate-x-1/2 bottom-[76px] z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-body font-medium bg-white border border-line active:scale-[0.98] transition-transform"
            >
              {job.status === "analyzing" ? (
                <>
                  <Loader2 size={15} className="animate-spin text-emerald-500" />
                  <span className="text-ink">회시생이 두드리는 중…</span>
                </>
              ) : job.status === "duplicate" ? (
                <>
                  <Copy size={15} className="text-amber-500" />
                  <span className="text-ink">이미 기록한 사진 · 확인하기</span>
                </>
              ) : (
                <>
                  <Check size={15} className="text-emerald-500" />
                  <span className="text-ink">한 끼 분석 완료 · 확인하기</span>
                </>
              )}
            </button>
          )}

          {/* #55 — 첫 기록 게이트 (탭바 위, 시트·리빌 아래) */}
          {showFirstGate && (
            <FirstRecordGate
              onPhoto={triggerCapture}
              onManual={() => {
                setTab("records");
                setAddSheetNonce((n) => n + 1);
              }}
            />
          )}

          <BottomNav tab={tab} onChange={changeTab} />

          {/* 저장 축하 리빌 — 어디서 저장하든 전역으로 한 번 */}
          <SaveReveal />

          {confirmData && <QuickRecord data={confirmData} onClose={closeSheet} onSaved={onResolved} />}
        </>
      )}
    </>
  );
}
