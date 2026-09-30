# 쉐어마켓 — 우리 동네 학생 공동구매

Next.js 14 + TypeScript + Tailwind + Supabase. 같은 동네 학생끼리 대용량 상품을 소분해서 사는 매칭 서비스.

## 1. Supabase 준비
1. https://supabase.com 에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` → `supabase/seed.sql` 순서로 실행 (상품 12종, 지역 3곳, 수령 장소 포함)
3. Authentication → Providers → Email 활성화 (테스트 중엔 "Confirm email" 끄면 편함)
4. Project Settings → API에서 URL, anon key, service_role key 복사

## 2. 로컬 실행
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm test                     # 매칭 로직 테스트
npm run dev                  # http://localhost:3000
```
가입 후 SQL Editor에서 관리자 지정: `update users set is_admin = true where nickname = '내닉네임';`

## 3. 환경변수
| 이름 | 설명 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | anon(public) 키 |
| SUPABASE_SERVICE_ROLE_KEY | service_role 키 — 서버 전용, 절대 공개 금지 |

## 4. Vercel 배포
1. 이 폴더를 GitHub에 push (`node_modules`, `.env.local`은 .gitignore로 제외됨)
2. vercel.com → Add New Project → 저장소 선택 → 환경변수 3개 입력 → Deploy
3. 발급된 `https://xxx.vercel.app` 주소를 공유하면 끝
4. Supabase → Authentication → URL Configuration의 Site URL에 배포 주소 등록

## 동작 방식
- 신청 시 `/api/match` 호출 → `lib/matching.ts`가 (상품, 지역)별 대기열에서 마감 임박순·거리순으로 총량을 정확히 채우는 조합을 찾아 그룹 확정
- 마감 지난 미충족 요청은 자동 취소. `vercel.json`의 Cron이 매시간 정리 (Hobby 플랜은 하루 1회 제한이 있어 필요 시 스케줄 조정)
- 그룹 확정 시 Supabase Realtime으로 참여자에게 즉시 알림, 개별 결제 금액·수령 장소/시간 표시

## MVP 이후(2단계)
토스페이먼츠 실결제, 수요예측/추천, 마트 제휴 정산, 카카오 로그인, 수령 장소·시간 선택 UI
