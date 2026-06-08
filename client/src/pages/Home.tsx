// 거지로그 V2.1 — QA 버그 수정 (개별 로딩, 금액 UI, Enter 제출, 제목 자동 네이밍)
// ============================================================

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { smartCropToSquare } from "@/lib/smartCrop";
import {
  Upload, Camera, ImageIcon, PenLine, Loader2, Download,
  Copy, Trash2, ChevronDown, ChevronUp, LogIn, Check,
  Pencil, X, ChevronLeft, ChevronRight, BarChart2, Share2,
} from "lucide-react";
import SavingsStoryCard from "@/components/SavingsStoryCard";
import Hwasubun from "@/components/Hwasubun";

// ── 타입 ──────────────────────────────────────────────────────
interface SavingsEntry {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: string;
  ticker: string;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  aiEstimated: "yes" | "no";
  aiReason?: string | null;
  imageUrl?: string | null;
  memo?: string | null;
  createdAt: Date;
  userId: number;
}

// 업로드 큐 아이템 — submitting 필드 추가 (버그 #1 수정)
interface QueueItem {
  id: string;
  previewUrl: string;
  fileName: string;
  status: "analyzing" | "ready" | "error";
  submitting: boolean; // 개별 등록 로딩 상태
  title: string;
  category: string;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  date: string;
  memo: string;
  imageUrl?: string;
}

type ExportRange = "all" | "month" | "week" | "custom";
type MainTab = "input" | "calendar";

// ── 유틸 ──────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ko-KR");
const todayStr = () => new Date().toISOString().split("T")[0];

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 버그 #4: 제목 자동 네이밍 유틸
function makeDefaultTitle(dateStr: string, category: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dow = KO_DAYS[d.getDay()];
  return `${mm}.${dd}.(${dow}) ${category}`;
}

function filterByRange(entries: SavingsEntry[], range: ExportRange, from: string, to: string) {
  const now = new Date();
  if (range === "all") return entries;
  if (range === "month") {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return entries.filter(e => e.date.startsWith(ym));
  }
  if (range === "week") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const monStr = mon.toISOString().split("T")[0];
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const sunStr = sun.toISOString().split("T")[0];
    return entries.filter(e => e.date >= monStr && e.date <= sunStr);
  }
  if (range === "custom") return entries.filter(e => e.date >= from && e.date <= to);
  return entries;
}

function toMarkdownTable(entries: SavingsEntry[]) {
  const header = "| 날짜 | 항목 | 카테고리 | 원가 | 실제지출 | 절약수익 | 메모 |";
  const sep = "|------|------|----------|------|----------|----------|------|";
  const rows = entries.map(e =>
    `| ${e.date} | ${e.title} | ${e.category} | ${fmt(e.originalAmount)}원 | ${fmt(e.actualAmount)}원 | ${fmt(e.profit)}원 | ${e.memo ?? ""} |`
  );
  const total = entries.reduce((s, e) => s + e.profit, 0);
  return [header, sep, ...rows].join("\n") + `\n\n**총 절약 수익: ${fmt(total)}원** (${entries.length}건)`;
}

