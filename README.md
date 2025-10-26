# リアルタイムアナリティクスダッシュボード

![Dashboard Overview](docs/media/main-desktop.png)

FastAPI・PostgreSQL・Redis・psutil と Vite + React を組み合わせ、ローカルマシンのメトリクスを 1 秒間隔で収集・可視化するリアルタイムダッシュボードです。JWT 認証付き WebSocket で最新値を配信し、1 分単位の平均値を PostgreSQL にアーカイブします。

## 主な特徴
- **ライブ計測**：psutil から CPU / メモリ / ディスク I/O / ネットワーク I/O を取得し、Redis を介してフロントへ Push。
- **集計と履歴**：1 分毎の平均値を PostgreSQL に保存し、REST API `/metrics` から取得可能。
- **JWT & WebSocket**：ログイン後のトークンで WebSocket を認証、接続ロス時はクライアントが自動再試行。
- **モダン UI**：白黒ベースのミニマルなデザイン（デスクトップ／モバイル対応）。

![Login Screen](docs/media/login-desktop.png)

## クイックツアー

<p align="center">
  <img src="docs/media/full.gif" alt="Realtime dashboard walkthrough" width="720" />
</p>

## 前提条件
- Docker / Docker Compose
- Python 3.11 以上（バックエンドをホストから直接実行する場合）
- Node.js 20 以上（Corepack 経由で pnpm を利用）

## セットアップ
1. 環境変数ファイルをコピーし、必要に応じて編集します。
   ```bash
   cp .env.example .env
   ```
   - `APP_ENV=local` + `METRICS_SOURCE=psutil` で psutil 収集が有効化されます。
2. 依存イメージをビルドしつつコンテナ群を起動します。
   ```bash
   docker compose up --build
   ```
3. 動作確認
   - バックエンド API: `http://localhost:8000/docs`
   - フロントエンド: `http://localhost:5173`
   - デフォルトのデモアカウント：`admin@example.com` / `adminpass`

## プロジェクト構成
```
src/
├─ backend/        # FastAPI アプリケーション（uv 管理）
└─ frontend/       # Vite + React アプリケーション（pnpm 管理）
deploy/
└─ docker/         # バックエンド／フロントエンド用 Dockerfile
docker-compose.yml # バックエンド・フロント・Postgres・Redis を一括起動
```

## バックエンド開発メモ
バックエンドは Python 3.12 + uv で依存管理を行います。

- 依存追加例
  ```bash
  cd src/backend
  uv add fastapi "uvicorn[standard]" sqlalchemy "psycopg[binary]" alembic \
    pydantic-settings "passlib[bcrypt]" "python-jose[cryptography]" psutil redis
  uv add --dev pytest httpx
  ```
- マイグレーション適用
  ```bash
  cd src/backend
  docker compose up -d db
  uv run alembic upgrade head
  ```

`DATABASE_URL` を指定しない場合は `.env` の値（既定で `postgresql+psycopg://radb:radb@db:5432/radb`）が利用されます。

## テスト
- バックエンド：`cd src/backend && uv run pytest`
- フロントエンド：`cd src/frontend && pnpm test --run`
- Playwright E2E（README の GIF に相当するシナリオ）：`pnpm exec playwright test`

---

スクリーンショット・GIF は `docs/media/` 以下に配置しています。README に追記したい場合は同ディレクトリへ追加し、相対パスで参照してください。
