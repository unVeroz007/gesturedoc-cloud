# Security Policy

## Melaporkan masalah

Jangan membuka issue publik yang memuat API key, data pribadi, atau detail eksploitasi yang aktif. Pemilik repository perlu menambahkan alamat kontak keamanan sebelum rilis publik.

## Pengelolaan rahasia

- Simpan `GROQ_API_KEY` lokal di `.env` atau `.streamlit/secrets.toml` yang diabaikan Git.
- Pada Streamlit Community Cloud, masukkan key melalui **App settings → Secrets**.
- Gunakan placeholder pada file contoh dan rotasi key yang pernah dipublikasikan.
- Log aplikasi hanya mencatat kategori kegagalan dan ID topik, bukan key atau respons mentah.

## Batas kepercayaan

Event dari komponen browser dianggap tidak tepercaya dan divalidasi terhadap versi protokol, instance, urutan event, reset revision, ukuran, serta katalog zona. Teks keluaran AI harus lolos schema dan pemeriksaan markup sebelum dirender. Kamera diproses di browser dan tidak dikirim ke server aplikasi.
