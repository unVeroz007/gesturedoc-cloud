# GestureDoc

GestureDoc adalah aplikasi edukasi kesehatan berbasis Streamlit. Pengguna dapat memilih area tubuh secara manual atau dengan menunjuk pada visualisasi kamera. MediaPipe memproses landmark di browser; server menerima ID area yang telah divalidasi dan meminta Groq menyederhanakan materi rujukan. Jika Groq tidak tersedia, aplikasi tetap menampilkan konten dasar lokal.

> GestureDoc tidak mendiagnosis penyakit dan tidak menggantikan pemeriksaan tenaga kesehatan.

## Kemampuan utama

- 23 target visual yang dipetakan ke 20 topik kesehatan.
- Hand, pose, dan face landmark dari MediaPipe Tasks Vision 1.0.1.
- Gesture telunjuk dengan smoothing, dwell berbasis waktu, hysteresis, dan release latch.
- Tombol Start, Stop, Retry, serta pilihan manual yang tetap berfungsi tanpa kamera.
- Jawaban Groq berformat JSON, divalidasi ketat, dibatasi pada materi rujukan, dan diamankan dengan timeout, concurrency limit, rate limit, cache, serta fallback.
- Kamera hanya aktif setelah tindakan pengguna dan dihentikan saat tombol Stop atau halaman ditutup.

## Menjalankan secara lokal

Prasyarat: Python 3.12 dan Node.js 20 atau versi LTS yang lebih baru.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m streamlit run app_streamlit.py
```

Isi `GROQ_API_KEY` pada `.env`. Aplikasi dapat dijalankan tanpa key dengan `AI_ENABLED=false`; semua topik akan memakai konten dasar.

## Pengujian

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
npm ci
npm test
npx playwright install chromium
npm run test:e2e
```

Uji end-to-end memakai kamera sintetis Chromium dan memuat model MediaPipe versi yang sama dengan produksi.

## Struktur

```text
app_streamlit.py          antarmuka dan state sesi
ai_engine.py              adapter Groq dan validasi respons
health_service.py         fallback, cache, limiter, dan orkestrasi AI
zone_catalog.py           katalog zona tunggal untuk Python/browser
session_logic.py          kontrak event komponen
content/                  materi kesehatan dasar dan sumber
frontend/                 komponen kamera, geometri, gesture, dan tes JS
tests/                    tes Python dan Streamlit AppTest
docs/                     rencana, deployment, privasi, dan laporan verifikasi
```

Petunjuk rilis lengkap ada di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Praktik data dijelaskan di [docs/PRIVACY.md](docs/PRIVACY.md).

## Lisensi

Kode tersedia di bawah [MIT License](LICENSE). Dependency dan aset pihak ketiga dicatat di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); materi pada situs sumber tetap mengikuti ketentuan masing-masing.
