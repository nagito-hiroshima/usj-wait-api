# 🎢 USJ WaitTime API（Cloudflare Workers）

Universal Studios Japan（USJ）の非公式待ち時間データをスクレイピングし、  
JSON API として提供する Cloudflare Workers プロジェクトです。

Cloudflare Workers 上で動作し、GitHub リポジトリと連携して自動デプロイされます。

---

## 🚀 Features

- **API経由で待ち時間情報を取得**
  - `/api/wait?slug=<slug>`：指定アトラクション1件
  - `/api/waits?slugs=<slug,slug,...>`：複数アトラクションまとめ取得
- **自動スクレイピング（usjreal.asumirai.info）**
  - `current`, `avg_today`, `min/max` などを抽出
- **カタログAPI搭載**
  - `/api/catalog`：登録アトラクション一覧（サムネイル・URL・エリア情報付き）
- **CORS対応**
  - 他ドメイン・フロントエンドアプリから直接アクセス可能
- **キャッシュ内蔵**
  - Cloudflare KV Cacheでレスポンスを60秒〜最大1日キャッシュ

---

## 🧱 Tech Stack

| 項目 | 使用技術 |
|------|-----------|
| Runtime | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| 言語 | JavaScript (ES Modules) |
| デプロイ管理 | Wrangler v4 |
| スクレイピング対象 | [usjreal.asumirai.info](https://usjreal.asumirai.info/) |
| データ形式 | JSON API |
| ホスティング | Cloudflare Pages (GitHub連携) |

---

## 🧩 API Endpoints

| Endpoint | 説明 |
|-----------|------|
| `/api/wait?slug=<slug>` | 指定slugのアトラクション待ち時間を取得 |
| `/api/waits?slugs=<slug,slug,...>` | 複数slugをまとめて取得 |
| `/api/catalog` | カタログ情報（アトラクション一覧） |
| `/api/usage` | APIの使い方（ヘルスチェック代わり） |
| `/api/health` | 稼働確認 (`{ok:true}`) |
| `/robots.txt` | ボット制御（全Disallow） |

---

## 🎠 Example

### シングル取得
```bash
GET https://usjwait.moenaigomi.com/api/wait?slug=ev_spy_family_xr
```

Response:
```
{
  "attraction": "【待ち時間】SPY×FAMILY XRライド",
  "current": 90,
  "avg_today": 85,
  "min": 45,
  "max": 120,
  "updated": "17:40",
  "scraped_at": "2025-11-02T09:00:00Z"
}
```

複数取得  
```
GET https://usjwait.moenaigomi.com/api/waits?slugs=ev_spy_family_xr,hw_dream
```

📘 カタログサンプル
```
GET https://usjwait.moenaigomi.com/api/catalog
```
  
Response:
```
{    
  "version": 1,
  "generated_at": "2025-11-02T12:00:00Z",
  "items": [
    {
      "id": "spyxr",
      "displayName": "SPY×FAMILY XRライド",
      "shortName": "XRライド",
      "area": "ハリウッド・エリア",
      "endpoint": "/api/wait?slug=ev_spy_family_xr",
      "active": true
    },
    {
      "id": "hw_dream",
      "displayName": "ハリウッド・ドリーム・ザ・ライド",
      "shortName": "ハリドリ",
      "area": "ハリウッド・エリア",
      "endpoint": "/api/wait?slug=hw_dream",
      "active": true
    }
  ]
}

```


🛠 開発・デプロイ方法  
構成 
```
usjwait/  
├─ worker.js  
└─ wrangler.toml
```

  
🔒 CORS & キャッシュ設定  
| 機能    | 設定                               |
| ----- | -------------------------------- |
| CORS  | `Access-Control-Allow-Origin: *` |
| Cache | `max-age=60`（`?cache=秒数` で変更可）   |
| TTL上限 | `86400`（24時間）                    |

⚠️ 注意事項  
本APIは非公式であり、USJ公式のAPIではありません。  
情報元サイト（usjreal.asumirai.info）の構造変更により動作しなくなる場合があります。  
商用利用・スクレイピングの継続利用は自己責任で行ってください。  

💡 開発者メモ  
Cloudflare Workers（Modulesモード）で構築  
?.[n] 演算子や ?? の互換性問題を避けてES2022対応済み  
wrangler.toml は v4仕様に最適化  
ログ監視は Cloudflare Dashboard → Workers → Observability から可能  

