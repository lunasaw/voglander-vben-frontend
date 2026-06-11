<div align="center">
  <h1>Voglander Admin · フロントエンド</h1>
  <p>映像監視 / ストリーミングメディア管理プラットフォームの Web 管理画面</p>

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Vue](https://img.shields.io/badge/Vue-3.x-42b883.svg)](https://vuejs.org/) [![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

</div>

[简体中文](./README.md) | **日本語**

## はじめに

本リポジトリは **Voglander** 映像監視 / ストリーミングメディアプラットフォームの管理フロントエンドであり、[Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin) 5.x をベースに二次開発したものです。統一された `requestClient` を通じて voglander バックエンドの REST API（`/api/*`、`/zlm/api/*`）を呼び出し、デバイス接続、ストリーミング制御、GB28181 プロトコル検証、システム権限管理を実現します。

> これは **プライベートなカスタム fork** であり、主要な開発対象は `apps/web-antd`（Ant Design Vue 版）です。その他の `web-ele` / `web-naive` / `playground` は上流テンプレート由来で、スタイルやコンポーネントの参考用途に限られます。

## プロダクト内での位置づけ

Voglander は 4 つの独立したリポジトリで構成され、本リポジトリはそのフロントエンドです。バックエンドは GB28181（`sip-proxy`）と ZLMediaKit（`zlm-spring-boot-starter`）を `voglander` に統合し、フロントエンドは REST と SSE を通じて連携します。

```
sip-proxy ───────────────┐
                         ├──► voglander (バックエンド) ◄──── REST /api/*、/zlm/api/* + SSE ──── vue-vben-admin (本リポジトリ)
zlm-spring-boot-starter ──┘
```

フロントとバックの契約は一致させる必要があります。フィールドの追加・変更は双方で整合させ、API やフィールドを独自に捏造してはいけません（詳細は [`apps/web-antd/CLAUDE.md`](apps/web-antd/CLAUDE.md) および `.cursorrules` を参照）。

## 主な機能

- **メディア管理**
  - サービスノード管理：ZLMediaKit ノードの登録、オンライン状態、マルチノードルーティング（`X-Node-Key`）
  - 映像ストリーム一覧：リアルタイムストリーム一覧、ストリーム詳細、スクリーンショット
  - プル / プッシュプロキシ：プル・プッシュプロキシの CRUD とオンライン状態監視
- **マルチプロトコルメディアプレーヤー**：HLS / FLV / Video.js の自動フォーマット検出とプレーヤー切替（`MediaPlayerManager`）、リアルタイム視聴者数と URL コピーに対応
- **GB28181 プロトコル検証台**：左側でデバイス側（Client）の登録・通知をシミュレート、右側でプラットフォーム側（Server）が指令を送信し、実際の SIP 交換を経てプロトコルリンクを可視化検証
- **システム管理**：ユーザー、ロール、メニュー、部門の管理。バックエンド駆動の動的ルーティングと RBAC による二重権限チェック
- **リアルタイムイベント（SSE）**：デバイス登録、セッション、指令、アラームなどのイベントをリアルタイム配信。自動再接続と重複排除に対応
- **基盤機能**：マルチテーマ切替、充実した国際化（中 / 英）、Schema 駆動の動的フォームと VXE Table データグリッド

## 技術スタック

| カテゴリ            | 採用技術                                      |
| ------------------- | --------------------------------------------- |
| フレームワーク      | Vue 3 + TypeScript + Composition API          |
| ビルド              | Vite + Turborepo + pnpm workspace（Monorepo） |
| UI                  | Ant Design Vue（主）、Tailwind CSS            |
| 状態管理            | Pinia（永続化 + 暗号化）                      |
| ルーティング        | Vue Router 4（バックエンド駆動権限）          |
| テーブル / フォーム | VXE Table、Schema 駆動動的フォーム            |
| メディア            | Video.js、FLV.js、HLS.js                      |
| アイコン            | `@vben/icons`（Lucide）                       |

## ディレクトリ構成

```
vue-vben-admin/
├── apps/
│   ├── web-antd/          # 主要開発対象（Ant Design Vue）
│   │   ├── src/
│   │   │   ├── api/        # API 層：core / media / system / protocol-lab
│   │   │   ├── views/      # ページ：media / protocol-lab / system / dashboard
│   │   │   ├── components/ # 共有ビジネスコンポーネント（MediaPlayer、NodeSelector…）
│   │   │   ├── composables/# Composable 関数（useSseEvents…）
│   │   │   ├── router/     # ルーティングモジュール定義
│   │   │   └── locales/    # 国際化（zh-CN / en-US）
│   │   ├── api/            # バックエンド OpenAPI 参考（voglander-api.md）
│   │   └── doc/            # アーキテクチャ・設計ドキュメント
│   ├── web-ele / web-naive # 上流テンプレート参考版
│   └── backend-mock/      # Nitro Mock サービス
├── packages/              # 共有ライブラリ（@core / effects / ビジネスパッケージ）
├── internal/              # ビルド・規約設定
└── playground/            # スタイル・コンポーネント参考
```

## クイックスタート

動作要件：**Node.js >= 20.10.0**、**pnpm >= 9.12.0**。

```bash
# 1. 依存関係のインストール
npm i -g corepack
pnpm install

# 2. 開発サーバーの起動（主対象 web-antd、デフォルトポート 5666）
pnpm dev:antd

# 3. 本番ビルド
pnpm build:antd
```

開発時の API は `/api` プレフィックスを使用し、Vite プロキシ経由で voglander バックエンド（デフォルト `http://0.0.0.0:8081`）へ転送されます。ローカルバックエンドと連携する場合は、各リポジトリのビルド順序（ルートの `CLAUDE.md` を参照）を確認してください。

## コード品質

```bash
pnpm check          # すべての品質ゲート（型 / 依存 / 循環依存 / スペル）
pnpm lint           # コードチェック
pnpm format         # フォーマット
pnpm test:unit      # Vitest ユニットテスト
pnpm test:e2e       # Playwright E2E テスト
```

## 開発ガイドとドキュメント

- プロジェクトの開発規約、コンポーネント化パターン、権限と i18n の取り決め：[`CLAUDE.md`](CLAUDE.md)、[`apps/web-antd/CLAUDE.md`](apps/web-antd/CLAUDE.md)
- システムアーキテクチャドキュメント：[`apps/web-antd/doc/1.0.6/README.md`](apps/web-antd/doc/1.0.6/README.md)（システム概要 / フロント・バックアーキテクチャ / API 契約）
- GB28181 プロトコル検証台の設計：[`apps/web-antd/doc/1.0.7/`](apps/web-antd/doc/1.0.7/)
- バックエンド API 参考：[`apps/web-antd/api/voglander-api.md`](apps/web-antd/api/voglander-api.md)

## ブラウザサポート

モダンブラウザに対応、IE 非対応。ローカル開発では `Chrome 80+` を推奨します。

|      Edge       |     Firefox     |     Chrome      |     Safari      |
| :-------------: | :-------------: | :-------------: | :-------------: |
| last 2 versions | last 2 versions | last 2 versions | last 2 versions |

## 謝辞とライセンス

本プロジェクトはオープンソースの管理画面テンプレート [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin)（[ドキュメント](https://doc.vben.pro/)）をベースに二次開発しています。原作者 [@Vben](https://github.com/anncwb) とそのコントリビューターに感謝します。

[MIT](./LICENSE) License.
