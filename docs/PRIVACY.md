# Pemberitahuan Privasi GestureDoc

Terakhir diperbarui: 14 September 2026

GestureDoc menyediakan informasi kesehatan umum berdasarkan area tubuh yang dipilih. Aplikasi tidak ditujukan untuk diagnosis, pengobatan, atau layanan darurat.

## Data kamera

Kamera hanya dimulai setelah pengguna menekan **Mulai kamera** dan memberikan izin browser. Frame diproses di perangkat pengguna oleh MediaPipe di dalam browser. Kode aplikasi tidak mengunggah, merekam, atau menyimpan frame kamera. Model dan berkas runtime MediaPipe diunduh dari jsDelivr dan Google-hosted MediaPipe model storage.

Pengguna dapat menekan **Stop kamera** kapan saja. Pilihan manual tersedia tanpa mengaktifkan kamera.

## Data yang dikirim ke server

Setelah pengguna memilih target, browser mengirim ID area dari katalog tetap ke server Streamlit. Server memvalidasi event dan tidak menerima gambar kamera. Untuk membuat ringkasan AI, server mengirim nama topik serta materi rujukan lokal kepada Groq. Aplikasi tidak meminta nama, alamat, rekam medis, atau uraian gejala pribadi.

## Penyimpanan

Aplikasi tidak menyediakan akun dan tidak menyimpan riwayat pilihan pengguna ke database. Hasil AI yang berhasil dapat disimpan sementara pada cache memori aplikasi selama maksimal 24 jam berdasarkan topik, model, bahasa, dan versi konten. Cache ini dipakai bersama untuk topik yang sama dan tidak berisi identitas pengguna.

Platform hosting, browser, CDN, dan Groq dapat memproses data teknis seperti alamat IP atau log permintaan sesuai kebijakan masing-masing. Pengelola deployment harus melengkapi kanal kontak dan kebijakan organisasi sebelum publikasi.

## Pilihan pengguna

Pengguna dapat menolak izin kamera dan tetap menggunakan daftar manual. Untuk menghentikan pemrosesan kamera, tekan **Stop kamera** atau tutup halaman. Jangan masukkan data kesehatan pribadi ke aplikasi karena tidak ada kolom yang membutuhkannya.
