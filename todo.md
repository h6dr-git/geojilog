# 거지로그 V2 — TODO

## V2 리팩토링 (진행 중)
- [x] 기존 SNS 피드 UI 제거 (Home.tsx 전면 재작성)
- [x] 불필요한 컴포넌트 삭제 (파일은 유지, Home.tsx에서 미사용 - 크레딧 절약)
- [x] App.tsx 라우팅 단순화 (단일 페이지)
- [x] 단일 페이지 레이아웃 구현
  - [x] 상단: 거지로그 V2 로고 + 총 누적 절약 수익 크게 표시
  - [x] 중앙: 사진 업로드 영역 (AI 분석 + 원가/실제지출 즉시 노출)
  - [x] 하단: 수동 입력 폼
  - [x] 기록 목록 (삭제 가능)
- [x] Export 기능 구현
  - [x] 기간 선택 (전체 / 이번 달 / 이번 주 / 직접 선택)
  - [x] Notion용 MD 테이블 클립보드 복사
  - [x] CSV 다운로드
- [x] 미니멀 디자인 적용 (에메랄드 그린 포인트 컬러, 여백+폰트 위계)

## 기존 완료 기능 (백엔드 유지)
- [x] Gemini Vision AI 이미지 분석 (tRPC ai.analyzeImage)
- [x] 스마트 크롭 + S3 저장 (ai.uploadImage)
- [x] EXIF 날짜 추출
- [x] 카드 문자 파싱 (ai.parseSmsText)
- [x] savings CRUD (tRPC savings.list/create/update/delete)
- [x] 카테고리 CRUD (tRPC categories.list/create/delete/rename)
- [x] DB 스키마 (savings_entries, user_categories)

## V2.1 기능 추가 (진행 중)
- [x] DB 스키마 memo 필드 추가 및 마이그레이션
- [x] tRPC create/update 프로시저에 memo 필드 지원
- [x] AI 분석 결과를 수정 가능한 Input 폼으로 렌더링 (원가/실제지출/항목명/메모 수정 가능)
- [x] 다중 업로드 큐 UI (병렬 AI 분석, 스피너/스켈레톤, 완료 순 노출)
- [x] 기록 목록에 Edit 버튼 추가 (인라인 수정 폼)
- [x] 미니멀 월간 캘린더 뷰 (기록 있는 날짜에 절약 수익 에메랄드 텍스트 표기)

## V2.1 QA 버그 수정 (진행 중)
- [x] 다중 업로드 큐 개별 로딩 상태 분리 (submitting 필드)
- [x] 기록 리스트 금액 UI: 원가(취소선) → 실제지출 나란히 표기
- [x] 직접 입력 폼 Enter 키 제출 (type="submit" 확인)
- [x] 인라인 수정 폼 Enter 키 제출 (form 태그로 감싸기)
- [x] 제목 자동 네이밍: MM.DD.(요일) 카테고리 포맷 (userEdited 플래그)

## 스토리 카드 피드백 반영 (진행 중)
- [x] 공유 전 텍스트 편집 (항목명/메모 인라인 수정 → 원본 기록에도 반영)
- [x] 사진 디자인 개선 (사진 풀스크린 배경 + 그라디언트 오버레이 + 하단 카드 융화)
- [x] AI 코멘트 처리 (첫 문장 50자 요약으로 축소, 없으면 미표시)
