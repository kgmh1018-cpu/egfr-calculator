# CLAUDE.md — eGFR 계산기 프로젝트 컨텍스트

## 프로젝트 개요
CKD-EPI 2021 공식 기반 eGFR 계산기 + CKD 단계별 신장 위험 약물 안내 웹앱.
순수 바닐라 JS / CSS / HTML. 빌드 도구 없음. 외부 의존성 없음.

## 파일 구조
```
index.html   — 전체 레이아웃 및 DOM 구조
style.css    — 모든 스타일 (다크 테마 기반)
app.js       — 계산 로직, UI 렌더링, 이벤트 핸들링
data.js      — STAGES 배열, DRUGS 배열, CATS 배열 (약물 데이터)
```

## 핵심 데이터 구조

### STAGES (data.js)
CKD 단계 G1~G5. 각 항목: `id, min, max, rep, label, range, color, desc`

### DRUGS (data.js)
약물 위험 목록. 각 항목:
- `cat` — 카테고리 (CATS 배열 중 하나)
- `imp` — 중요 약물 여부 (boolean)
- `name` — 약물명
- `ci_at` — 금기 GFR 기준값
- `ca_at` — 주의 GFR 기준값
- `threshold` — 표시용 기준 문자열
- `reason` — 위험 이유 설명
- `alts` — 대체 약물 배열

### CATS (data.js)
`['혈당강하제', '진통소염제', '항생제', '심혈관계', '조영제', '항응고제', '기타']`

## 주요 로직 (app.js)
- CKD-EPI 2021 공식으로 sCr → eGFR 계산
- eGFR 슬라이더 ↔ sCr 슬라이더 양방향 연동
- 현재 eGFR 기준으로 약물을 `safe / caution / contraindicated` 3단계로 분류
- 카테고리 필터 탭, 중요약물 체크박스, 안전한약 보기 체크박스
- 모바일: 입력·결과 탭 / 약물위험 탭 전환

## 개발 규칙
- 빌드 없이 브라우저에서 직접 실행 가능한 구조 유지
- data.js는 순수 데이터만, 로직은 app.js에
- 새 약물 추가 시 DRUGS 배열에 항목 추가만 하면 자동 반영
- 스타일은 CSS 변수 기반 (`style.css` 상단 `:root` 참고)

## 배포
GitHub Pages (main 브랜치 / root)