function toCsv(entries: SavingsEntry[]) {
  const header = "날짜,항목,카테고리,원가,실제지출,절약수익,메모,AI추정";
  const rows = entries.map(e =>
    [
      e.date, `"${e.title}"`, e.category,
      e.originalAmount, e.actualAmount, e.profit,
      `"${(e.memo ?? "").replace(/"/g, '""')}"`,
      e.aiEstimated === "yes" ? "Y" : "N",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

// ── 미니멀 캘린더 ─────────────────────────────────────────────
type DetailMode = "day" | "week" | "month";

function MiniCalendar({ entries }: { entries: SavingsEntry[] }) {
  const todayFull = todayStr();

  // Always-On: 오늘 날짜로 초기화, null 없음
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayFull);
  const [detailMode, setDetailMode] = useState<DetailMode>("day");
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(todayFull);
  const monthInputRef = useRef<HTMLInputElement>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 날짜별 수익 집계
  const profitByDate = useMemo(() => {
    const map: Record<string, number> = {};
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    entries.filter(e => e.date.startsWith(ym)).forEach(e => {
      map[e.date] = (map[e.date] ?? 0) + e.profit;
    });
    return map;
  }, [entries, year, month]);

  // 선택된 날짜 기록
  const selectedEntries = useMemo(
    () => entries.filter(e => e.date === selectedDate),
    [entries, selectedDate]
  );

  // 주간 기록 (selectedWeekStart 기준 월~일)
  const weekEntries = useMemo(() => {
    const start = selectedWeekStart;
    const end = (() => {
      const d = new Date(start + "T00:00:00");
      d.setDate(d.getDate() + 6);
      return d.toISOString().split("T")[0];
    })();
    return entries.filter(e => e.date >= start && e.date <= end);
  }, [entries, selectedWeekStart]);

  // 월간 기록
  const monthEntries = useMemo(() => {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    return entries.filter(e => e.date.startsWith(ym));
  }, [entries, year, month]);

  // 월간 카테고리별 집계
  const monthByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthEntries.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.profit; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthEntries]);

  const prevMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setDetailMode("day");
  };
  const nextMonth = () => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setDetailMode("day");
  };

  // Always-On: 이미 선택된 날짜 재탭 시 무시
  const handleDayClick = (dateStr: string) => {
    if (dateStr === selectedDate) return;
    setSelectedDate(dateStr);
    setDetailMode("day");
  };

  // 주간 뷰 진입: 해당 주 월요일 계산
  const handleWeekClick = (rowStartIdx: number) => {
    // rowStartIdx: 해당 행의 첫 번째 날짜 인덱스 (cells 배열 기준)
    const firstDateOfRow = cells.find((c, i) => i >= rowStartIdx && c !== null);
    if (firstDateOfRow === null || firstDateOfRow === undefined) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(firstDateOfRow).padStart(2, "0")}`;
    // 해당 날짜의 주 월요일 계산
    const d = new Date(dateStr + "T00:00:00");
    const dow = d.getDay(); // 0=Sun
    const diffToMon = (dow + 6) % 7;
    d.setDate(d.getDate() - diffToMon);
    setSelectedWeekStart(d.toISOString().split("T")[0]);
    setDetailMode("week");
  };

  // 연/월 점프: input[type=month] 트리거
  const handleMonthJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m] = e.target.value.split("-").map(Number);
    if (y && m) setViewDate(new Date(y, m - 1, 1));
  };

  // 그리드 셀 구성 (null = 빈 칸)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // 주 단위로 묶기 (7개씩)
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-4">
        {/* 이전 월 */}
        <button
          onClick={prevMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 active:scale-95 transition-all"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 연/월 — 클릭 시 month picker 트리거 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => monthInputRef.current?.showPicker?.() ?? monthInputRef.current?.click()}
            className="text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors flex items-center gap-1"
          >
            {year}년 {month + 1}월
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          {/* 월간 리포트 아이콘 — 역할 분리 */}
          <button
            onClick={() => setDetailMode(m => m === "month" ? "day" : "month")}
            className={`ml-1 p-1 rounded transition-colors ${
              detailMode === "month" ? "text-emerald-500" : "text-gray-300 hover:text-gray-500"
            }`}
            title="월간 리포트"
          >
            <BarChart2 size={14} />
          </button>
        </div>

        {/* 다음 월 */}
        <button
          onClick={nextMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 active:scale-95 transition-all"
        >
          <ChevronRight size={16} />
        </button>

        {/* 숨겨진 month input */}
        <input
          ref={monthInputRef}
          type="month"
          value={`${year}-${String(month + 1).padStart(2, "0")}`}
          onChange={handleMonthJump}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {/* ── 요일 헤더 (8열: 일~토 + 빈 칸) ── */}
      <div className="grid grid-cols-8 mb-1">
        {KO_DAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs py-1 ${
            i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
          }`}>
            {d}
          </div>
        ))}
        <div /> {/* 8번째 열 빈 헤더 */}
      </div>

      {/* ── 날짜 그리드 (8열: 날짜 7 + 주간 버튼 1) ── */}
      <div className="space-y-0">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-8">
            {week.map((day, dayIdx) => {
              if (day === null) return <div key={`e-${weekIdx}-${dayIdx}`} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const profit = profitByDate[dateStr];
              const isToday = dateStr === todayFull;
              const isSelected = dateStr === selectedDate;
              const dow = (firstDay + day - 1) % 7;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className="flex flex-col items-center py-1.5 min-h-[44px] w-full rounded-lg transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                    isSelected
                      ? "bg-emerald-500 text-white font-semibold"  // 케이스 A: 선택됨
                      : isToday
                      ? "border border-gray-300 text-gray-700"      // 케이스 B: 오늘(미선택) — 회색 테두리만
                      : dow === 0 ? "text-red-400"
                      : dow === 6 ? "text-blue-400"
                      : "text-gray-700"
                  }`}>
                    {day}
                  </span>
                  {/* 일별 수익 항상 표시 */}
                  {profit !== undefined && (
                    <span className="text-[9px] text-emerald-500 font-medium leading-tight mt-0.5 tabular-nums">
                      +₩{fmt(profit)}
                    </span>
                  )}
                </button>
              );
            })}

            {/* 8번째 열: 주간 뷰 버튼 */}
            <button
              onClick={() => handleWeekClick(weekIdx * 7)}
              className={`flex items-center justify-center transition-colors ${
                detailMode === "week" && (() => {
                  const firstDay_ = week.find(d => d !== null);
                  if (!firstDay_) return false;
                  const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(firstDay_).padStart(2, "0")}`;
                  const d = new Date(ds + "T00:00:00");
                  const diff = (d.getDay() + 6) % 7;
                  d.setDate(d.getDate() - diff);
                  return d.toISOString().split("T")[0] === selectedWeekStart;
                })()
                  ? "text-emerald-500"
                  : "text-gray-300 hover:text-gray-500"
              }`}
              title="주간 결산"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* ── 하단 상세 영역 ── */}
      <div className="mt-5 border-t border-gray-100 pt-4">

        {/* 일별 뷰 */}
        {detailMode === "day" && (
          <>
            <p className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-3">
              {selectedDate.replace(/-/g, ".")} 기록
            </p>
            {selectedEntries.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-6">기록 없음</p>
            ) : (
              <div className="space-y-2">
                {selectedEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    {entry.imageUrl
                      ? <img src={entry.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                      {entry.memo && <p className="text-xs text-gray-400 truncate italic">{entry.memo}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono font-semibold text-emerald-500">+₩{fmt(entry.profit)}</p>
                      <p className="text-xs text-gray-400 tabular-nums">
                        <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                        <span className="mx-1 text-gray-300">→</span>
                        <span>₩{fmt(entry.actualAmount)}</span>
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-gray-400">{selectedEntries.length}건 합계</span>
                  <span className="text-sm font-mono font-semibold text-emerald-500">
                    +₩{fmt(selectedEntries.reduce((s, e) => s + e.profit, 0))}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 주간 뷰 */}
        {detailMode === "week" && (() => {
          const endDate = (() => {
            const d = new Date(selectedWeekStart + "T00:00:00");
            d.setDate(d.getDate() + 6);
            return d.toISOString().split("T")[0];
          })();
          const weekProfit = weekEntries.reduce((s, e) => s + e.profit, 0);
          return (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-gray-400 tracking-widest uppercase">
                  {selectedWeekStart.slice(5).replace("-", ".")} ~ {endDate.slice(5).replace("-", ".")} 주간
                </p>
                <button onClick={() => setDetailMode("day")} className="p-1 text-gray-300 hover:text-gray-500">
                  <X size={14} />
                </button>
              </div>
              {weekEntries.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">기록 없음</p>
              ) : (
                <>
                  {/* 사진 그리드 */}
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {weekEntries.filter(e => e.imageUrl).map(entry => (
                      <img key={entry.id} src={entry.imageUrl!} alt="" className="w-full aspect-square object-cover rounded-lg" />
                    ))}
                  </div>
                  {/* 주간 목록 */}
                  <div className="space-y-1">
                    {weekEntries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{entry.title}</p>
                          <p className="text-[10px] text-gray-400">{entry.date.slice(5).replace("-", ".")}</p>
                        </div>
                        <p className="text-xs font-mono text-emerald-500 flex-shrink-0">+₩{fmt(entry.profit)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{weekEntries.length}건 합계</span>
                    <span className="text-sm font-mono font-semibold text-emerald-500">+₩{fmt(weekProfit)}</span>
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* 월간 리포트 뷰 */}
        {detailMode === "month" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-gray-400 tracking-widest uppercase">
                {year}.{String(month + 1).padStart(2, "0")} 월간 리포트
              </p>
              <button onClick={() => setDetailMode("day")} className="p-1 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            </div>
            {monthEntries.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-6">기록 없음</p>
            ) : (
              <div className="space-y-3">
                {/* 요약 */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">{monthEntries.length}건</span>
                  <span className="text-lg font-mono font-bold text-emerald-500">
                    +₩{fmt(monthEntries.reduce((s, e) => s + e.profit, 0))}
                  </span>
                </div>
                {/* 카테고리별 */}
                <div className="space-y-1.5">
                  {monthByCategory.map(([cat, profit]) => {
                    const total = monthEntries.reduce((s, e) => s + e.profit, 0);
                    const pct = total > 0 ? Math.round((profit / total) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600">{cat}</span>
                          <span className="text-gray-500 tabular-nums">+₩{fmt(profit)} ({pct}%)</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: isAuthenticated });

  const createEntry = trpc.savings.create.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const updateEntry = trpc.savings.update.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const deleteEntry = trpc.savings.delete.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c: { name: string }) => c.name) : ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"]),
    [categories]
  );

  const totalProfit = useMemo(() => (entries as SavingsEntry[]).reduce((s, e) => s + e.profit, 0), [entries]);

  // ── 탭 ──
  const [mainTab, setMainTab] = useState<MainTab>("input");

  // ── 업로드 큐 ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // ── 수동 입력 — userEdited 플래그로 자동 제목 덮어쓰기 방지 ──
  const [showManual, setShowManual] = useState(false);
  const [manualTitleEdited, setManualTitleEdited] = useState(false);
  const [manualForm, setManualForm] = useState(() => {
    const d = todayStr();
    return {
      date: d, title: makeDefaultTitle(d, "식비"), category: "식비",
      originalAmount: "", actualAmount: "", description: "", memo: "",
    };
  });

  // ── 인라인 수정 ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; category: string; originalAmount: string;
    actualAmount: string; memo: string; date: string;
  } | null>(null);

  // ── 스토리 공유 ──
  const [storyEntry, setStoryEntry] = useState<SavingsEntry | null>(null);

  // ── Export ──
  const [showExport, setShowExport] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [copied, setCopied] = useState(false);

  // ── AI 이미지 처리 ──
  const processFile = useCallback(async (file: File, itemId: string) => {
    const exifDate = await getExifDate(file);
    const date = exifDate ?? todayStr();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const r = (e.target?.result as string).split(",")[1];
        if (r) resolve(r); else reject(new Error("읽기 실패"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type });

    let finalImageUrl = result.imageUrl;
    try {
      const croppedBlob = await smartCropToSquare(file, result.cropBox ?? { x: 0.5, y: 0.5 });
      const croppedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const r = (e.target?.result as string).split(",")[1];
          if (r) resolve(r); else reject();
        };
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });
      const cropResult = await uploadCroppedImage.mutateAsync({ imageBase64: croppedBase64, mimeType: "image/jpeg" });
      finalImageUrl = cropResult.imageUrl;
    } catch { /* 크롭 실패 시 원본 유지 */ }

    // 버그 #4: AI 카테고리 기반 자동 제목 생성
    const autoTitle = makeDefaultTitle(date, result.category);

    setQueue(prev => prev.map(it => it.id === itemId ? {
      ...it,
      status: "ready" as const,
      title: autoTitle,
      category: result.category,
      originalAmount: String(result.estimatedOriginalAmount),
      actualAmount: String(result.estimatedActualAmount),
      aiReason: result.reason,
      date,
      imageUrl: finalImageUrl,
    } : it));
  }, [analyzeImage, uploadCroppedImage]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;

    const newItems: QueueItem[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      status: "analyzing" as const,
      submitting: false, // 버그 #1: 개별 로딩 상태 초기화
      title: "", category: categoryNames[0] ?? "식비",
      originalAmount: "", actualAmount: "",
      aiReason: "", date: todayStr(), memo: "",
    }));

    setQueue(prev => [...prev, ...newItems]);

    newItems.forEach((item, idx) => {
      processFile(arr[idx], item.id).catch(() => {
        setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
      });
    });
  }, [processFile, categoryNames]);

  // ── 큐 아이템 등록 — 버그 #1: 개별 submitting 상태 사용 ──
  const handleQueueConfirm = async (item: QueueItem) => {
    if (!item.originalAmount || !item.actualAmount) {
      toast.error("원가와 실제 지출액을 입력해주세요");
      return;
    }
    // 해당 아이템만 submitting = true
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: true } : it));
    try {
      await createEntry.mutateAsync({
        date: item.date,
        title: item.title || item.fileName,
        category: item.category,
        originalAmount: Number(item.originalAmount),
        actualAmount: Number(item.actualAmount),
        aiEstimated: "yes",
        aiReason: item.aiReason,
        imageUrl: item.imageUrl,
        memo: item.memo || undefined,
      });
      toast.success(`✓ ${item.title || item.fileName} 등록됨`);
      setQueue(prev => {
        const it = prev.find(i => i.id === item.id);
        if (it) URL.revokeObjectURL(it.previewUrl);
        return prev.filter(i => i.id !== item.id);
      });
    } catch {
      toast.error("등록에 실패했습니다");
      // 실패 시 submitting 복원
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: false } : it));
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue(prev => {
      const it = prev.find(i => i.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const updateQueueItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  // ── 수동 등록 — 버그 #3: form onSubmit으로 Enter 제출 지원 ──
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.title || !manualForm.originalAmount || !manualForm.actualAmount) return;
    try {
      await createEntry.mutateAsync({
        date: manualForm.date,
        title: manualForm.title,
        category: manualForm.category,
        originalAmount: Number(manualForm.originalAmount),
        actualAmount: Number(manualForm.actualAmount),
        description: manualForm.description || undefined,
        memo: manualForm.memo || undefined,
        aiEstimated: "no",
      });
      toast.success("등록됐습니다");
      const d = todayStr();
      setManualForm({ date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" });
      setManualTitleEdited(false);
      setShowManual(false);
    } catch {
      toast.error("등록에 실패했습니다");
    }
  };

  // 버그 #4: 수동 입력 날짜/카테고리 변경 시 제목 자동 갱신 (userEdited 플래그 확인)
  const handleManualDateChange = (date: string) => {
    setManualForm(f => ({
      ...f,
      date,
      title: manualTitleEdited ? f.title : makeDefaultTitle(date, f.category),
    }));
  };

  const handleManualCategoryChange = (category: string) => {
    setManualForm(f => ({
      ...f,
      category,
      title: manualTitleEdited ? f.title : makeDefaultTitle(f.date, category),
    }));
  };

  // ── 인라인 수정 ──
  const startEdit = (entry: SavingsEntry) => {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      category: entry.category,
      originalAmount: String(entry.originalAmount),
      actualAmount: String(entry.actualAmount),
      memo: entry.memo ?? "",
      date: entry.date,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent, id: number) => {
    e.preventDefault(); // 버그 #3: form 제출로 Enter 키 지원
    if (!editForm) return;
    try {
      await updateEntry.mutateAsync({
        id,
        title: editForm.title,
        category: editForm.category,
        originalAmount: Number(editForm.originalAmount),
        actualAmount: Number(editForm.actualAmount),
        memo: editForm.memo || null,
        date: editForm.date,
      });
      toast.success("수정됐습니다");
      setEditingId(null);
      setEditForm(null);
    } catch {
      toast.error("수정에 실패했습니다");
    }
  };

  // ── Export ──
  const exportEntries = useMemo(
    () => filterByRange(entries as SavingsEntry[], exportRange, customFrom, customTo),
    [entries, exportRange, customFrom, customTo]
  );

  const handleCopyMd = async () => {
    const md = toMarkdownTable(exportEntries);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("복사에 실패했습니다. 직접 선택하여 복사해주세요.");
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleDownloadCsv = () => {
    const csv = toCsv(exportEntries);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = { all: "전체", month: "이번달", week: "이번주", custom: "기간" }[exportRange];
    a.download = `거지록_${label}_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 다운로드됩니다");
  };

  // ── 로그인 화면 ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-8 px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">거지록</h1>
          <p className="mt-2 text-sm text-gray-400">절약한 만큼 번다</p>
        </div>
        <a
          href={getLoginUrl()}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <LogIn size={16} />
          로그인
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto px-4 pb-16">

      {/* ── 헤더 ── */}
      <header className="pt-12 pb-6 text-center">
        <p className="text-[11px] font-mono text-gray-400 tracking-widest uppercase mb-2">거지록</p>
        <div className="text-5xl font-bold text-emerald-500 tabular-nums">
          {isLoading ? <span className="text-gray-200">₩ ···</span> : <>₩{fmt(totalProfit)}</>}
        </div>
        <p className="mt-2 text-xs text-gray-400">총 누적 수익 · {(entries as SavingsEntry[]).length}건</p>
      </header>

      {/* ── 탭 ── */}
      <div className="flex border-b border-gray-100 mb-6">
        {(["input", "calendar"] as MainTab[]).map(t => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              mainTab === t
                ? "text-emerald-600 border-b-2 border-emerald-500 -mb-px"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {{ input: "입력", calendar: "캘린더" }[t]}
          </button>
        ))}
      </div>

      {/* ── 입력 탭 ── */}
      {mainTab === "input" && (
        <>
          {/* 사진 업로드 영역 */}
          <section className="mb-6">
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-emerald-300 cursor-pointer transition-colors"
              onClick={() => galleryRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">사진을 업로드하면 AI가 원가를 추정합니다</p>
              <p className="text-xs text-gray-400 mt-1">여러 장 동시 선택 가능 · 드래그앤드롭</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:border-emerald-300 hover:text-emerald-600 transition-colors"
              >
                <Camera size={14} /> 카메라
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:border-emerald-300 hover:text-emerald-600 transition-colors"
              >
                <ImageIcon size={14} /> 앨범
              </button>
            </div>
          </section>

          {/* 업로드 큐 */}
          {queue.length > 0 && (
            <section className="mb-6 space-y-3">
              <p className="text-xs font-mono text-gray-400 tracking-widest uppercase">분석 대기열 ({queue.length})</p>
              {queue.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 분석 중 스켈레톤 */}
                  {item.status === "analyzing" && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg bg-gray-100 animate-pulse flex-shrink-0 overflow-hidden">
                        <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-50" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Loader2 size={12} className="animate-spin text-emerald-500" />
                          AI 분석 중...
                        </div>
                      </div>
                      <button onClick={() => removeQueueItem(item.id)} className="p-1 text-gray-300 hover:text-gray-500">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* 오류 */}
                  {item.status === "error" && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg bg-red-50 flex-shrink-0 overflow-hidden">
                        <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-40" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-red-500">분석 실패 — 직접 입력해주세요</p>
                        <p className="text-xs text-gray-400 truncate">{item.fileName}</p>
                      </div>
                      <button onClick={() => removeQueueItem(item.id)} className="p-1 text-gray-300 hover:text-gray-500">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* 분석 완료 — 수정 가능한 폼 */}
                  {item.status === "ready" && (
                    <div className="p-3 space-y-3">
                      <div className="flex items-start gap-3">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {/* 항목명 */}
                          <input
                            value={item.title}
                            onChange={e => updateQueueItem(item.id, { title: e.target.value })}
                            className="w-full text-sm font-medium text-gray-900 border-0 border-b border-gray-200 pb-0.5 focus:outline-none focus:border-emerald-400 bg-transparent"
                            placeholder="항목명"
                          />
                          {/* 날짜 + 카테고리 */}
                          <div className="flex gap-2 mt-1.5">
                            <input
                              type="date"
                              value={item.date}
                              onChange={e => updateQueueItem(item.id, { date: e.target.value })}
                              className="text-xs text-gray-500 border-0 border-b border-gray-100 focus:outline-none focus:border-emerald-300 bg-transparent w-28"
                            />
                            <select
                              value={item.category}
                              onChange={e => updateQueueItem(item.id, { category: e.target.value })}
                              className="text-xs text-gray-500 border-0 border-b border-gray-100 focus:outline-none focus:border-emerald-300 bg-transparent"
                            >
                              {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>

                      {/* 금액 */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">원가</label>
                          <input
                            type="number"
                            value={item.originalAmount}
                            onChange={e => updateQueueItem(item.id, { originalAmount: e.target.value })}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">실제 지출</label>
                          <input
                            type="number"
                            value={item.actualAmount}
                            onChange={e => updateQueueItem(item.id, { actualAmount: e.target.value })}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">수익</label>
                          <div className="text-xs font-semibold text-emerald-500 px-2 py-1.5">
                            {item.originalAmount && item.actualAmount
                              ? `+₩${fmt(Number(item.originalAmount) - Number(item.actualAmount))}`
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {/* 메모 */}
                      <input
                        value={item.memo}
                        onChange={e => updateQueueItem(item.id, { memo: e.target.value })}
                        placeholder="메모 (선택)"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                      />

                      {/* AI 근거 */}
                      {item.aiReason && (
                        <p className="text-[10px] text-gray-400 leading-relaxed">{item.aiReason}</p>
                      )}

                      {/* 버그 #1: item.submitting 으로 개별 로딩 */}
                      <button
                        onClick={() => handleQueueConfirm(item)}
                        disabled={item.submitting}
                        className="w-full py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {item.submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* 직접 입력 */}
          <section className="mb-6">
            <button
              onClick={() => setShowManual(v => !v)}
              className="w-full flex items-center justify-between py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-1.5"><PenLine size={14} /> 직접 입력</span>
              {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* 버그 #3: form 태그 + type="submit" 으로 Enter 키 제출 지원 */}
            {showManual && (
              <form onSubmit={handleManualSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">날짜</label>
                    <input type="date" value={manualForm.date}
                      onChange={e => handleManualDateChange(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">카테고리</label>
                    <select value={manualForm.category}
                      onChange={e => handleManualCategoryChange(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white">
                      {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">항목명</label>
                  <input type="text" value={manualForm.title}
                    onChange={e => {
                      setManualTitleEdited(true);
                      setManualForm(f => ({ ...f, title: e.target.value }));
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">원가 (원)</label>
                    <input type="number" placeholder="9000" value={manualForm.originalAmount}
                      onChange={e => setManualForm(f => ({ ...f, originalAmount: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">실제 지출 (원)</label>
                    <input type="number" placeholder="3000" value={manualForm.actualAmount}
                      onChange={e => setManualForm(f => ({ ...f, actualAmount: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">메모 (선택)</label>
                  <input type="text" placeholder="메모를 남겨보세요" value={manualForm.memo}
                    onChange={e => setManualForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                </div>
                {manualForm.originalAmount && manualForm.actualAmount && (
                  <p className="text-xs text-emerald-600 font-medium">
                    수익: +₩{fmt(Number(manualForm.originalAmount) - Number(manualForm.actualAmount))}
                  </p>
                )}
                <button type="submit" disabled={createEntry.isPending}
                  className="w-full py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                  {createEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                </button>
              </form>
            )}
          </section>

          {/* 기록 목록 */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-mono text-gray-400 tracking-widest uppercase">기록</h2>
              <span className="text-xs text-gray-400">{(entries as SavingsEntry[]).length}건</span>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (entries as SavingsEntry[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">아직 기록이 없습니다</p>
            ) : (
              <div className="space-y-1">
                {(entries as SavingsEntry[]).map(entry => (
                  <div key={entry.id}>
                    {/* 일반 행 */}
                    {editingId !== entry.id && (
                      <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                        {entry.imageUrl
                          ? <img src={entry.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                          {entry.memo && <p className="text-xs text-gray-400 truncate mt-0.5 italic">{entry.memo}</p>}
                        </div>
                        {/* 버그 #2: 원가(취소선) → 실제지출 나란히 + 절약수익 */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-mono font-semibold text-emerald-500">+₩{fmt(entry.profit)}</p>
                          <p className="text-xs text-gray-400 tabular-nums">
                            <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                            <span className="mx-1 text-gray-300">→</span>
                            <span className="text-gray-600">₩{fmt(entry.actualAmount)}</span>
                          </p>
                        </div>
                        <button onClick={() => setStoryEntry(entry)}
                          className="p-1.5 text-gray-300 hover:text-emerald-500 transition-colors flex-shrink-0">
                          <Share2 size={13} />
                        </button>
                        <button onClick={() => startEdit(entry)}
                          className="p-1.5 text-gray-300 hover:text-emerald-500 transition-colors flex-shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`"${entry.title}" 기록을 삭제할까요?`)) deleteEntry.mutate({ id: entry.id }); }}
                          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {/* 인라인 수정 폼 — 버그 #3: form 태그로 감싸서 Enter 키 제출 지원 */}
                    {editingId === entry.id && editForm && (
                      <form
                        onSubmit={e => handleEditSubmit(e, entry.id)}
                        className="border border-emerald-200 rounded-xl p-3 my-1 space-y-2 bg-emerald-50/30"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">날짜</label>
                            <input type="date" value={editForm.date}
                              onChange={e => setEditForm(f => f ? { ...f, date: e.target.value } : f)}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">카테고리</label>
                            <select value={editForm.category}
                              onChange={e => setEditForm(f => f ? { ...f, category: e.target.value } : f)}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white">
                              {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">항목명</label>
                          <input value={editForm.title}
                            onChange={e => setEditForm(f => f ? { ...f, title: e.target.value } : f)}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">원가</label>
                            <input type="number" value={editForm.originalAmount}
                              onChange={e => setEditForm(f => f ? { ...f, originalAmount: e.target.value } : f)}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">실제 지출</label>
                            <input type="number" value={editForm.actualAmount}
                              onChange={e => setEditForm(f => f ? { ...f, actualAmount: e.target.value } : f)}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">메모</label>
                          <input value={editForm.memo}
                            onChange={e => setEditForm(f => f ? { ...f, memo: e.target.value } : f)}
                            placeholder="메모 (선택)"
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={updateEntry.isPending}
                            className="flex-1 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                            {updateEntry.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "저장"}
                          </button>
                          <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }}
                            className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            취소
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export */}
          <section className="mb-6">
            <button onClick={() => setShowExport(v => !v)}
              className="w-full flex items-center justify-between py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <span className="flex items-center gap-1.5"><Download size={14} /> 데이터 내보내기</span>
              {showExport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showExport && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">기간 선택</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "month", "week", "custom"] as ExportRange[]).map(r => (
                      <button key={r} onClick={() => setExportRange(r)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          exportRange === r ? "bg-emerald-500 text-white border-emerald-500" : "border-gray-200 text-gray-500 hover:border-emerald-300"
                        }`}>
                        {{ all: "전체", month: "이번 달", week: "이번 주", custom: "직접 선택" }[r]}
                      </button>
                    ))}
                  </div>
                  {exportRange === "custom" && (
                    <div className="flex gap-2 mt-2">
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" />
                      <span className="text-xs text-gray-400 self-center">~</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" />
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">
                    {exportEntries.length}건 · 수익{" "}
                    <span className="font-semibold text-emerald-600">₩{fmt(exportEntries.reduce((s, e) => s + e.profit, 0))}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyMd} disabled={exportEntries.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm border border-gray-200 rounded-lg hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 transition-colors">
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    Notion MD 복사
                  </button>
                  <button onClick={handleDownloadCsv} disabled={exportEntries.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm border border-gray-200 rounded-lg hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 transition-colors">
                    <Download size={14} />
                    CSV 다운로드
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── 캘린더 탭 ── */}
      {mainTab === "calendar" && (
        <section className="mb-6">
          <MiniCalendar entries={entries as SavingsEntry[]} />
        </section>
      )}

      {/* 푸터 */}
      <footer className="text-center pb-4">
        <p className="text-xs text-gray-300">거지답게 아꼈서 벌었다</p>
      </footer>

      {/* 스토리 카드 모달 */}
      {storyEntry && (
        <SavingsStoryCard
          entry={storyEntry}
          onClose={() => setStoryEntry(null)}
        />
      )}

      {/* hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
