import { useState, useMemo, useRef } from "react";
import { Loader2, Download, ChevronDown, X, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { SavingsEntry, fmt, todayStr, KO_DAYS } from "@/lib/ledger";

type DetailMode = "day" | "week" | "month";

export default function MiniCalendar({ entries }: { entries: SavingsEntry[] }) {
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

  // [작업3] 월간 앨범 — 사진 있는 기록만(포토덤프) + 이미지로 저장
  const monthPhotos = useMemo(() => monthEntries.filter(e => e.imageUrl), [monthEntries]);
  const monthTotal = useMemo(() => monthEntries.reduce((s, e) => s + e.profit, 0), [monthEntries]);
  const albumRef = useRef<HTMLDivElement>(null);
  const [savingAlbum, setSavingAlbum] = useState(false);

  const handleSaveAlbum = async () => {
    if (!albumRef.current) return;
    setSavingAlbum(true);
    try {
      // 캡처 전 폰트 로딩 보장 — 한글(Pretendard)이 폴백으로 박히는 것 방지
      try {
        if (document.fonts) {
          await document.fonts.ready;
          await document.fonts.load("700 20px Pretendard").catch(() => {});
        }
      } catch { /* 폰트 API 미지원 시 무시 */ }
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(albumRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#16201A", logging: false,
      });
      const a = document.createElement("a");
      a.download = `geojilog_${year}.${String(month + 1).padStart(2, "0")}_album.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      /* 캡처 실패 시 조용히 무시 */
    } finally {
      setSavingAlbum(false);
    }
  };

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
                    +₩{fmt(monthTotal)}
                  </span>
                </div>

                {/* [작업3] 월간 앨범 — 포토덤프 3-col + 월 합계 + 이미지로 저장 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400 tracking-widest uppercase">앨범</span>
                    <button
                      onClick={handleSaveAlbum}
                      disabled={savingAlbum}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                    >
                      {savingAlbum ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      이미지로 저장
                    </button>
                  </div>
                  <div ref={albumRef} style={{ backgroundColor: "#16201A", padding: "18px", borderRadius: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "14px" }}>
                      <div>
                        <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#7E8C82", textTransform: "uppercase", marginBottom: "3px" }}>거지로그</div>
                        <div style={{ fontSize: "17px", fontWeight: 700, color: "#F4EFE3" }}>{year}.{String(month + 1).padStart(2, "0")} 앨범</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "9px", color: "#7E8C82", marginBottom: "2px" }}>{monthEntries.length}건 지켜냄</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#10B981", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>+₩{fmt(monthTotal)}</div>
                      </div>
                    </div>
                    {monthPhotos.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                        {monthPhotos.map(e => (
                          <img
                            key={e.id}
                            src={e.imageUrl!}
                            crossOrigin="anonymous"
                            alt=""
                            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "8px", display: "block" }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#7E8C82", textAlign: "center", padding: "24px 0" }}>이 달엔 사진 기록이 없어요</div>
                    )}
                    <div style={{ textAlign: "center", fontSize: "8px", color: "#5E6A60", letterSpacing: "2px", marginTop: "14px" }}>GEOJILOG · {year}{String(month + 1).padStart(2, "0")}</div>
                  </div>
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
