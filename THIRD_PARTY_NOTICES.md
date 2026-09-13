# Third-party notices

GestureDoc memakai komponen berikut. Daftar dependency transitif lengkap dan versinya terdapat pada environment Python hasil `requirements.txt` serta `package-lock.json`.

| Komponen | Versi kandidat | Lisensi metadata paket | Penggunaan |
| --- | --- | --- | --- |
| Streamlit | 1.58.0 | Apache-2.0 | server dan antarmuka aplikasi |
| Groq Python SDK | 1.4.0 | Apache-2.0 | akses Groq API dari server |
| python-dotenv | 1.2.2 | BSD-3-Clause | konfigurasi lokal |
| MediaPipe Tasks Vision | 1.0.1 | Apache-2.0 | hand, pose, dan face landmark di browser |

Model Hand Landmarker, Pose Landmarker Lite, dan Face Landmarker diunduh saat runtime dari penyimpanan model MediaPipe milik Google. jsDelivr menyajikan paket JavaScript/WASM MediaPipe yang versinya dikunci. Materi kesehatan ditautkan ke MedlinePlus/National Library of Medicine dan WHO; aplikasi tidak menyalin artikel sumber secara utuh.

Lisensi dan ketentuan upstream tetap berlaku. Pemeriksaan rilis harus mengulang review bila dependency, model, atau cara distribusinya berubah.
