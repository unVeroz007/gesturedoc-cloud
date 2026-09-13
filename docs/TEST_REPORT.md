# Laporan verifikasi kandidat GestureDoc

| Metadata | Nilai |
| --- | --- |
| Tanggal | 14 September 2026 |
| Branch | `codex/production-readiness` |
| Target | Streamlit Community Cloud, Python 3.12, aplikasi publik |

## Hasil otomatis

| Pemeriksaan | Hasil | Cakupan utama |
| --- | --- | --- |
| `python -m pytest -q` | 29 lulus | katalog 23 zona/20 topik, parser dan deduplikasi event, reset, schema AI, klasifikasi error, fallback, cache, cooldown, limiter, Streamlit AppTest |
| `npm test` | 9 lulus | mirror transform, geometri zona, validitas landmark, prioritas overlap, gesture telunjuk, smoothing, dwell berbasis waktu, grace, latch, reset |
| `npm run test:e2e` | 4 lulus | render desktop, alur manual, layout mobile, pembatalan saat model dimuat, pemuatan tiga model MediaPipe, dua siklus Start/Stop kamera sintetis |
| Fresh Python 3.12 melalui `uv run --python 3.12` | 29 lulus | dependency runtime dan test suite pada versi Python deployment |
| `python -m compileall` | lulus | sintaks seluruh modul dan tes Python |
| `python -m pip check` | lulus | tidak ada dependency Python rusak pada environment uji |
| `python -m pip_audit -r requirements.txt` | lulus | tidak ada kerentanan yang diketahui pada dependency runtime saat diperiksa |
| `npm audit --omit=dev` | lulus | tidak ada kerentanan dependency runtime yang diketahui saat diperiksa |
| `git diff --check` | lulus | tidak ada whitespace error pada patch |
| Secret pattern scan | lulus | tidak ada pola key/private key di kandidat; `.env` dan secrets nyata diabaikan Git |

## Verifikasi integrasi

- Groq API nyata berhasil menjawab JSON object memakai `openai/gpt-oss-20b`, lalu respons lolos validator empat field. Model awal `llama-3.3-70b-versatile` tidak tersedia pada akun dan sudah diganti dari default.
- Ketiga model MediaPipe 1.0.1 berhasil dimuat pada Chromium melalui URL versi tetap. Status mencapai **Kamera aktif**, lalu Stop menyembunyikan stage dan alur dapat dimulai ulang.
- Seluruh 16 URL sumber unik memberi respons HTTP 200 atau 206 pada pemeriksaan. Sumber berasal dari MedlinePlus/National Library of Medicine dan WHO.
- QA visual dilakukan pada viewport desktop 1440×1000 dan mobile 390×844. Tidak ditemukan overlap, clipping kontrol, atau teks yang tidak dapat dibaca. Panel informasi mobile dapat dicapai melalui scroll.
- Aplikasi tetap berfungsi dengan `AI_ENABLED=false`; alur browser otomatis menjalankan mode ini sehingga CI tidak memakai key produksi.

## Batas bukti

Tes kamera memakai video sintetis Chromium. Akurasi menunjuk pada manusia, kondisi pencahayaan, Android Chrome, dan iPhone Safari perlu diuji pada perangkat nyata sebelum platform tersebut dipromosikan sebagai dukungan produksi. Deployment HTTPS di Streamlit Community Cloud juga perlu smoke test setelah branch tersedia di GitHub.

Konten lokal bersumber dan dibatasi sebagai informasi umum, tetapi belum memiliki persetujuan reviewer domain kesehatan. Pemilik perlu menyelesaikan review 20 topik, kanal pelaporan, serta quota/budget Groq sebelum menyebarkan URL kepada pengguna umum. Status ini sengaja dicatat sebagai `reference_sourced_pending_domain_review` pada katalog.
