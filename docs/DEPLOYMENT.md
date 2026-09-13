# Deployment ke Streamlit Community Cloud

## Konfigurasi yang divalidasi

- Repository: `unVeroz007/gesturedoc-cloud`
- Branch kandidat: `codex/production-readiness`
- Entry point: `app_streamlit.py`
- Python: `3.12`, dipilih melalui **Advanced settings** saat membuat aplikasi
- Dependency file: `requirements.txt`
- Tidak memerlukan `packages.txt` karena seluruh dependency server berupa paket Python

Streamlit Community Cloud menjalankan aplikasi dari root repository. Struktur proyek ini menempatkan entry point, `requirements.txt`, dan `.streamlit/config.toml` pada lokasi yang sesuai.

## Secrets produksi

Masukkan nilai berikut melalui **App settings → Secrets**. Jangan commit file `secrets.toml` nyata.

```toml
GROQ_API_KEY = "gsk_isi_key_produksi"
AI_ENABLED = true
GROQ_MODEL = "openai/gpt-oss-20b"
GROQ_TIMEOUT_SECONDS = 10
AI_MAX_REQUESTS_PER_MINUTE = 30
```

`openai/gpt-oss-20b` telah diuji terhadap akun Groq yang tersedia selama pengerjaan. Jika akses model berubah, pilih model Groq yang mendukung JSON object mode, lalu jalankan kembali tes adapter dan smoke test nyata.

## Langkah staging

1. Pastikan GitHub Actions pada commit kandidat berstatus hijau.
2. Buka `share.streamlit.io`, pilih **Create app**, lalu masukkan repository, branch kandidat, dan `app_streamlit.py`.
3. Pada **Advanced settings**, pilih Python 3.12 dan tempel secrets produksi.
4. Buka URL staging melalui HTTPS dan pastikan halaman utama serta alur manual tampil.
5. Izinkan kamera. Pastikan status berubah menjadi **Kamera aktif**, pilihan gesture menghasilkan satu event, dan **Stop kamera** mematikan indikator kamera browser.
6. Uji satu topik dengan AI aktif, satu kali dengan `AI_ENABLED=false`, dan satu kali dengan key salah pada staging terpisah. Ketiganya harus tetap menampilkan informasi yang dapat dipahami.
7. Periksa log: tidak boleh ada API key, payload kamera, traceback berulang, atau data pengguna.
8. Setelah review konten dan privasi selesai, arahkan deployment produksi ke commit yang sama. Lindungi branch produksi agar pembaruan hanya berasal dari perubahan yang sudah lulus CI.

## Pemeriksaan setelah rilis

- Desktop Chrome/Edge: manual selection, Start/Stop, izin ditolak, dan AI/fallback.
- Android Chrome: layout, kamera depan, orientasi portrait, dan Stop.
- iPhone Safari: alur manual wajib; jangan mengklaim dukungan kamera iPhone sampai diuji pada perangkat nyata.
- Mode tab tersembunyi: dwell berhenti dan tidak memilih zona secara tidak sengaja.
- Refresh serta beberapa sesi: tidak ada error state yang menetap atau request Groq berulang.

## Operasi dan rollback

- Untuk gangguan Groq atau lonjakan penggunaan, ubah `AI_ENABLED=false` pada Secrets. Konten dasar tetap tersedia tanpa redeploy kode.
- Untuk masalah kamera/model CDN, pengguna tetap dapat memakai pilihan manual. Kembalikan commit deploy ke rilis hijau terakhir bila masalah berasal dari perubahan kode.
- Rotasi `GROQ_API_KEY` dari konsol Groq dan perbarui Secrets jika key dicurigai terekspos. Jangan menuliskan key pada issue atau log.
- Cache hanya berada di memori proses dan akan hilang saat aplikasi restart. Limiter juga per proses; sesuaikan batas akun Groq sebagai lapisan pengendalian utama.

## Gate publikasi yang memerlukan pemilik

Sebelum URL dipromosikan kepada pengguna umum, pemilik proyek perlu menyetujui materi 20 topik, menentukan kanal kontak untuk laporan konten, menetapkan quota/budget Groq, dan menjalankan uji perangkat nyata yang akan diklaim didukung. Semua gate teknis otomatis dan alur Chromium sintetis dicatat di [TEST_REPORT.md](TEST_REPORT.md).
