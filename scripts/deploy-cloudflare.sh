#!/usr/bin/env bash
# Siapkan resource Cloudflare untuk demo MabaKit lalu deploy.
# Sekali jalan: login, D1, migrasi, seed, secret, deploy.
# Jalankan dari akar repo: npm run deploy:setup
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG=backend/wrangler.jsonc
DB=mabakit-demo

# Semua keluaran juga ditulis ke berkas ini. Terminal bisa tertutup di tengah jalan;
# log tetap ada, jadi hasilnya bisa diperiksa kapan saja.
LOG=deploy-cloudflare.log
: >"$LOG"
exec > >(tee -a "$LOG") 2>&1

STATUS=0
# Trap EXIT: apa pun yang mengakhiri skrip (termasuk `exit 1` dan Ctrl-C), statusnya
# selalu dicetak. Tanpa ini skrip bisa berhenti tanpa jejak.
trap 'STATUS=$?; if [ "$STATUS" -ne 0 ]; then printf "\n\033[31mGAGAL\033[0m (exit %s) saat: %s\n  Log lengkap: %s\n" "$STATUS" "$BASH_COMMAND" "$PWD/$LOG" >&2; fi' EXIT

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
run() { printf '  $ %s\n' "$*"; "$@"; }

logged_in() { npx wrangler whoami >/tmp/mabakit-whoami.log 2>&1; }

step "1/7 Login wrangler"
if logged_in; then
  echo "  sudah login"
else
  # Token kedaluwarsa atau belum pernah login. `wrangler login` membuka browser,
  # jadi jalankan langsung di sini supaya tidak perlu pindah terminal.
  echo "  belum login, membuka browser..."
  npx wrangler login || { cat /tmp/mabakit-whoami.log >&2; exit 1; }
  if ! logged_in; then
    cat /tmp/mabakit-whoami.log >&2
    echo "Login belum berhasil. Coba ulang, atau pakai CLOUDFLARE_API_TOKEN." >&2
    exit 1
  fi
  echo "  login ok"
fi

step "2/7 D1 $DB"
# `d1 list --json` bisa diselipi baris non-JSON (notifikasi update wrangler), jadi
# ambil hanya potongan dari '[' pertama sampai ']' terakhir sebelum diparse.
d1_id() {
  npx wrangler d1 list --json 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
start, end = raw.find("["), raw.rfind("]")
if start < 0 or end < 0:
    sys.exit(0)
try:
    rows = json.loads(raw[start:end + 1])
except json.JSONDecodeError:
    sys.exit(0)
print(next((r.get("uuid") or r.get("database_id") or "" for r in rows if r.get("name") == "'"$DB"'"), ""))
'
}
ID=$(d1_id)
if [ -z "$ID" ]; then
  echo "  database belum ada, membuat..."
  run npx wrangler d1 create "$DB"
  ID=$(d1_id)
fi
[ -n "$ID" ] || { echo "Gagal mendapat database_id untuk $DB. Cek: npx wrangler d1 list" >&2; exit 1; }
echo "  database_id: $ID"
# wrangler.jsonc masih memakai id lokal; ganti dengan id nyata supaya perintah remote jalan.
python3 - "$CONFIG" "$ID" <<'PY'
import re, sys
path, db_id = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
new, count = re.subn(r'"database_id":\s*"[^"]*"', f'"database_id": "{db_id}"', text, count=1)
if count != 1:
    sys.exit("database_id tidak ditemukan di " + path)
open(path, "w", encoding="utf-8").write(new)
print("  wrangler.jsonc diperbarui")
PY

step "3/7 Lewati R2"
# R2 tidak dipakai: mengaktifkannya butuh checkout langganan (kartu), dan foto katalog
# sudah dilayani Static Assets dari frontend/dist/products. Upload foto admin nonaktif.
# Butuh upload? aktifkan r2_buckets di backend/wrangler.jsonc lalu jalankan
#   npx wrangler r2 bucket create mabakit-media
echo "  dilewati (D1 + Static Assets saja)"

step "4/7 Migrasi D1 remote"
run npm run db:migrate:remote

step "5/7 Seed D1 remote"
# Seed idempoten (INSERT OR IGNORE); aman diulang, tidak menghapus pesanan.
run npm run db:seed:remote

step "6/7 Secret + deploy"
if npx wrangler secret list -c "$CONFIG" 2>/dev/null | grep -q 'DEMO_SECRET'; then
  echo "  DEMO_SECRET sudah ada, dilewati"
else
  # DEMO_SECRET hanya dipakai untuk hash kunci rate limit; nilai acak sudah cukup.
  SECRET="${DEMO_SECRET:-$(openssl rand -hex 32)}"
  printf '%s' "$SECRET" | npx wrangler secret put DEMO_SECRET -c "$CONFIG"
  echo "  DEMO_SECRET dibuat. Simpan kalau perlu reproduksi: $SECRET"
fi
# Output deploy ditangkap ke berkas sendiri supaya URL-nya bisa dibaca tanpa
# bergantung pada flush `tee` untuk log utama.
DEPLOY_OUT=/tmp/mabakit-deploy.log
printf '  $ npm run deploy\n'
npm run deploy 2>&1 | tee "$DEPLOY_OUT"

step "7/7 Verifikasi"
# Ambil URL hasil deploy, lalu tanya Worker-nya sendiri. Tanpa ini "selesai" hanya
# berarti perintahnya tidak error, bukan berarti situsnya hidup.
URL=$(grep -oE 'https://[A-Za-z0-9._-]+\.workers\.dev' "$DEPLOY_OUT" | tail -1 || true)
if [ -z "$URL" ]; then
  echo "  URL workers.dev tidak ditemukan di log. Buka dashboard Cloudflare untuk memastikan." >&2
  exit 1
fi
echo "  URL: $URL"

health=$(curl -fsS --max-time 20 "$URL/api/health" || true)
if [ "$health" != '{"ok":true,"mode":"demo"}' ]; then
  echo "  /api/health tidak sesuai: ${health:-<kosong>}" >&2
  exit 1
fi
echo "  /api/health ok"

faculties=$(curl -fsS --max-time 20 "$URL/api/catalog" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("faculties",[])))' || true)
if [ "$faculties" != "8" ]; then
  echo "  /api/catalog mengembalikan ${faculties:-0} fakultas, harusnya 8 (seed belum masuk?)" >&2
  exit 1
fi
echo "  /api/catalog ok (8 fakultas)"

printf '\n\033[32mSELESAI\033[0m — prototype hidup di %s\n' "$URL"
echo "  Login admin : mabakita@admin / admin123"
echo "  Login staf  : tim@demo.mabakit / staffmabakit123"
echo "  Login pembeli: pembeli@demo.mabakit / buyermabakit123"
echo "  Log lengkap : $PWD/$LOG"
