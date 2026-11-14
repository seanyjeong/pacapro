# 새 디자인 기준 (2026-11, 토스·당근 같은 앱 느낌)

사장님 결정: "토스·당근 같은 앱 느낌", "배치까지 새로, 기능은 그대로". 지금 버전 백업 태그는 `pre-redesign-20261114-*`.

## 원칙

1. **기능·데이터·API 는 그대로.** 바꾸는 것은 겉모습과 화면 배치뿐이다. 버튼이 하던 일, 보내는 요청, 검증, 권한 검사, 문구의 뜻을 바꾸지 않는다. 필드·버튼을 없애지 않는다(숨겨진 곳으로 옮기는 것은 괜찮다).
2. **회색 바탕 위 흰 카드.** 화면 바탕은 `bg-background`(#F2F4F6), 묶음은 `rounded-2xl bg-card`. 카드 안의 옅은 칸은 `bg-muted`. 테두리 선(`border`)은 표·입력칸 구분처럼 꼭 필요할 때만, `border-border/60` 정도로 옅게. 그림자 쓰지 않는다(떠 있는 메뉴·대화상자만).
3. **큰 숫자, 굵은 제목, 짧은 문장.** 화면 제목 `PageHeader`(26~28px extrabold). 숫자는 `font-extrabold tabular-nums`. 영어 소제목(…Desk) 쓰지 않는다. 안내 문장은 "~해요/~예요" 말투로 짧게(기존 문장을 바꿀 때만; 뜻은 그대로).
4. **색은 토큰만.** `text-foreground`(본문) / `text-secondary-foreground`(덜 중요한 본문) / `text-muted-foreground`(설명·라벨) / `bg-primary`·`text-primary`·`bg-primary-soft` / `success`·`warning`·`destructive` 와 각 `-soft`. `slate-`, `gray-`, `blue-600` 같은 직접 색 금지(차트·브랜드 색 같은 장식 예외). 다크 모드는 토큰이 알아서 바뀌므로 `dark:` 색 클래스를 따로 쓰지 않는다.
5. **모서리**: 카드 `rounded-2xl`, 버튼·입력·칩 안 칸 `rounded-xl`, 작은 배지 `rounded-full`.
6. **간격**: 화면 세로 묶음 `space-y-4`, 카드 안 `p-5 sm:p-6`, 카드 사이 `gap-3`~`gap-4`.
7. **휴대폰 먼저 확인.** 390 폭에서 가로로 넘치지 않게(표는 카드 안에서 `overflow-x-auto`, 또는 휴대폰에서 목록형으로). 휴대폰 아래 탭(60px)이 내용을 가리지 않는다(레이아웃이 아래 여백을 이미 줌).

## 공통 부품 (`@/components/ui/...`)

| 부품 | 쓰는 곳 |
|---|---|
| `PageHeader({ title, description, actions })` (`page.tsx`) | 모든 화면 맨 위. 주요 버튼은 actions 에(주 동작 1개만 `variant="default"`, 나머지 `outline`(회색)·`secondary`(옅은 파랑)). |
| `SectionCard({ title, description, actions })` | 화면 안 묶음. 옛 `Card+CardHeader+CardContent` 를 바꿔도 되고 그대로 써도 된다(Card 도 새 모양). |
| `StatTile({ label, value, note, tone, icon, onClick })` | 숫자 요약(총 청구·미납·출석 수 등). 2~4칸 grid(`grid-cols-2 lg:grid-cols-4 gap-3`). |
| `ListRow({ icon, tone, title, detail, trailing, onClick })` | 목록 한 줄(동그란 옅은 색 아이콘 + 제목 + 설명 + 오른쪽 값 + 화살표). 줄 사이 `divide-y divide-border/60`. |
| `EmptyState({ icon, title, description })` | 빈 목록. |
| `Button` | `default`(파랑 채움) / `outline`(회색 채움 — 이름만 outline) / `secondary`(옅은 파랑) / `ghost` / `destructive`. 크기 `sm`(36) `default`(44) `lg`(56) `icon`. |
| `Input`·`Select`·`Textarea` | 회색 채운 칸(테두리 없음, 누르면 파란 테두리). 흰 카드 안에서 쓴다. |
| `Badge` | 옅은 색 알약: default(파랑)·secondary(회색)·success·warning·destructive. |
| `Tabs` | 회색 통 안의 흰 알약(세그먼트). |
| `BranchChecks` | 지점 칩(전체 지점 + 지점들). 체크 상자 대신. |

## 화면 배치 규칙

- 맨 위: `PageHeader` → (있으면) 지점 칩 → 숫자 요약 `StatTile` 줄 → 본문 카드.
- **같은 숫자를 두 번 보여 주지 않는다**(예: 학원비 화면 오른쪽 "수납 작업 보드"가 위 요약 숫자를 되풀이 → 하나로 합친다. 버튼은 PageHeader actions 로).
- 검색·필터는 본문 카드 맨 위 한 줄(검색칸 + 칩/선택). 필터 묶음을 따로 상자로 띄우지 않는다.
- 표: 카드 안에 넣고, 머리줄은 `text-[13px] font-semibold text-muted-foreground`, 줄은 `border-b border-border/60`, 줄 높이 넉넉히(`py-3.5`). 정렬 화살표 등 기능 유지.
- 상태 표시는 옅은 색 배지(`Badge`).
- 대화상자(`Dialog`)는 휴대폰에서 아래에서 올라오는 시트로 자동으로 보인다. 안의 버튼은 휴대폰에서 꽉 차게(`w-full sm:w-auto`).
- 아이콘은 lucide 18~20px, 색은 `text-muted-foreground` 또는 tone 원 안.

## 하지 말 것

- API 호출·상태 관리·검증 로직 변경, 필드·기능 제거, 라우트 변경.
- 새 라이브러리 추가.
- `uppercase` 영어 라벨, 진한 테두리 상자, `shadow-sm` 카드, 화면마다 다른 색.
- 테스트 id(`data-testid`)·`aria-label` 지우기(유지하거나 더 정확하게).

## 참고 구현

- 대시보드: `src/features/dashboard/*` (PageHeader + 칩 + StatTile + SectionCard/ListRow).
- 앱 뼈대: `src/components/layout/*`.
