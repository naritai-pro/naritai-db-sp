# 本番への反映手順

本番サイトは https://ipa-db-sp.naritai.app/ 。GitHubリポジトリ `naritai-pro/naritai-db-sp` の `main` ブランチへのプッシュを契機に、Cloudflare Workers Buildsが自動でビルド・デプロイする。

ユーザーから本番反映を依頼されたら、次の手順で完了まで進める。

1. 変更内容を確認し、`npm run build`、`npm run check:deploy` と変更に応じた動作・表示確認を行う。
2. 対象の変更をコミットし、GitHubの `main` ブランチへプッシュする（`git push origin main`）。別ブランチで作業した場合は、変更を `main` に統合してからプッシュする。無関係な変更を含めず、強制プッシュはしない。
3. 対象コミットのGitHubチェック `Workers Builds: naritai-db-sp` が成功するまで確認する。
4. 本番URLを開き、依頼された変更が実際に反映されたことを確認してから完了を報告する。プッシュ成功だけで本番反映完了とはしない。

本番反映のためにローカルから `wrangler deploy`、`cf deploy`、`npm run deploy` を実行しない。ローカルのCLI認証先は本番のCloudflareアカウントと異なる場合があるため、Workersの直接デプロイや `workers.dev` での確認を、本番反映の代わりにしない。

Cloudflare CLIは `cf` を使用する。設定は `cloudflare.config.ts`、ビルドは `npm run build`、アップロードなしの検証は `npm run check:deploy`。Cloudflare Workers Buildsのデプロイコマンドは移行時に `npm run deploy` へ変更する。移行準備中は、Cloudflare側のコマンド変更前にmainへプッシュしない。
