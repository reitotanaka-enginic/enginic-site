# 税理士法人Enginic 公式サイト

依存ライブラリなしの静的サイト（HTML/CSS + Node.jsの自前ビルドスクリプト）です。
ブログ記事は `content/blog/*.md` として管理され、`/admin/` の管理画面（Decap CMS）からブラウザ上で追加・編集できます。

---

## 1. サイト公開までの手順

### 手順1: GitHubにリポジトリを作成する

1. https://github.com/new でリポジトリを新規作成（例: `enginic-site`、Public/Privateどちらでも可）
2. このフォルダの中身をリポジトリにpush
   ```bash
   cd enginic-site
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<あなたのアカウント>/enginic-site.git
   git push -u origin main
   ```
   ※ Gitの操作に慣れていない場合は、GitHubのWeb画面から「Add file → Upload files」でこのフォルダ一式をドラッグ&ドロップしてアップロードするだけでも可能です。

### 手順2: Netlifyでサイトを作成する

1. https://app.netlify.com にアクセスし、GitHubアカウントでサインアップ/ログイン
2. 「Add new site」→「Import an existing project」→ GitHubを選択 → 先ほどのリポジトリを選択
3. ビルド設定は `netlify.toml` から自動で読み込まれます（Build command: `node build.js` / Publish directory: `public`）。そのまま「Deploy」
4. 数十秒でビルドが完了し、`https://ランダムな名前.netlify.app` のようなURLでサイトが公開されます

### 手順3: 独自ドメイン（enginic.jp）を接続する

1. Netlifyのサイト管理画面 →「Domain settings」→「Add a domain」→ `enginic.jp` を入力
2. ドメインを取得したレジストラ（お名前.com、Google Domainsなど）の管理画面で、以下のいずれかを設定
   - **簡単な方法**: Netlify側の指示に従い、ネームサーバーをNetlify DNSに変更する
   - **既存のDNSを使い続けたい場合**: 以下のレコードを追加
     - `enginic.jp`（ルート/APEXドメイン）→ Netlifyが指定するALIAS/ANAMEレコード、またはA レコード（Netlifyの画面に表示される具体的な値に従ってください。値は変更される場合があるため、必ずNetlify管理画面上の最新の指示を確認してください）
     - `www.enginic.jp` → CNAMEで `<サイト名>.netlify.app` を指定
3. DNS反映後（数分〜数時間）、Netlifyが自動でHTTPS証明書（Let's Encrypt）を発行します。「HTTPS」がグリーンになれば完了です

これで `https://enginic.jp` で本番サイトが公開されます。

---

## 2. 投稿画面（Decap CMS）のセットアップ

ブログを更新するための管理画面 `https://enginic.jp/admin/` を使えるようにする設定です（最初の1回だけ）。

1. Netlifyのサイト管理画面 →「Site configuration」→「Identity」→「Enable Identity」
2. 「Registration preferences」を **Invite only**（招待制）に設定 ※誰でも登録できてしまう事故を防ぐため必須
3. 「Services」→「Git Gateway」→「Enable Git Gateway」
4. 「Identity」タブ →「Invite users」から、古山さん・田中さんなど記事を書く人のメールアドレスを招待
5. 招待メールが届くのでパスワードを設定
6. `https://enginic.jp/admin/` にアクセスしてログインすると、ブログ記事の作成・編集・削除ができる管理画面が使えます

投稿を保存すると、自動的にGitHubリポジトリにコミットされ、Netlifyが自動でサイトを再ビルド・公開します（反映まで1分程度）。

---

## 3. ブログ記事の書き方

### 管理画面から書く場合（推奨）
`https://enginic.jp/admin/` にログイン →「ブログ記事」→「New 記事」→ タイトル・公開日・タグ・要約・本文を入力 →「Publish」

### Markdownファイルを直接編集する場合
`content/blog/` の中に、`2026-07-10-welcome.md` のような形式でファイルを作成します。

```markdown
---
title: 記事タイトル
date: 2026-07-10
tag: お知らせ
excerpt: 一覧ページや検索結果に表示される要約文
---
本文をMarkdownで書きます。

## 見出し

- 箇条書き
- 箇条書き

[リンクテキスト](/contact/) のようにリンクも書けます。
```

保存してGitHubにpushすれば、次のビルドで自動的にページが生成されます。

---

## 4. ローカルでの確認方法（任意）

Node.js（バージョン18以上）がインストールされていれば、手元でも確認できます。

```bash
npm run build   # public/ に静的ファイルを生成
npm run serve   # http://localhost:8080 で確認
```

---

## 5. SEOについて

- 各ページに `title` / `description` / OGP / Twitterカード / 構造化データ（JSON-LD）を自動出力
- `sitemap.xml` / `feed.xml`（RSS）/ `robots.txt` を自動生成
- 公開後は [Google Search Console](https://search.google.com/search-console) にプロパティ登録し、`https://enginic.jp/sitemap.xml` を送信することをおすすめします
- ブログを高頻度で更新するほど、検索エンジンのクロール頻度・評価が上がりやすくなります

---

## ディレクトリ構成

```
enginic-site/
├── build.js              # 静的サイトビルドスクリプト（依存ライブラリなし）
├── serve.js              # ローカル確認用の簡易サーバー
├── netlify.toml          # Netlifyのビルド設定
├── src/
│   ├── pages/            # 固定ページ（ホーム/会社概要/事業内容/役員紹介/お問い合わせ）
│   ├── partials/         # ヘッダー・フッター
│   └── templates/        # ブログ用テンプレート
├── content/blog/         # ブログ記事（Markdown、CMSから自動生成される）
├── assets/                # CSS・画像・ロゴ・役員写真
├── admin/                 # 投稿画面（Decap CMS）
└── public/                # ビルド後の出力（gitには含めません）
```
