# DESIGN.md — 거지로그 디자인 시스템

> 이 파일은 거지로그 UI의 **단일 기준(SSOT)**이다. AI 코딩 툴(Claude·Cursor·v0)과 사람이 화면을 만들 때 **항상 먼저 읽는다.**
> 토큰 실제 구현체: `client/src/index.css`. 값이 충돌하면 index.css가 우선이고 이 문서를 맞춘다.
> 스택: React 19 + Tailwind v4 + tRPC · **모바일 우선**.

---

## 0. 한 줄 정체성

지출이 아니라 **'번 돈(절약)'을 적는 가계부**. 적을수록 나를 아는 회계 담당(캐릭터)이 생긴다.
톤 = **따뜻한 종이 질감 + 골드 포인트**, 절약을 '수익'으로 보는 **에메랄드** 정체성.

---

## 1. 디자인 원칙 (5)

1. **토큰만 쓴다.** 색·크기·반경은 전부 토큰. 하드코딩 hex 금지. (유일한 예외: 캡처용 공유 카드 → 7번)
2. **모바일 우선.** 본문 폭 ≤ 32rem, 높이 100dvh, safe-area 존중. hover 스타일 금지 → `:active` 피드백(scale 0.96).
3. **돈은 또렷하게.** 모든 금액·숫자는 JetBrains Mono + `tabular-nums`. 수익(번 돈)은 **에메랄드**, 절대 빨강 아님.
4. **모션은 절제.** 산발적 효과 대신 화면당 임팩트 1회(탭 전환·저장 리빌). 기본 0.18~0.35s, ease.
5. **차분한 종이 위 골드.** 크림 배경/종이 질감이 기본. 골드는 캐릭터·프리미엄에만. 다크 포레스트는 무대·저장카드 대비용.

---

## 2. 색 (Color)

브랜드 토큰 — `index.css @theme`에 정의, **Tailwind 클래스로 사용**.

| 토큰 | 값 | 클래스 예 | 용도 |
|---|---|---|---|
| cream | `#FAF8F3` | `bg-cream` | 앱 전체 배경 |
| ink | `#1A1A17` | `text-ink` | 본문 차콜 |
| ink-soft | `#8A857B` | `text-ink-soft` | 보조·캡션 |
| ink-faint | `#B8B2A6` | `text-ink-faint` | 흐림·플레이스홀더 |
| line | `#EFE9DC` | `border-line` | 보더·구분선 |
| gold | `#E0A92E` | `text-gold` | 회장님·캐릭터 음성·프리미엄 |
| forest | `#16201A` | `bg-forest` | 저장카드·온보딩 다크그린 |
| emerald | `#10B981` (Tailwind emerald-500) | `text-emerald-500` | 주요 액션·수익(번 돈) |
| butler / butler-line | `#FBF7EE` / `#EFE4CD` | `bg-butler` | 회시생(구 김집사) 골드틴트 카드 |

**규칙:** 수익 = emerald · 프리미엄/캐릭터 = gold · 빨강(destructive)은 진짜 에러·삭제에만. 회색이 필요하면 ink-soft / ink-faint를 쓴다.
(shadcn 토큰 `--primary` 등 oklch 값은 `components/ui/**` 전용 — 건드리지 않는다.)

---

## 3. 타이포 (Typography)

폰트: 본문 **Pretendard**(한글)·**Inter**(영문), 숫자/금액 **JetBrains Mono**.
5단계 스케일 (9px 이하 금지, 본문 14px 기준):

| 토큰 | 크기 | 클래스 | 용도 |
|---|---|---|---|
| micro | 11px | `text-micro` | 라벨 최소·칩 |
| caption | 12px | `text-caption` | 캡션·보조 |
| body | 14px | `text-body` | 본문 기본 |
| title | 17px | `text-title` | 카드 제목·이름 |
| hero | 28px | `text-hero` | 큰 +수익 숫자 |

제목은 `letter-spacing: -0.02em`, weight 600. 금액 강조는 `.profit-hero`(에메랄드 그라데이션 텍스트).

