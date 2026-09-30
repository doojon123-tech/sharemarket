"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase as sb } from "@/lib/supabase";

const LABEL: any = { waiting: "대기중", matched: "매칭완료", picked_up: "수령완료", cancelled: "취소" };
const COLOR: any = { waiting: "bg-amber-100 text-amber-700", matched: "bg-green-100 text-green-700", picked_up: "bg-blue-100 text-blue-700", cancelled: "bg-gray-200 text-gray-500" };
const Img = ({ v }: { v?: string }) => v?.startsWith("http") ? <img src={v} className="h-12 w-12 rounded-lg object-cover" alt="" /> : <span className="text-4xl">{v || "🛒"}</span>;
const won = (n: number) => n.toLocaleString() + "원";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [tab, setTab] = useState("shop");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<any>({});

  const load = useCallback(async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      sb.from("users").select("*").eq("id", uid).maybeSingle(), sb.from("regions").select("*")]);
    setMe(p); setRegions(r ?? []);
    const [pr, rq, mb] = await Promise.all([
      sb.from("products").select("*").eq("active", true).order("created_at"),
      sb.from("requests").select("*, products(name,image_url)").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("group_members").select("*, groups(status,pickup_at,pickup_points(name))").eq("user_id", uid)]);
    setProducts(pr.data ?? []); setReqs(rq.data ?? []); setMembers(mb.data ?? []);
    if (p?.is_admin) {
      const { data } = await sb.from("groups").select("*, products(name), pickup_points(name), group_members(request_id,qty,amount)").order("created_at", { ascending: false });
      setGroups(data ?? []);
    }
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: l } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => l.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    load(user.id);
    // 그룹 확정 실시간 알림
    const ch = sb.channel("gm").on("postgres_changes", { event: "INSERT", schema: "public", table: "group_members", filter: `user_id=eq.${user.id}` },
      () => { setMsg("🎉 매칭이 완료됐어요! 내 신청에서 수령 정보를 확인하세요."); load(user.id); }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [user, load]);

  const auth = async (signup: boolean) => {
    const fn = signup ? sb.auth.signUp : sb.auth.signInWithPassword;
    const { error } = await fn.call(sb.auth, { email: f.email, password: f.password });
    setMsg(error ? error.message : signup ? "가입 완료! 이메일 인증이 필요하면 메일함을 확인하세요." : "");
  };
  const saveProfile = async () => {
    const { error } = await sb.from("users").upsert({ id: user.id, nickname: f.nick, region_id: f.region });
    setMsg(error ? error.message : ""); load(user.id);
  };
  const apply = async (p: any) => {
    const qty = Number(f["q" + p.id] || 1), hrs = Number(f["h" + p.id] || 24);
    const { error } = await sb.from("requests").insert({ user_id: user.id, product_id: p.id, region_id: me.region_id, qty, deadline: new Date(Date.now() + hrs * 3600_000).toISOString() });
    if (error) return setMsg(error.message);
    await fetch("/api/match", { method: "POST" });
    setMsg("신청 완료! 같은 동네 이웃을 찾는 중이에요."); load(user.id); setTab("mine");
  };
  const cancel = async (id: string) => { await sb.from("requests").update({ status: "cancelled" }).eq("id", id).eq("status", "waiting"); load(user.id); };
  const addProduct = async () => {
    const { error } = await sb.from("products").insert({ name: f.pn, total_amount: +f.pt, unit: f.pu, split_amount: +f.ps, total_price: +f.pp, image_url: f.pi || null });
    setMsg(error ? error.message : "상품 등록 완료"); load(user.id);
  };
  const done = async (g: any) => {
    await sb.from("groups").update({ status: "picked_up" }).eq("id", g.id);
    await sb.from("requests").update({ status: "picked_up" }).in("id", g.group_members.map((m: any) => m.request_id));
    load(user.id);
  };

  const inp = "w-full rounded-lg border px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:scale-95";
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  if (!user) return (
    <main className="p-6 space-y-3">
      <h1 className="pt-16 text-3xl font-extrabold text-emerald-600">쉐어마켓</h1>
      <p className="text-gray-500">우리 동네 학생 공동구매 — 필요한 만큼만 나눠 사요</p>
      <input className={inp} placeholder="이메일" onChange={set("email")} />
      <input className={inp} type="password" placeholder="비밀번호(6자 이상)" onChange={set("password")} />
      <div className="flex gap-2"><button className={btn} onClick={() => auth(false)}>로그인</button>
        <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => auth(true)}>회원가입</button></div>
      {msg && <p className="text-sm text-rose-500">{msg}</p>}
    </main>);

  if (!me?.region_id) return (
    <main className="p-6 space-y-3">
      <h2 className="pt-12 text-xl font-bold">동네를 설정해 주세요</h2>
      <input className={inp} placeholder="닉네임" onChange={set("nick")} />
      <select className={inp} onChange={set("region")} defaultValue=""><option value="" disabled>대학/지역 선택</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className={btn} onClick={saveProfile}>시작하기</button>{msg && <p className="text-sm text-rose-500">{msg}</p>}
    </main>);

  const tabs = [["shop", "공동구매"], ["mine", "내 신청"], ...(me.is_admin ? [["admin", "관리자"]] : [])];
  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><b className="text-emerald-600 text-lg">쉐어마켓</b>
          <button className="text-xs text-gray-400" onClick={() => sb.auth.signOut()}>{me.nickname} · 로그아웃</button></div>
        <nav className="mt-3 flex gap-2">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={"rounded-full px-3 py-1 text-sm " + (tab === k ? "bg-emerald-600 text-white" : "bg-gray-100")}>{l}</button>)}</nav>
      </header>
      {msg && <p className="m-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" onClick={() => setMsg("")}>{msg}</p>}
      <section className="space-y-3 p-4">
        {tab === "shop" && products.map((p) => { const units = Math.round(p.total_amount / p.split_amount);
          return (<div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3"><Img v={p.image_url} /><div className="flex-1">
              <b>{p.name}</b><p className="text-xs text-gray-500">{p.total_amount}{p.unit} 중 {p.split_amount}{p.unit}씩 · 총 {won(p.total_price)}</p>
              <p className="text-sm font-semibold text-emerald-600">1소분 {won(Math.round(p.total_price / units))}</p></div></div>
            <div className="mt-3 flex gap-2">
              <select className={inp + " !w-auto"} onChange={set("q" + p.id)}>{Array.from({ length: units }, (_, i) => <option key={i} value={i + 1}>{i + 1}소분</option>)}</select>
              <select className={inp + " !w-auto"} onChange={set("h" + p.id)} defaultValue="24">{[6, 12, 24, 48].map((h) => <option key={h} value={h}>{h}시간 내</option>)}</select>
              <button className={btn + " flex-1"} onClick={() => apply(p)}>신청</button></div></div>); })}
        {tab === "mine" && (reqs.length ? reqs.map((r) => { const m = members.find((x) => x.request_id === r.id);
          return (<div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3"><Img v={r.products?.image_url} /><div className="flex-1"><b>{r.products?.name}</b>
              <p className="text-xs text-gray-500">{r.qty}소분 · 마감 {new Date(r.deadline).toLocaleString("ko-KR")}</p></div>
              <span className={"rounded-full px-2 py-1 text-xs " + COLOR[r.status]}>{LABEL[r.status]}</span></div>
            {m && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm">💰 내 결제 {won(m.amount)} · 📍 {m.groups?.pickup_points?.name ?? "장소 협의"} · ⏰ {new Date(m.groups?.pickup_at).toLocaleString("ko-KR")}</p>}
            {r.status === "waiting" && <button className="mt-2 text-xs text-rose-500" onClick={() => cancel(r.id)}>신청 취소</button>}</div>); })
          : <p className="py-16 text-center text-gray-400">아직 신청 내역이 없어요</p>)}
        {tab === "admin" && (<>
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm"><b>상품 등록</b>
            <input className={inp} placeholder="상품명" onChange={set("pn")} />
            <div className="grid grid-cols-3 gap-2"><input className={inp} placeholder="총량" onChange={set("pt")} /><input className={inp} placeholder="단위(구,g)" onChange={set("pu")} /><input className={inp} placeholder="소분량" onChange={set("ps")} /></div>
            <input className={inp} placeholder="총가격(원)" onChange={set("pp")} /><input className={inp} placeholder="이미지 URL 또는 이모지" onChange={set("pi")} />
            <button className={btn} onClick={addProduct}>등록</button></div>
          <b className="block pt-2">그룹 현황</b>
          {groups.map((g) => (<div key={g.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm"><div className="flex justify-between"><b>{g.products?.name}</b>
            <span className={"rounded-full px-2 py-0.5 text-xs " + (g.status === "picked_up" ? COLOR.picked_up : COLOR.matched)}>{g.status === "picked_up" ? "수령완료" : "확정"}</span></div>
            <p className="text-gray-500">{g.pickup_points?.name} · 참여 {g.group_members.length}명</p>
            {g.status === "confirmed" && <button className={btn + " mt-2"} onClick={() => done(g)}>수령 완료 처리</button>}</div>))}</>)}
      </section>
    </main>);
}
