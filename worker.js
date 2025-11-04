/* ===== 共有：JSON/CORS/Cache ===== */
function json(obj, status = 200, maxAge = 0) {
  const h = { "content-type": "application/json; charset=UTF-8" };
  if (maxAge > 0) h["Cache-Control"] = `public, max-age=${maxAge}`;
  return new Response(JSON.stringify(obj, null, 2), { status, headers: h });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  h.set("Access-Control-Max-Age", "86400");
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

function cacheTTL(u) {
  const s = parseInt(u.searchParams.get("cache") || "60", 10);
  if (!Number.isFinite(s) || s < 0) return 60;
  return Math.min(s, 86400);
}

/* ===== 設定 ===== */
const VERSION = "2025-11-02";
const ALLOW_HOSTS = ["usjreal.asumirai.info", "en.usjreal.asumirai.info"];
const MAX_REDIRECTS = 5;
const SLUG_MAP = {
  // 例: "mario_kart": "https://usjreal.asumirai.info/attraction/mario_kart_koopa_challenge.html",
};

/* ===== カタログ（必要なら catalog.json 方式にも後で差し替え可） ===== */
const CATALOG_ITEMS = [
  {
    id: "spyxr",
    displayName: "SPY×FAMILY XRライド",
    shortName: "XRライド",
    codeName: "SPY",
    apiTitle: "ev_spy_family_xr",
    endpoint: "https://usjwait.moenaigomi.com/api/wait?slug=ev_spy_family_xr",
    image_url:
      "https://www.usj.co.jp/tridiondata/usj/ja/jp/files/images/gds-images/usj-gds-spy-family-2025-b.jpg",
    area: "ハリウッド・エリア",
    active: true,
  },
  {
    id: "hw_dream",
    displayName: "ハリウッド・ドリーム・ザ・ライド",
    shortName: "ハリドリ",
    codeName: "HDR",
    apiTitle: "hw_dream",
    endpoint: "https://usjwait.moenaigomi.com/api/wait?slug=hw_dream",
    image_url:
      "https://www.usj.co.jp/tridiondata/usj/ja/jp/files/images/gds-images/usj-gds-hollywood-dream-the-ride-b.jpg",
    area: "ハリウッド・エリア",
    active: true,
  },
  {
    id:"nw_donkeykong_country_ride",
    displayName: "ドンキーコング・カントリー・ライド",
    shortName: "ド",
    codeName: "DKC",
    apiTitle: "nw_donkeykong_country_ride",
    endpoint: "https://usjwait.moenaigomi.com/api/wait?slug=nw_donkeykong_country_ride",
    image_url:
      "https://www.usj.co.jp/tridiondata/usj/ja/jp/files/images/gds-images/usj-gds-donkey-kong-country-ride-b.jpg",
    area: "ニンテンドー・ワールド",
    active: true,
  }
];

/* ===== Usage ===== */
function usage() {
  return {
    ok: true,
    version: VERSION,
    endpoints: {
      single_by_slug: "/api/wait?slug=<slug>",
      single_by_url: "/api/wait?url=<https://...>",
      batch_by_slugs: "/api/waits?slugs=<slug,slug,...>",
      catalog: "/api/catalog",
      usage: "/api/usage",
      health: "/api/health",
      robots: "/robots.txt",
    },
    examples: [
      "/api/wait?slug=ev_spy_family_xr",
      "/api/waits?slugs=ev_spy_family_xr,harry_potter_fj,hollywood_dream",
      "/api/catalog",
    ],
  };
}

/* ===== URL解決 ===== */
function resolveTarget(u, optionalSlug) {
  const direct = u.searchParams.get("url");
  const slug = optionalSlug || u.searchParams.get("slug");

  // 直接URL
  if (direct) {
    try {
      const t = new URL(direct);
      if (!ALLOW_HOSTS.includes(t.hostname)) {
        return { status: 403, body: { error: "forbidden host (allowed: " + ALLOW_HOSTS.join(", ") + ")" } };
      }
      return t.toString();
    } catch {
      return { status: 400, body: { error: "invalid url" } };
    }
  }

  // slug
  if (!slug) return { status: 400, body: { error: "missing ?slug= or ?url=" } };
  if (!/^[a-z0-9_\-]+$/i.test(slug)) {
    return { status: 400, body: { error: "invalid slug characters (a-z, 0-9, _ , - only)" } };
  }
  if (SLUG_MAP[slug]) return SLUG_MAP[slug];
  return `https://usjreal.asumirai.info/attraction/${slug}.html`;
}

/* ===== スクレイピング ===== */
async function scrapeOne(targetUrl) {
  try {
    let nextUrl = new URL(targetUrl);
    if (!ALLOW_HOSTS.includes(nextUrl.hostname)) {
      return { status: 403, body: { error: "forbidden host", source: targetUrl } };
    }

    let redirects = 0;
    let res;
    while (true) {
      res = await fetch(nextUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          "Accept-Language": "ja,en;q=0.9",
          "Referer": `${nextUrl.protocol}//${nextUrl.host}/`,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("Location");
        if (!loc) break;
        redirects++;
        if (redirects > MAX_REDIRECTS) {
          return { status: 508, body: { error: "too many redirects", source: nextUrl.toString() } };
        }
        const candidate = new URL(loc, nextUrl);
        if (!ALLOW_HOSTS.includes(candidate.hostname)) {
          return {
            status: 403,
            body: { error: "redirected to forbidden host", from: nextUrl.toString(), to: candidate.toString() },
          };
        }
        nextUrl = candidate;
        continue;
      }
      break;
    }

    const html = await res.text();

    if (res.status !== 200) {
      return {
        status: res.status,
        body: {
          error: `upstream ${res.status}`,
          reason: res.statusText || "upstream error",
          preview: html.slice(0, 200),
          source: nextUrl.toString(),
        },
      };
    }

    return { status: 200, body: parseWaitStats(html, nextUrl.toString()) };
  } catch (e) {
    return { status: 500, body: { error: String(e), source: targetUrl } };
  }
}

/* ===== HTML→統計値 ===== */
function parseWaitStats(html, source) {
  const strip = (h) =>
    h
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|tr|h\d|section|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const toHalf = (s) =>
    s
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
      .replace(/[：．，]/g, (m) => ({ "：": ":", "．": ".", "，": "," }[m] || m));

  const text = toHalf(strip(html));

  // optional chaining を使わない堅牢版
  const mOg = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const mTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = (mOg && mOg[1]) || (mTitle && mTitle[1]) || "";

  const idx = text.indexOf("待ち時間統計");
  const around = idx >= 0 ? text.slice(idx, Math.min(text.length, idx + 2000)) : text;
  const aroundNorm = around.replace(/(\d{1,2})\/(\d{1,2})\s*([0-2]?\d:[0-5]\d)/g, "$3");

  const num = (label) => {
    const m = aroundNorm.match(new RegExp(label + "\\s*:?\\s*([0-9]{1,4})\\s*分", "i"));
    return m ? parseInt(m[1], 10) : null;
  };
  const mm = (label) => {
    const m = aroundNorm.match(
      new RegExp(label + "\\s*:?\\s*([0-9]{1,4})\\s*分[^0-9:]*([0-9]{1,2}:[0-9]{2})", "i")
    );
    return m ? { v: parseInt(m[1], 10), t: m[2] } : { v: num(label), t: null };
  };

  const mCurrent = aroundNorm.match(/(リアルタイム|現在|最新)\s*:?\s*([0-9]{1,4})\s*分/i);
  const currentMatch = mCurrent ? mCurrent[2] : null;

  const updatedMatch =
    aroundNorm.match(/(?:最終)?更新\s*[:：]?\s*([0-2]?\d:[0-5]\d)/i) ||
    aroundNorm.match(/Updated\s*[:：]?\s*([0-2]?\d:[0-5]\d)/i) ||
    aroundNorm.match(/([0-2]?\d:[0-5]\d)\s*(?:に)?\s*(?:最終)?更新/i);
  const updated = updatedMatch ? updatedMatch[1] : null;

  const minM = mm("最小");
  const maxM = mm("最大");

  return {
    attraction: title.trim() || "USJ Attraction",
    current: currentMatch ? parseInt(currentMatch, 10) : null,
    avg_today: (num("本日の平均") ?? num("今日の平均")) ?? num("平均待ち時間"),
    median: num("中央値"),
    min: minM.v ?? null,
    min_time: minM.t,
    max: maxM.v ?? null,
    max_time: maxM.t,
    avg_week: num("今週の平均"),
    avg_month: num("今月の平均"),
    updated,
    scraped_at: new Date().toISOString(),
    source,
  };
}

/* ===== 単体・複数 ===== */
async function handleSingle(u) {
  const resolved = resolveTarget(u);
  if (typeof resolved !== "string") {
    return { status: resolved.status, body: { ...resolved.body, usage: usage() } };
  }

  const cacheKey = new Request(u.toString());
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return { status: hit.status, body: await hit.json() };

  const r = await scrapeOne(resolved);
  const res = json(r.body, r.status, cacheTTL(u));
  await cache.put(cacheKey, res.clone());
  return { status: r.status, body: r.body };
}

async function handleBatch(u) {
  const slugs = (u.searchParams.get("slugs") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return { status: 400, body: { error: "missing ?slugs=slug1,slug2", usage: usage() } };
  }

  const ttl = cacheTTL(u);
  const out = {};
  await Promise.all(
    slugs.map(async (slug) => {
      const k = new URL(u.toString());
      k.searchParams.delete("slugs");
      k.searchParams.set("slug", slug);

      const cacheKey = new Request(k.toString());
      const cache = caches.default;
      const hit = await cache.match(cacheKey);
      if (hit) {
        out[slug] = await hit.json();
        return;
      }

      const rurl = resolveTarget(k, slug);
      if (typeof rurl !== "string") {
        out[slug] = { error: rurl.body.error };
        return;
      }

      const r = await scrapeOne(rurl);
      out[slug] = r.body;

      const res = json(r.body, r.status, ttl);
      await cache.put(cacheKey, res.clone());
    })
  );

  return { status: 200, body: out };
}

/* ===== エクスポート ===== */
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;

    // CORS preflight / method
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (req.method !== "GET") return cors(json({ error: "method not allowed", usage: usage() }, 405));

    // robots.txt
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /", {
        headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }

    // API: 待ち時間
    if (path === "/api/wait")  { const out = await handleSingle(url); return cors(json(out.body, out.status)); }
    if (path === "/api/waits") { const out = await handleBatch(url);  return cors(json(out.body, out.status)); }

    // API: カタログ
    if (path === "/api/catalog") {
      const payload = { version: 1, generated_at: new Date().toISOString(), items: CATALOG_ITEMS };
      return cors(json(payload, 200, 300)); // 5分キャッシュ
    }

    // API: Usage / Health
    if (path === "/api/usage")  return cors(json(usage(), 200));
    if (path === "/api/health") return cors(json({ ok: true, ts: new Date().toISOString(), version: VERSION }, 200));

    // 既定は usage
    return cors(json(usage(), 200));
  },
};
