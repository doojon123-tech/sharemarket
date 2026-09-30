import assert from "node:assert/strict";
import { matchQueue, splitPrice, MatchRequest } from "../lib/matching";

const now = new Date("2026-09-28T12:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3600_000);
const req = (id: string, qty: number, dl: number, dist: number): MatchRequest => ({
  id, userId: "u" + id, productId: "egg", regionId: "r1", qty, deadline: h(dl), distanceM: dist,
});
const egg = { id: "egg", totalUnits: 3 };

// 1) 정확히 채워지면 그룹 확정
let r = matchQueue(egg, [req("a", 1, 5, 100), req("b", 2, 6, 200)], now);
assert.equal(r.groups.length, 1);

// 2) 마감 임박 요청 우선 포함 (a+c 선택, b 대기)
r = matchQueue(egg, [req("a", 1, 5, 100), req("b", 2, 9, 50), req("c", 2, 1, 900)], now);
assert.deepEqual(r.groups[0].requestIds.sort(), ["a", "c"]);
assert.deepEqual(r.waiting, ["b"]);

// 3) 마감 같으면 가까운 사람 우선
r = matchQueue(egg, [req("far", 2, 5, 900), req("near", 2, 5, 100), req("x", 1, 5, 500)], now);
assert.deepEqual(r.groups[0].requestIds.sort(), ["near", "x"]);

// 4) 미충족 + 마감 지남 → 자동 취소
r = matchQueue(egg, [req("a", 1, -1, 100), req("b", 1, 3, 100)], now);
assert.equal(r.groups.length, 0);
assert.deepEqual(r.expired, ["a"]);
assert.deepEqual(r.waiting, ["b"]);

// 5) 대기열이 커서 그룹 여러 개 생성
r = matchQueue(egg, [0,1,2,3,4,5].map((i) => req("q" + i, 1, 2 + i, 10 * i)), now);
assert.equal(r.groups.length, 2);

// 6) 가격 분할 합계 = 총가격
assert.equal(splitPrice(9990, [1, 1, 1]).reduce((a, b) => a + b, 0), 9990);

console.log("✅ 매칭 테스트 6개 통과");
