# リアルタイムアナリティクスダッシュボード

FastAPI・PostgreSQL・Redis と Vite + React フロントエンドで構成されるリアルタイム可視化ダッシュボードの足場です。現時点ではバックエンドとフロントエンドの最小構成、およびそれらを一括起動するための Docker Compose が揃っています。

## 前提条件
- Docker / Docker Compose
- Python 3.11 以上（バックエンドをローカル実行する場合）
- Node.js 20 以上（Corepack 経由で pnpm を利用）

## セットアップ手順
1. 環境変数ファイルをコピーし、必要に応じて編集します。
   ```bash
   cp .env.example .env
   ```
2. 依存イメージをビルドしつつコンテナ群を起動します。
   ```bash
   docker compose up --build
   ```
3. 動作確認：
   - バックエンド API: `http://localhost:8000/docs`
   - フロントエンド: `http://localhost:5173`

## プロジェクト構成
```
src/
├─ backend/        # FastAPI アプリケーション（uv 管理）
└─ frontend/       # Vite + React アプリケーション（pnpm 管理）
deploy/
└─ docker/         # バックエンド／フロントエンド用 Dockerfile
docker-compose.yml # バックエンド・フロント・Postgres・Redis を一括起動
```

現状のバックエンドは `/health`、`/auth/login`、`/metrics` をモックデータ付きで公開しています。フロントエンドはログインフォームとダッシュボードのプレースホルダ画面を備えており、今後のステップで機能拡張していく想定です。

## uv での依存管理とマイグレーション
バックエンドは Python 3.12 + uv で依存管理を行います。

### 依存の追加
```bash
cd src/backend
uv add fastapi "uvicorn[standard]" sqlalchemy "psycopg[binary]" alembic \
  pydantic-settings "passlib[bcrypt]" "python-jose[cryptography]"
uv add --dev pytest httpx
```

### マイグレーションの作成と適用
```bash
cd src/backend
uv run alembic revision -m "init users & metrics"
# 開発環境の Postgres を起動
docker compose up -d db
# ホストから接続する場合は DATABASE_URL を指定
DATABASE_URL=postgresql+psycopg://radb:radb@localhost:5432/radb uv run alembic upgrade head
docker compose stop db
```

`DATABASE_URL` を指定しない場合は `.env` に定義した接続情報（デフォルトで `postgresql+psycopg://radb:radb@db:5432/radb`）が利用されます。