---

## 4. 간격·반경·표면

- **반경:** 카드 `rounded-card`(16px) · 칩/버튼 `rounded-full` · 바텀시트 상단 24px.
- **간격:** Tailwind 기본 4px 그리드. 카드 내부 패딩 12~16px, 섹션 간 10~16px.
- **표면 클래스** (`@layer components`):
  - `.surface-elevated` — 흰 카드 + line 보더 + 옅은 그림자 (기본 카드)
  - `.surface-paper` — 한지 느낌(`#FFFEF9`), 서재·쪽지
  - `.surface-glass` — 반투명 + blur, 탭바·플로팅 칩
  - `.texture-paper` — 3.5% 종이 노이즈(과하지 않게)
  - `.page-shell` — 크림 배경 페이지 루트

---

## 5. 컴포넌트 패턴

재사용 클래스 (`index.css @layer components`). 신규 컴포넌트는 아래 패턴+토큰을 재사용한다.

- **버튼:** `.btn-primary` — 에메랄드 그라데이션 pill, `:active` scale 0.96
- **세그먼트:** `.segment-track` + `.segment-active`(active = ink 배경/흰 글씨) — `[주간|월간|전체]` 류 토글
- **칩:** `.ledger-chip` + `-gold` / `-muted` / `-emerald(-active)` — 카테고리=emerald, 수익원=gold로 구분
- **입력:** `.input-field` — line 보더, focus 시 에메랄드
- **카드:** `.ledger-entry-row`(장부 항목) · `.ledger-hero`(수익 히어로) · `.home-ip-beat`(책상 메모)
- **바텀시트:** `.sheet-panel` — 위로 둥근 모서리 + 상단 그림자
- **음성:** `.voice-label`(gold, 캐릭터 발화 라벨) · `SpeakerBadge`(speaker = `dosa` | `cpa` | `ssal`)

실제 구현은 `client/src/components/` 참조 (BottomNav, EntryDetailSheet, ShareCardSheet 등).

---

## 6. 모션

| 이름 | 시간 | 용도 |
|---|---|---|
| `tab-in` | 0.18s | 탭 전환 (fill 없음 — 오버레이 가림 방지) |
| `bubble-in` | 0.26s | 말풍선 팝인 |
| `fade-up` | 0.35s | 콘텐츠 부드러운 등장 |
| `prop-in` | 0.7s | 소품 해금 통통 |

원칙: **화면당 임팩트 1회.** 무한 루프·과한 패럴럭스 금지.

---

## 7. 특수 규칙 (어기면 깨진다)

1. **캡처 안전.** '이미지로 저장' 대상(ShareCardSheet · ReportShareCard · cardSkin · SavingsStoryCard)은 **인라인 hex/SVG/텍스트만**. CSS 변수·외부 이미지·웹폰트 의존 금지(html2canvas가 못 읽음). **여기만 하드코딩 hex 허용.**
2. **집무실 LCD = 이번 달 수익 상시 표시** (emerald `+` 프리픽스). 쪽지·푸시·말풍선에는 금액 금지 유지.
3. **수익 색 = emerald 고정.** 빨강으로 바꾸지 않는다(절약=수익 정체성).

---

## 8. 건드리면 안 되는 것 (Frozen)

- `components/ui/**` (shadcn 원본), `lib/trpc.ts` — **수정 금지.**
- 동면(배선 없음, 삭제 금지): `Jarureu.tsx`, `SavingsStoryCard.tsx`.

---

## 9. AI에게 지시할 때

1. **"DESIGN.md 따라"** 한 줄로 시작 → 토큰·패턴 자동 적용.
2. 새 화면은 **목적 · 콘텐츠 · 상태(빈/로딩/에러/과다)**부터 적는다.
3. 미감 4차원(서체·색·모션·배경)은 이 문서가 이미 고정 — 벗어나려면 명시한다.
4. 결과는 **스크린샷으로 확인 후 구체적으로** 피드백한다.
