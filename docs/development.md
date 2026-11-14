# 開発・配信ガイド

## 構成

HTML・CSS・TypeScriptとViteで構成するSPAです。画面描画や答案の保存・復元はブラウザで行い、サーバー側のデータベースは使用しません。

- `src/`：画面、学習記録、問題データなど。
- `public/`：静的アセット。
- `scripts/`：問題データの検証やPDFアセットの準備。
- `cloudflare.config.ts`：Cloudflareのアカウント・Worker名・SPA配信設定。

午後の大問は年度・区分・問番号をURLに持ち、解説には `/answer` を付けます。CloudflareのSPAフォールバックにより、URLを直接開いても対応する画面を表示します。

## 開発と検証

Node.js 24で `npm ci` を実行し、`npm run dev` で開発サーバーを起動します。CSS・TypeScript・問題データはHMRで反映し、HTMLの変更時はページを再読み込みします。

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（ポート4173） |
| `npm run build` | PDFアセット準備・型検査・本番ビルド |
| `npm run check:deploy` | ビルド済み生成物の検証（アップロードなし） |
| `npm run preview` | ビルドのプレビュー（ポート4174） |
| `npm run check:morning` | 午前問題データの検証 |
| `npm run check:archive` | 午後問題・配点・過去問データなどの検証 |

`cf` と `@cloudflare/vite-plugin` はベータ版のため、バージョンを固定しています。生成物は `.cloudflare/output/v0/` に出力されます。

## 配信

このリポジトリの公開サイトは、GitHubの `main` へのプッシュを契機にCloudflare Workers Buildsで自動ビルド・デプロイします。

- ビルドコマンド：`npm run build`
- CIのデプロイコマンド：`npm run deploy`

公開サイトの更新では、ビルドとアップロードなしの検証を行い、対象コミットの `Workers Builds: naritai-db-sp` の成功と本番表示まで確認します。運用手順は[AGENTS.md](../AGENTS.md)を参照してください。公開サイトへの反映にローカルの `npm run deploy` は使用しません。

フォークして自分の環境へ配信する場合は、`cloudflare.config.ts` のアカウント・Worker名をご自身の環境に合わせ、配信先の設定を行ってください。
