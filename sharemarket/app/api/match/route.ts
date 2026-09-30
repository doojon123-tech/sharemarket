import { createClient } from "@supabase/supabase-js";
import { matchAll, splitPrice, MatchRequest } from "@/lib/matching";
export const dynamic = "force-dynamic";

const dist = (a: any, b: any) => {
  if (a?.lat == null || b?.lat == null) return 0;
  const r = (d: number) => (d * Math.PI) / 180, R = 6371000;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// 멱등: 언제, 몇 번 호출해도 안전 (신청 직후 + Vercel Cron에서 호출)
async function run() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const [{ data: prods }, { data: reqs }, { data: pts }, { data: users }] = await Promise.all([
    db.from("products").select("*").eq("active", true),
    db.from("requests").select("*").eq("status", "waiting"),
    db.from("pickup_points").select("*"),
    db.from("users").select("id,lat,lng"),
  ]);
  const pt = (rid: string) => (pts ?? []).find((p: any) => p.region_id === rid);
  const uMap = new Map((users ?? []).map((u: any) => [u.id, u]));
  const P = (prods ?? []).map((p: any) => ({ id: p.id, totalUnits: Math.round(p.total_amount / p.split_amount) }));
  const R: MatchRequest[] = (reqs ?? []).map((r: any) => ({
    id: r.id, userId: r.user_id, productId: r.product_id, regionId: r.region_id, qty: r.qty,
    deadline: new Date(r.deadline), distanceM: dist(uMap.get(r.user_id), pt(r.region_id)),
  }));
  const res = matchAll(P, R, now);

  for (const g of res.groups) {
    const prod = (prods ?? []).find((p: any) => p.id === g.productId);
    const members = g.requestIds.map((id) => R.find((r) => r.id === id)!);
    const { data: grp } = await db.from("groups").insert({
      product_id: g.productId, region_id: g.regionId, pickup_point_id: pt(g.regionId)?.id ?? null,
      pickup_at: new Date(now.getTime() + 24 * 3600_000).toISOString(),
    }).select().single();
    if (!grp) continue;
    const amounts = splitPrice(prod.total_price, members.map((m) => m.qty));
    await db.from("group_members").insert(members.map((m, i) => ({
      group_id: grp.id, request_id: m.id, user_id: m.userId, qty: m.qty, amount: amounts[i] })));
    await db.from("requests").update({ status: "matched" }).in("id", g.requestIds).eq("status", "waiting");
  }
  if (res.expired.length) await db.from("requests").update({ status: "cancelled" }).in("id", res.expired).eq("status", "waiting");
  return { groups: res.groups.length, cancelled: res.expired.length };
}
export const GET = async () => Response.json(await run());
export const POST = GET;
