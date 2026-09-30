// 쉐어마켓 매칭 엔진 (순수 함수: DB/네트워크 의존 없음 → 서버/크론/테스트 어디서든 사용)
export interface Product {
  id: string;
  totalUnits: number; // 총량 ÷ 소분 단위 (예: 계란 30구, 소분 10구 → 3)
}
export interface MatchRequest {
  id: string;
  userId: string;
  productId: string;
  regionId: string;
  qty: number; // 소분 단위 개수
  deadline: Date;
  distanceM: number; // 수령 장소까지 거리(m)
}
export interface MatchedGroup {
  productId: string;
  regionId: string;
  requestIds: string[];
  totalQty: number;
}
export interface MatchResult {
  groups: MatchedGroup[];
  expired: string[]; // 마감 지나 미충족 또는 잘못된 수량 → 자동 취소 대상
  waiting: string[]; // 아직 대기
}

/** 우선순위: 마감 임박순 → 거리순 → id(결정성 보장) */
export const byPriority = (a: MatchRequest, b: MatchRequest) =>
  a.deadline.getTime() - b.deadline.getTime() ||
  a.distanceM - b.distanceM ||
  a.id.localeCompare(b.id);

/**
 * 우선순위 순 목록에서 합이 정확히 capacity인 부분집합을 찾는다.
 * 사전식 최선: 앞선(급한/가까운) 요청을 가능한 한 포함한다.
 * suffix 도달가능 합 DP로 가지치기 → O(n·capacity).
 */
export function findBestSubset(list: MatchRequest[], capacity: number): MatchRequest[] | null {
  const n = list.length;
  const reach: boolean[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(false));
  reach[n][0] = true;
  for (let i = n - 1; i >= 0; i--) {
    for (let s = 0; s <= capacity; s++) {
      reach[i][s] = reach[i + 1][s] || (s >= list[i].qty && reach[i + 1][s - list[i].qty]);
    }
  }
  if (!reach[0][capacity]) return null;
  const picked: MatchRequest[] = [];
  let need = capacity;
  for (let i = 0; i < n && need > 0; i++) {
    const q = list[i].qty;
    if (q <= need && reach[i + 1][need - q]) {
      picked.push(list[i]);
      need -= q;
    }
  }
  return picked;
}

/** 한 상품·한 지역의 대기열에서 가능한 모든 그룹을 만든다. */
export function matchQueue(product: Product, queue: MatchRequest[], now: Date): MatchResult {
  const isValid = (r: MatchRequest) => r.qty > 0 && r.qty <= product.totalUnits;
  const live = queue.filter((r) => isValid(r) && r.deadline.getTime() > now.getTime()).sort(byPriority);
  let pool = live;
  const groups: MatchedGroup[] = [];

  for (;;) {
    const subset = findBestSubset(pool, product.totalUnits);
    if (!subset) break;
    const ids = new Set(subset.map((r) => r.id));
    groups.push({
      productId: product.id,
      regionId: subset[0].regionId,
      requestIds: subset.map((r) => r.id),
      totalQty: product.totalUnits,
    });
    pool = pool.filter((r) => !ids.has(r.id));
  }

  const expired = queue
    .filter((r) => !isValid(r) || r.deadline.getTime() <= now.getTime())
    .map((r) => r.id);
  return { groups, expired, waiting: pool.map((r) => r.id) };
}

/** 여러 상품·지역이 섞인 전체 대기열을 (상품, 지역)별로 나눠 매칭 */
export function matchAll(products: Product[], requests: MatchRequest[], now: Date): MatchResult {
  const out: MatchResult = { groups: [], expired: [], waiting: [] };
  for (const p of products) {
    const byRegion = new Map<string, MatchRequest[]>();
    for (const r of requests.filter((r) => r.productId === p.id)) {
      byRegion.set(r.regionId, [...(byRegion.get(r.regionId) ?? []), r]);
    }
    for (const q of byRegion.values()) {
      const res = matchQueue(p, q, now);
      out.groups.push(...res.groups);
      out.expired.push(...res.expired);
      out.waiting.push(...res.waiting);
    }
  }
  return out;
}

/** 개별 결제 금액: 총가격 × (내 수량 / 총 단위). 나머지 원 단위는 마지막 참여자가 부담 */
export function splitPrice(totalPrice: number, qtys: number[]): number[] {
  const total = qtys.reduce((a, b) => a + b, 0);
  const shares = qtys.map((q) => Math.floor((totalPrice * q) / total));
  shares[shares.length - 1] += totalPrice - shares.reduce((a, b) => a + b, 0);
  return shares;
}
