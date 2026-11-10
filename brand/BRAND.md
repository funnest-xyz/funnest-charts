# Funnest 브랜드 가이드 (v0 시안)

## 로고
- **마크**: 둥근 사각형(보라 그라디언트) 위에 *웃는 입 = 오르는 가격선*, 끝점은 노란 점(최고점, "-est").
  "Fun"(웃음) + "-est"(가장 높은 곳)를 한 획으로 표현.
- 파일
  - `logo-mark.svg` — 기본 마크 (앱 아이콘, 파비콘, 차트 귀속 배지)
  - `logo-mark-mono.svg` — 단색(`currentColor`), 다크/라이트 어디서나
  - `logo-wordmark.svg` — 마크 + `funnest` 워드마크 (소문자, ExtraBold)
  - `avatar.svg`, `avatar-512.png`, `avatar-1024.png` — 배경을 꽉 채운 프로필 사진용 (GitHub 조직, npm, Vercel, SNS)
- 최소 크기: 마크 16px. 여백: 마크 높이의 25% 이상.

## 색상
| 이름 | HEX | 용도 |
|---|---|---|
| Funnest Violet | `#6C4DFF` | 주 색상, 버튼, 링크 |
| Violet Light | `#8B6CFF` | 그라디언트 시작, 호버 |
| Violet Deep | `#5A3BF0` | 그라디언트 끝, 눌림 |
| Peak Yellow | `#FFD43B` | 포인트(최고점), 하이라이트 — 남용 금지 |
| Ink | `#14121F` | 본문 텍스트, 다크 배경 |
| Paper | `#FAFAFC` | 라이트 배경 |

차트의 상승/하락 색(한국식 빨강/파랑)과 겹치지 않도록 브랜드 색은 보라·노랑만 씁니다.

## 서체
- 한글: Pretendard / 영문: Inter (둘 다 OFL, 무료)
- 워드마크는 항상 소문자 `funnest`.

## 차트 귀속 배지
라이브러리 위젯(`@funnest/charts-ui`)은 차트 왼쪽 아래에 마크 배지를 기본 표시합니다.
`attribution: false`로 끌 수 있지만, 무료 사용 시 켜두기를 권장합니다(README의 Attribution 참고).

> 마스코트는 이 마크(웃는 차트)를 캐릭터화하는 방향을 추천 — 일러스트는 전문 디자이너 작업 권장.
