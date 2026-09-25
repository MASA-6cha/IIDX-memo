# IIDX memo

iPhoneのホーム画面でも使えるIIDXの譜面別メモ。SP/DPのオプション、白数字、緑数字、コメント、プレー記録などは利用者の端末に保存します。

## 開く・更新する

GitHub Pages: https://masa-6cha.github.io/IIDX-memo/

Safariで開いて「ホーム画面に追加」すると、アプリとして使用できます。全体設定の「アプリの更新を確認」から公開済みの新バージョンを取り込み、「新しいアプリに切り替える」で適用します。更新には通信が必要です。楽曲DBの更新はアプリ本体の更新とは別です。

## 旧サイトから移行する場合

旧サイトの端末内データはURLが異なるため自動で移行しません。

1. 旧アプリの全体設定でテキストバックアップを作成し、安全な場所に保管する。
2. 新しいGitHub PagesのURLをSafariで開く。
3. 新アプリの全体設定からバックアップを取り込む。
4. 曲リスト、メモ、お気に入り、プレー記録を確認してからホーム画面に追加する。

手動で取り込んだ楽曲JSONは通常のメモ・スコアのバックアップに含まれません。元のJSONファイルまたはURLを保管し、新アプリでも取り込んでください。移行確認までは旧アプリを残してください。

## 開発

Node.js 24とpnpm 11.25.0を使用します。

```sh
pnpm install --frozen-lockfile
pnpm run test:pages
pnpm run build
```

GitHub Actionsが`main`への反映後に`pages-dist/`をGitHub Pagesへ公開します。リポジトリの **Settings → Pages → Build and deployment → Source** は **GitHub Actions** を選択してください。サービスワーカーの配布範囲は `/IIDX-memo/` です。
