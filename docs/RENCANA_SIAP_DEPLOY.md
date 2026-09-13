# Rencana perbaikan dan kesiapan deploy GestureDoc

Tanggal penyusunan: 13 September 2026. Target yang dipilih pengguna: **Streamlit Community Cloud, aplikasi publik untuk pengguna umum**.

Status implementasi per 14 September 2026: **kandidat rilis teknis selesai dan tervalidasi lokal**. Gate yang memerlukan akun Streamlit Cloud, perangkat pengguna nyata, keputusan quota, kontak pengelola, dan review domain kesehatan tetap dicatat terbuka; lihat `docs/TEST_REPORT.md`.

## 1. Hasil yang dituju

GestureDoc menjadi aplikasi edukasi kesehatan berbahasa Indonesia: pengguna memilih area tubuh melalui kamera atau kontrol manual, lalu membaca informasi umum yang jelas sumber dan batasannya. Kamera membantu navigasi area tubuh; kamera tidak mendiagnosis penyakit.

Definisi selesai adalah seluruh persyaratan rilis di bagian 14 terbukti lulus pada commit yang akan diterbitkan. Tidak ada jaminan perangkat lunak bebas seluruh bug atau deteksi selalu benar pada semua tubuh, kamera, dan pencahayaan. Perangkat yang didukung, kondisi uji, dan kegagalan yang bisa dipulihkan harus jelas.

Keputusan utama:

1. Pertahankan Python + Streamlit dan pemrosesan kamera di browser.
2. Benahi geometri, event, reset, dan penanganan kegagalan sebelum penyempurnaan visual.
3. Pertahankan alur AI Groq, tetapi batasi ke topik resmi, validasi jawabannya, dan siapkan informasi dasar terkurasi saat AI tidak tersedia.
4. Gunakan API MediaPipe Tasks yang diuji dan versi aset yang dikunci untuk rilis publik; migrasi dilakukan sebagai tahap tersendiri dengan perbandingan hasil.
5. Sediakan pilihan zona manual yang tetap berguna ketika kamera ditolak, perangkat lambat, atau gesture sulit dilakukan.
6. Rilis pertama menargetkan penggunaan publik berskala kecil dengan batas penggunaan yang nyata. Kapasitas besar atau layanan selalu aktif memerlukan evaluasi hosting terpisah.

Tidak menjadi pekerjaan rilis pertama: database pasien, akun dan riwayat kesehatan, diagnosis personal, upload rekaman, aplikasi native, pelatihan model sendiri, banyak provider AI, atau migrasi seluruh UI ke React. Tambahkan hanya jika kebutuhan berikutnya membuktikan manfaatnya.

## 2. Baseline dan bukti

Baseline awal yang diperiksa berisi 936 baris dalam dua file Python dan satu file HTML gabungan. Saat itu belum ada metadata Git lokal, README, test suite tersimpan, lockfile, atau konfigurasi deployment khusus. `.env` berisi key lokal dan nilainya tidak pernah dicantumkan. Implementasi sesudah baseline berada pada branch `codex/production-readiness`.

| Bagian | Bukti lokasi | Perilaku sekarang |
| --- | --- | --- |
| Komponen dan state | [app_streamlit.py](../app_streamlit.py) | Baseline memakai deduplikasi timestamp dan state yang belum tersinkron penuh. |
| Pemrosesan dan reset | [app_streamlit.py](../app_streamlit.py) | Baseline mencache error dan reset hanya pada sisi Python. |
| Layanan AI | [ai_engine.py](../ai_engine.py) | Baseline memakai format pipe-separated dan mengembalikan error sebagai teks kesehatan. |
| Geometri | [index.html](../frontend/index.html) | Baseline memiliki 20 zona; beberapa sendi memakai titik tengah kiri-kanan. |
| Skeleton | [index.html](../frontend/index.html) | Baseline menggambar X skeleton berbeda dari video dan zona yang dicerminkan. |
| Kamera dan loop | [index.html](../frontend/index.html) | Baseline menyalakan kamera otomatis, memakai dwell berbasis frame, dan menaruh error hanya di console. |
| Dependensi | [requirements.txt](../requirements.txt) | Baseline hanya memakai batas versi minimum dan belum mengunci aset MediaPipe. |

Sudah dibuktikan sebelumnya: sintaks Python/JavaScript valid; simulasi parser, cache, pemilihan zona, cooldown, dan geometri; render awal dan Reset awal melalui Streamlit AppTest. Ini belum membuktikan kamera di iframe, kualitas deteksi manusia, atau request Groq pada Cloud.

Lingkungan yang diperiksa: Python 3.10.10, Streamlit 1.58.0, Groq SDK 1.4.0, python-dotenv 1.2.2. Ini baseline, bukan keputusan otomatis versi produksi. SDK lokal memiliki `max_retries=2` dan timeout fase baca 60 detik; aplikasi awal tidak mengaturnya sendiri. Pada implementasi 14 September 2026, smoke test membuktikan `llama-3.3-70b-versatile` mengembalikan `model_not_found` untuk akun yang tersedia. Groq API tetap digunakan dengan default `openai/gpt-oss-20b`, yang berhasil merespons JSON mode; `GROQ_MODEL` tetap dapat dikonfigurasi.

SHA-256 baseline untuk memastikan bukti tetap merujuk kode yang sama:

```text
app_streamlit.py    e965d5e20e6e6024e087cdfb365643e35fa0af4d8e37f4444f6685a754d476ab
ai_engine.py        2623f93a4e775b3058f61c9271c3bce216a0c86b8b4e43c8bcc70c6c3773ab9a
frontend/index.html f4931d6d7dad8818c098756c11bb474af599b476adea8ba08dd9e6554503d6e4
requirements.txt   277dfe23efb314ac2b3f7334cdee7a68e865d3913dc6a5fbfca6889052c0afc5
```

## 3. Batas platform yang memengaruhi desain

Streamlit Community Cloud men-deploy kode dari GitHub dan menyediakan pengelolaan secrets. Gunakan versi Python yang sama pada pengujian dan deployment serta dependency yang dikunci. Informasi ini menjadi dasar prosedur rilis, bukan asumsi bahwa paket lokal otomatis tersedia di Cloud. [Dokumentasi dependency Streamlit](https://docs.streamlit.io/deploy/concepts/dependencies), [deployment Community Cloud](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app).

Community Cloud mempunyai batas resource dan hibernasi setelah tidak ada trafik selama 12 jam menurut dokumentasi yang diperiksa. Karena itu, rilis tidak menjanjikan uptime 24/7 atau cold start instan. Uji bangun dari hibernasi dan tetapkan kapan kebutuhan harus dipindahkan ke hosting dengan kapasitas terjamin. [Pengelolaan aplikasi Community Cloud](https://docs.streamlit.io/deploy/streamlit-community-cloud/manage-your-app).

Google mencantumkan penghentian dukungan MediaPipe Legacy Solutions sejak 1 Maret 2023 dan menyediakan penggantinya, termasuk Hand, Pose, dan Face Landmarker. Kode/binary legacy tersedia apa adanya. Migrasi tetap harus diuji karena penggantian nama paket saja tidak menjamin hasil atau performa sama. [Panduan MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide).

Kamera memerlukan secure context, izin pengguna, dan izin iframe dari halaman induk. HTTPS saja belum membuktikan konfigurasi iframe benar. Jangan mematikan proteksi browser atau CORS/XSRF untuk membuat kamera bekerja. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## 4. Prioritas pekerjaan

P0 berarti dapat menyebabkan pemilihan salah, informasi menyesatkan, penggunaan rahasia/kuota tidak terkendali, atau alur inti gagal. P1 berarti wajib untuk rilis publik yang ditargetkan. P2 merupakan pengembangan lanjutan dan bukan alasan memperpanjang rilis setelah seluruh gate P0/P1 lulus.

| ID | Prioritas | Pekerjaan | Bukti penerimaan utama |
| --- | --- | --- | --- |
| G01 | P0 | Satukan transformasi koordinat video, skeleton, pointer, zona. | Fixture asimetris dan uji manusia kiri-kanan selaras. |
| G02 | P0 | Pisahkan target sendi kiri-kanan; ikuti orientasi torso. | Tidak ada zona sendi di titik tengah kosong; jantung mengikuti sisi anatomis yang benar. |
| G03 | P0 | Validasi landmark, visibility/presence, skala, dan kesegaran hasil. | Zona yang tidak dapat dipercaya tidak menerima trigger. |
| G04 | P1 | Deteksi telunjuk terulur, stabilisasi pointer, aturan overlap. | Negative gesture dan jitter tidak sering memilih zona. |
| G05 | P0 | Dwell berbasis waktu dan latch setelah pemilihan. | Durasi konsisten pada 10/20/30 FPS; hold tidak memicu berulang. |
| S01 | P0 | Kontrak event, validasi server, deduplikasi dan revision reset. | Pesan duplikat, invalid, lama, dan pasca-reset ditolak. |
| S02 | P0 | Sinkronkan reset dan status aktif dua arah. | Canvas dan panel kosong bersama; zona lama tidak muncul kembali. |
| S03 | P1 | Definisikan loading, antrean, dan interaksi selama AI bekerja. | Maksimal satu request aktif per sesi; UI tidak mengaku membatalkan request sinkron. |
| C01 | P0 | Mulai/Stop kamera eksplisit serta teardown. | Tidak ada kamera sebelum tindakan pengguna; Stop melepas track. |
| C02 | P1 | Recovery izin, kamera sibuk, CDN/model gagal, tab tersembunyi. | Tidak ada loading tanpa jalan keluar; tersedia retry atau pilihan manual. |
| M01 | P1 | Migrasi dan pin MediaPipe Tasks, model, WASM. | Startup nyata dan perbandingan akurasi/performa lulus. |
| M02 | P1 | Jadwal inferensi, worker, pembuangan frame lama. | Kamera dan kontrol responsif; tidak ada antrean frame tak terbatas. |
| A01 | P0 | Respons AI terstruktur dan validasi schema. | Output invalid/kosong/tidak cocok zona tidak tampil sebagai jawaban sukses. |
| A02 | P0 | Klasifikasi error, timeout, retry yang dibatasi. | 401/403/429/5xx/timeout/budget cap punya jalur yang benar. |
| A03 | P0 | Cache sukses, retry kegagalan, deduplikasi lintas sesi. | Error tidak menjadi cache sukses; satu miss serentak tidak membanjiri Groq. |
| A04 | P0 | Pembatasan request, batas biaya provider, sakelar AI. | Trafik berlebih beralih ke konten dasar dan tidak memicu loop request. |
| H01 | P0 | Kontrak edukasi, sumber konten, review dan fallback per topik. | Tidak ada klaim diagnosis; konten dasar setiap topik diperiksa dan memiliki sumber. |
| U01 | P1 | Pemilihan manual dan tampilan responsif. | Semua topik dapat diakses tanpa kamera dengan mouse/keyboard. |
| U02 | P1 | Status yang dapat dibaca, label kiri-kanan, bantuan singkat. | Informasi penting tidak hanya ada di canvas atau warna. |
| P01 | P0 | Secrets, sanitasi output, pembatasan pesan dan data log. | Key tidak ada di frontend/Git/log; data invalid tidak memanggil AI. |
| D01 | P1 | Repository, environment bersih, pin/lock dependency dan lisensi. | Fresh checkout dapat dijalankan dengan langkah terdokumentasi. |
| T01 | P1 | Test otomatis dan matriks uji perangkat/kamera. | Seluruh gate relevan lulus pada release commit. |
| D02 | P1 | Staging Cloud, rilis, rollback, panduan insiden. | Alur kamera nyata di Cloud dan latihan rollback berhasil. |
| O01 | P1 | Log terstruktur dan catatan kapasitas/budget. | Operator dapat membedakan error kamera, aplikasi, provider, dan kuota. |
| X01 | P2 | Histori, akun, visual tambahan, analitik lanjutan. | Ditinjau sebagai kebutuhan baru setelah rilis stabil. |

## 5. Desain geometri dan interaksi yang akan diterapkan

### 5.1 Satu sistem koordinat

Simpan landmark dalam ruang koordinat sumber; gunakan satu fungsi transformasi ke canvas untuk seluruh overlay. Cerminkan tampilan kamera depan sekali saja. Kamera belakang menggunakan kebijakan mirror yang eksplisit dan diuji. Pisahkan resolusi internal canvas dari ukuran CSS dan hitung faktor skala; jika memakai device pixel ratio, pointer dan radius harus mengikuti transformasi yang sama.

Gunakan fixture tidak simetris: bahu kiri dan kanan berbeda tinggi/posisi; tubuh miring; kedua tangan berada di sisi berbeda. Fixture simetris tidak cukup mendeteksi bug mirror. Lakukan uji manusia dengan pengguna mengangkat tangan kiri yang diketahui, lalu cocokkan label anatomis; komentar kode tentang kiri-kanan tidak dianggap bukti.

### 5.2 Pisahkan area visual dari topik kesehatan

Gunakan ID stabil seperti `wrist_left` dan `wrist_right`, keduanya memetakan ke topik `wrist`. Label Indonesia menjadi data tampilan, bukan identitas cache.

Rencana menghasilkan **23 target visual dan 20 topik kesehatan**: tiga target gabungan saat ini (pergelangan tangan, lutut, pergelangan kaki) masing-masing dipecah kiri-kanan. Topik mata/bahu/siku/telinga kiri-kanan yang sudah terpisah tetap dipertahankan. Jumlah ini harus diverifikasi oleh test katalog agar frontend, server, dan konten tidak berbeda.

Definisi katalog memuat `zone_id`, `topic_id`, label, sisi, prioritas pemilihan, dan deskripsi prompt. Python mengirim data publik yang diperlukan melalui argumen komponen; key dan konfigurasi internal tidak ikut dikirim.

### 5.3 Bentuk tubuh dan kualitas landmark

Lebar bahu dihitung sebagai jarak Euclidean dalam satuan piksel, bukan selisih X saja. Gunakan sumbu bahu dan vektor tengah bahu menuju tengah pinggul untuk mengorientasikan zona torso. Offset jantung diarahkan ke sisi kiri anatomis berdasarkan landmark, bukan selalu mengurangi koordinat layar X.

Radius proporsional dibatasi minimum/maksimum agar tidak nol atau mendominasi tubuh. Batas dipilih dari hasil uji, bukan angka arbitrer yang dinyatakan akurat. Sendi kiri tetap bisa ditampilkan bila sendi kanan tidak terlihat, selama bukti lokal dan skala yang dipakai valid.

Validasi koordinat finite, indeks tersedia, ukuran tubuh memadai, visibility/presence bila disediakan model, dan umur hasil inferensi. Jangan mengisi landmark yang hilang dengan titik buatan untuk menerima trigger. Landmark di luar frame atau berkualitas rendah tidak menjadi zona aktif. Area telinga dari model wajah harus dilabeli sebagai perkiraan area sekitar telinga bila landmark tidak menunjukkan telinga secara langsung.

Rilis pertama ditujukan untuk satu orang dalam frame. Uji asosiasi wajah, pose, dan tangan agar tidak mencampur orang; jika bukti asosiasi meragukan, hentikan pemilihan dan minta satu orang mendekat. Jangan mengklaim deteksi semua kasus banyak orang jika model dikonfigurasi hanya satu.

### 5.4 Gesture, hover dan overlap

Gunakan ukuran relatif dan sudut sendi untuk menilai telunjuk terulur; jangan hanya membandingkan koordinat Y karena tangan bisa berotasi. Pilih satu pointer aktif dengan kontinuitas posisi; jangan berpindah pointer hanya karena urutan hasil model berubah. Uji tangan terbuka, mengepal, telunjuk menekuk, dan kedua tangan terlihat.

Untuk sendi pada tangan yang menjadi pointer, cegah pemilihan diri yang tidak disengaja. Pengguna dapat memakai tangan berlawanan; pemilihan manual tetap tersedia. Bila dukungan dua tangan diperlukan, ukur dampaknya sebelum menaikkan jumlah deteksi.

Parameter awal untuk kalibrasi: dwell 1.000 ms, grace kehilangan singkat 100 ms, hasil dianggap basi setelah 250 ms. Waktu menggunakan clock monotonic seperti `performance.now()`. Jeda tab tersembunyi, model macet, atau kehilangan tracking tidak dihitung sebagai dwell valid. Angka ini adalah kandidat uji dan boleh berubah dengan bukti.

Sesudah selection, latch zona sampai pointer keluar dari target selama interval pelepasan atau pengguna memilih target lain. Reset mengharuskan pelepasan target sebelum zona yang sama dapat dipicu lagi. Ini menghapus request periodik setiap tiga detik saat pengguna menahan jari.

Pertahankan keutamaan area spesifik di dalam area besar menggunakan prioritas eksplisit, lalu jarak yang dinormalisasi radius sebagai pembeda. Tambahkan hysteresis tepi agar target tidak berkedip saat pointer berada di batas. Test harus membuktikan area kecil masih terjangkau setelah radius diskalakan.

Perbarui state sebelum menggambar. Progress mencapai 100% pada konfirmasi, lalu tampilkan status terpilih tanpa loop progress palsu. Teks persentase atau status juga tersedia sebagai elemen DOM.

## 6. State dan kontrak komponen

Python memiliki selected zone, hasil kesehatan, dan status request. Frontend memiliki stream kamera, landmark, pointer, dan kandidat hover. Python mengirim selected zone yang telah diterima untuk menyamakan status canvas; frontend membedakan kandidat lokal dan pilihan yang sudah diterima server.

Contoh event yang direncanakan:

```json
{
  "protocol_version": 1,
  "component_instance_id": "instance-baru-saat-mount",
  "event_id": 17,
  "reset_revision": 3,
  "type": "zone_selected",
  "zone_id": "wrist_left"
}
```

Argumen Python ke frontend mencakup `protocol_version`, `reset_revision`, `selected_zone_id`, `request_status`, `interaction_enabled`, dan katalog publik. `component_instance_id` berubah saat mount ulang; `event_id` naik dalam instance. Timestamp browser bukan identitas request atau bukti keamanan.

Validasi di server: tipe object, daftar field/jenis event yang diterima, panjang string, integer terbatas, versi, zone allowlist, instance aktif, urutan event, dan revision reset. Batasi ukuran payload, misalnya 2 KB sebagai kandidat awal. Frontend tidak boleh menentukan prompt, model, cache key, URL, atau batas kuota server.

Gunakan key komponen stabil dan uji identitasnya ketika argumen berubah. Event lama tidak boleh diproses lagi setelah rerun, reconnect, atau Reset. Handshake ready menandai instance aktif tanpa memanggil Groq. Simpan sedikit state deduplikasi yang terbatas, bukan daftar event yang tumbuh selamanya.

Reset menaikkan revision, menghapus pilihan dan hasil, serta mengirim revision baru ke frontend. Frontend membersihkan hover, progress, highlight dan latch dengan syarat pelepasan target. Reset tidak menghapus cache jawaban valid, tidak membuka ulang kamera, dan tidak mengirim request AI.

Versi awal tetap memakai request Python sinkron yang waktunya dibatasi. Selama request berlangsung, kontrol pilihan dan Reset dinonaktifkan dengan status yang jelas; tombol Stop kamera lokal tetap berfungsi. Jangan menampilkan tombol Cancel yang seolah membatalkan request provider. Peralihan ke model async hanya diperlukan jika pengujian menunjukkan UX sinkron tetap gagal memenuhi target.

Kontrak `postMessage` harus memeriksa source parent, tipe, dan struktur. Pelajari origin/referrer serta perilaku sandbox pada staging sebelum menetapkan target origin. Pakai origin parent yang terverifikasi ketika tersedia; jika handshake framework mengharuskan wildcard, batasi pada pesan protokol tanpa rahasia dan dokumentasikan alasannya. Jangan sekadar memaksakan `window.location.origin` yang mungkin berbeda dari parent. [Panduan postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

## 7. Kamera, MediaPipe, dan performa

### 7.1 Lifecycle kamera

Alur UI: penjelasan singkat → tombol Mulai Kamera → meminta izin → memuat model → tracking siap. Pengguna juga dapat langsung memilih area secara manual. Hilangkan fallback auto-start setelah 1,5 detik untuk rilis publik.

Sediakan Stop dan Coba Lagi. Stop membatalkan jadwal frame, menghentikan semua track, mengosongkan `srcObject`, menutup model, serta membuang hasil lama. Cleanup harus idempotent pada stop, unmount, kegagalan startup, dan pergantian kamera.

Tangani izin ditolak, kamera tidak ada, kamera sibuk, constraint gagal, video gagal play, izin dibiarkan tanpa jawaban, model gagal download, WASM gagal, dan perangkat kehilangan kamera. Gunakan batas waktu status UI untuk menawarkan retry/manual; jangan menyatakan browser sudah membatalkan dialog izin. Bila promise izin akhirnya selesai setelah pengguna Stop, track yang datang terlambat langsung dihentikan memakai token generasi kamera.

Saat tab tersembunyi, pause inferensi dan reset dwell. Saat kembali, lanjut hanya jika kamera masih diizinkan dan stream masih valid; jangan membuat stream ganda. Pergantian kamera mobile harus menghentikan stream sebelumnya dan memperbarui kebijakan mirror.

### 7.2 Migrasi yang bisa diverifikasi

Ekstrak logika geometri/state yang dapat diuji, rekam baseline, lalu ganti adapter model ke `@mediapipe/tasks-vision`. Pin versi JS, WASM dan model sebagai satu pasangan yang diuji. Catat sumber, versi/checksum, ukuran download, serta lisensi aset. Semua file runtime harus tersedia dalam artefak deploy; jangan bergantung pada build Node otomatis di Community Cloud.

Implementasi memakai ES module statis yang langsung disajikan oleh komponen Streamlit. Paket `@mediapipe/tasks-vision` dikunci pada 1.0.1 di lockfile dan URL CDN; tiga URL model juga menunjuk revisi tetap. Tidak ada tahap build Node yang diperlukan oleh Community Cloud. Konten manual tetap dapat dibuka ketika aset eksternal gagal dimuat.

MediaPipe Tasks 1.0.1 terbukti gagal di module Web Worker karena loader Emscripten membutuhkan `importScripts`. Implementasi final memakai API video yang didukung pada main thread, dengan tangan dibatasi 10 Hz serta pose/wajah dijalankan bergantian pada interval 260 ms. Hasil memiliki batas umur dan loop berhenti saat tab tersembunyi atau kamera dihentikan. Profil ini lulus pengujian Chromium sintetis; pilihan manual tetap menjadi fallback. [Hand Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Pose Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Face Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js).

Pisahkan jadwal drawing dari inferensi; proses hanya frame video baru. Kandidat frekuensi awal: tangan 15–20 Hz, pose/wajah 5–10 Hz, dengan penurunan otomatis saat perangkat lambat. Ukur umur hasil agar frekuensi rendah tidak mengaktifkan zona yang telah hilang. Jangan menjalankan semua model tiga kali lipat hanya untuk mengejar FPS visual.

Kriteria migrasi: semua 23 target tetap benar pada fixture, label kiri-kanan lulus uji nyata, startup Cloud berhasil, kontrol kamera responsif, dan performa memenuhi matriks perangkat. Simpan baseline sebagai commit untuk rollback; tidak perlu memelihara dua engine produksi permanen.

## 8. AI, cache, kuota, dan konten kesehatan

### 8.1 Format dan batas konten

Ganti string pipe-separated dengan object tervalidasi: `topic_id`, `common_conditions`, `common_symptoms`, `prevention`, `seek_care`. Metadata seperti sumber, versi, dan label AI diisi aplikasi dari katalog, bukan dipercaya dari model.

Gunakan daftar topic resmi, prompt system edukatif, konteks sumber yang dikurasi, dan panjang field yang masuk akal. Hilangkan aturan keras 15 kata yang dapat memotong konteks penting. Jangan meminta diagnosis pengguna, probabilitas penyakit, dosis obat, atau menyimpulkan kondisi dari gambar. Status pemilihan menggunakan kata “Zona dipilih”, bukan “penyakit terdeteksi” atau “menganalisis tubuh”.

Konfigurasi awal mempertahankan model sekarang hanya jika uji availability, kualitas Indonesia, format, dan waktu respons lulus. JSON mode dapat digunakan, tetapi JSON valid tidak berarti schema valid; parsing dan validasi lokal tetap wajib. Jangan menganggap semua model mendukung strict JSON schema. [Structured outputs Groq](https://console.groq.com/docs/structured-outputs).

Konten dasar per 20 topik harus memiliki sumber otoritatif yang dipilih dan diperiksa saat penyusunan konten, tanggal review, dan reviewer. Bagian kondisi, gejala, pencegahan, dan kapan mencari bantuan harus diperiksa sebelum rilis publik. Jawaban AI berupa penyederhanaan/penjelasan konten tersebut dan ditandai sebagai AI; jangan menampilkan seolah sudah ditinjau manusia setiap kali dihasilkan.

Validasi schema hanya membuktikan bentuk data, bukan kebenaran kesehatan. Buat evaluasi terpisah per topik untuk kecocokan dengan sumber, klaim diagnosis personal, rekomendasi obat/dosis, kepastian berlebihan, dan hilangnya informasi penting. Reviewer menilai sampel output pada versi model/prompt yang akan dirilis; perubahan model/prompt mengulang evaluasi tersebut. Jika kualitas generasi belum lulus, tampilkan hanya konten dasar yang telah ditinjau dan nonaktifkan generation publik sampai masalahnya selesai.

Pemilik proyek menunjuk reviewer konten yang kompeten. Jika review belum selesai, rilis publik informasi kesehatan lengkap belum lulus H01; staging teknis tetap bisa diuji dengan konten contoh yang jelas. Ini gate mutu produk publik, bukan klaim sertifikasi medis atau hukum.

Ketika AI mati, key salah, kuota habis, atau jawaban invalid, tampilkan konten dasar yang telah direview beserta status AI yang jujur. Jangan mencache error sebagai penyakit. Bila konten fallback belum tersedia untuk suatu topik, tampilkan status unavailable; jangan membuat fallback medis tanpa sumber.

### 8.2 Result dan error eksplisit

Layanan mengembalikan result dengan status `success`, `unavailable`, `rate_limited`, `invalid_response`, atau `configuration_error`; hanya `success` berisi jawaban AI valid. Pisahkan error API dari content. Tangani jawaban kosong, `None`, hasil terpotong, field hilang, topik tidak cocok, field terlalu panjang, dan HTML/link yang tidak diizinkan.

Tetapkan timeout connect/read/write/pool. Kandidat awal connect 3 detik dan read 8 detik dengan `max_retries=0`; validasi latensi nyata sebelum menetapkan angka produksi. Timeout per fase bukan jaminan batas total wall-clock, sehingga lakukan uji fault injection terhadap keseluruhan alur. Target UX kegagalan sekitar 15 detik menjadi gate pengukuran, bukan klaim otomatis dari konfigurasi timeout.

Rilis awal memakai Coba Lagi eksplisit setelah cooldown, tanpa retry otomatis bertumpuk. 401/403 dan model tidak tersedia tidak diretry otomatis. Pada 429, hormati `Retry-After` dan simpan waktu boleh mencoba kembali. Untuk error sementara, pengguna dapat retry setelah cooldown; jika kelak ditambahkan retry otomatis, batasi satu lapisan dan satu anggaran waktu. SDK sendiri mempunyai retry bawaan sehingga harus dikonfigurasi, bukan ditambah loop tanpa perhitungan. [Groq Python SDK](https://github.com/groq/groq-python), [rate limits Groq](https://console.groq.com/docs/rate-limits).

### 8.3 Cache yang terbatas dan aman dibagikan

Cache hanya data edukasi generik yang valid, dengan key `(topic_id, language, model_id, prompt_version, content_version)`. Untuk rilis awal bahasa hanya Indonesia; bahasa tidak menjadi fitur baru. Batas awal cache 64 entri, TTL 24 jam, dan invalidasi saat versi konten/prompt berubah.

Cache jawaban generik boleh dibagikan antarsesi karena tidak mengandung riwayat atau data personal. State pilihan pengguna tetap khusus sesi. Gunakan koordinasi thread-safe untuk mencegah beberapa sesi dengan cache miss topik yang sama menghasilkan request bersamaan. Exception harus selalu melepas lock; cache sukses harus menyimpan salinan aman/immutable.

Error mempunyai cooldown terpisah, bukan isi cache sukses. Reset dan refresh halaman tidak boleh menghapus cache global. Jika AI gagal, retry yang sah harus tetap dapat memanggil layanan setelah cooldown; cache fallback tidak boleh menutupi kebutuhan tersebut.

### 8.4 Pengendalian penggunaan publik

Semua batas ditegakkan server-side sebelum panggilan Groq: maksimum satu request aktif per sesi, concurrency global awal dua request, throttle per sesi, dan batas global proses sesuai kuota akun. Validasi katalog membatasi variasi prompt menjadi topik resmi. Jika kapasitas penuh, tampilkan fallback; jangan membuat antrean tanpa batas.

Counter sesi atau memori proses dapat hilang saat restart dan dapat dilewati melalui sesi baru. Karena itu, counter tersebut bukan perlindungan biaya yang tahan restart dan bukan jaminan anti-abuse. Wajib periksa kuota organisasi, pembatasan model, dan opsi spend limit pada akun provider. Sediakan konfigurasi server `AI_ENABLED` untuk mematikan generation sambil mempertahankan pilihan zona dan konten dasar.

Jika memakai paid tier, pemilik menetapkan budget sebelum membuka generation publik. Spend limit Groq berlaku tingkat organisasi dan pelacakan dapat tertunda 10–15 menit, sehingga perlu margin budget dan pengawasan; jangan menjanjikan batas rupiah yang mutlak. Error `blocked_api_access` harus ditangani sebagai layanan AI dibatasi, bukan kesalahan parsing biasa. [Spend limits Groq](https://console.groq.com/docs/spend-limits).

Jika akun belum memiliki pengendalian biaya yang sesuai, pertahankan AI publik nonaktif dan sajikan konten dasar sampai pengaturan selesai. Tidak menambah Redis/database hanya untuk rilis awal; kebutuhan pembatasan global lintas banyak instance menjadi pemicu evaluasi gateway/penyimpanan bersama nanti.

## 9. UX, aksesibilitas, dan privasi

Tampilkan penjelasan sebelum kamera: frame diproses di perangkat oleh kode aplikasi, tidak direkam oleh aplikasi, dan nama area/topik dikirim ke server untuk informasi kesehatan. Sebutkan bahwa library/model dapat diunduh dari layanan aset eksternal dan Groq memproses teks. Jangan menyatakan seluruh aplikasi offline atau “tidak ada data apa pun keluar”.

Informasi kesehatan memiliki label edukasi dan batas penggunaan singkat di dekat hasil. Sumber konten dasar, tanggal review, status AI/fallback, dan jalur melaporkan konten bermasalah dapat diakses. Jika kontak pengelola belum ditentukan, catat sebagai tindakan pemilik sebelum rilis; jangan menciptakan alamat email.

Sediakan tombol Mulai, Stop, Reset Pilihan, pilihan manual, dan Coba Lagi saat relevan. Kontrol mempunyai label, focus yang terlihat, dan urutan keyboard yang benar. Status tracking/hasil tersedia melalui DOM dan `aria-live` yang tidak mengumumkan setiap frame. Warna bukan satu-satunya penanda; hormati reduced motion.

Desktop dapat memakai dua kolom; mobile menumpuk kamera, kontrol, dan hasil tanpa memotong tombol. Uji lebar 360, 390, 768, dan 1280 CSS pixel, zoom 200%, orientasi portrait/landscape, serta iframe resize. Tampilkan petunjuk berbeda ketika hanya wajah/torso terlihat; jangan selalu mewajibkan seluruh tubuh untuk memilih hidung.

Rahasia hanya di `.env` lokal atau Streamlit Secrets. Tambahkan `.env.example` dan `.streamlit/secrets.toml.example` dengan placeholder. Ignore `.env`, file secrets nyata, cache Python, virtualenv, dan artefak lokal sensitif sebelum commit pertama. Rotasi key hanya jika ada bukti pernah terekspos; keberadaan `.env` lokal saja bukan bukti kebocoran. [Pengelolaan secrets Streamlit](https://docs.streamlit.io/develop/concepts/connections/secrets-management).

Gunakan text node/escaping untuk error dinamis, bukan `innerHTML` dengan pesan exception. Markdown AI tidak boleh memuat link bebas, HTML, atau instruksi tambahan di luar field yang diizinkan. Jangan meneruskan stack trace, header autentikasi, key, atau respons mentah sensitif ke pengguna.

Log hanya jenis event, kategori error, durasi, cache hit/miss dan identitas request sementara yang tidak terkait identitas orang. Jangan menyimpan frame, landmark, IP, atau riwayat zona per orang untuk debugging rutin. Evaluasi pengaturan data Groq dan sesuaikan keterangan privasi dengan pengaturan akun; provider tetap dapat menyimpan metadata penggunaan, sehingga jangan menjanjikan zero retention menyeluruh tanpa verifikasi. [Data GroqCloud](https://console.groq.com/docs/your-data).

## 10. Struktur proyek yang dituju

Struktur berikut merupakan rancangan, bukan file yang sudah dibuat. Pemisahan dilakukan pada batas tanggung jawab yang perlu diuji; jumlah modul dapat disederhanakan bila pemisahan tidak memberi manfaat.

```text
app_streamlit.py                 # layout dan orchestration Streamlit
ai_engine.py                     # adapter Groq, schema, klasifikasi error
session_logic.py                 # event, deduplikasi, revision, state request
zone_catalog.py                  # identitas area dan topik resmi
health_service.py                # cache, throttle, fallback, koordinasi request
content/health_topics.json       # sumber dan konten edukasi yang direview
frontend/index.html             # host komponen
frontend/src/app.js              # lifecycle dan integrasi frontend
frontend/src/geometry.js         # transformasi, zona, matching
frontend/src/interaction.js      # dwell, gesture, latch, reset
frontend/src/styles.css
tests/                          # unit dan Streamlit AppTest
frontend/tests/                 # unit JS dan browser tests
.streamlit/config.toml           # tema/config yang benar-benar diperlukan
.streamlit/secrets.toml.example
.env.example
.gitignore
requirements.txt                # dependency runtime terkunci
requirements-dev.txt            # alat uji/lint, tidak menjadi runtime Cloud
package.json / package-lock.json # bila dipakai untuk test/build frontend
.github/workflows/ci.yml         # setelah repository GitHub dipersiapkan
README.md
docs/DEPLOYMENT.md
docs/TEST_REPORT.md
docs/PRIVACY.md
```

Pastikan path `declare_component` menunjuk host dan bundle yang benar. Pilih satu tata letak output; jangan meninggalkan dua `index.html` yang tidak jelas mana yang dipakai. Build Node berlangsung di pengembangan/CI, deployment Cloud membaca artefak statis yang sudah tersedia.

Pilih Python 3.12 sebagai kandidat baseline baru bila tersedia di akun Cloud dan seluruh dependency lulus; versi final ditetapkan setelah clean install. Pin paket langsung dan hasil resolusi transitive yang diuji agar rebuild dapat direproduksi. Jangan menyalin semua paket global laptop ke requirements. Periksa lisensi dependency dan model yang benar-benar didistribusikan.

## 11. Urutan implementasi dan dependensi

| Tahap | Pekerjaan dan output | Ketergantungan | Kriteria selesai |
| --- | --- | --- | --- |
| 0 — Baseline | Siapkan snapshot/repository setelah ignore secret; simpan bug reproducer dan acceptance. | Kode saat ini. | Fresh checkout baseline dapat dijalankan; rahasia tidak terlacak. |
| 1 — Kontrak | Katalog ID, schema event, state/reset, ekstraksi geometri dan tests. | Tahap 0. | Event invalid/replay ditolak; reset sinkron; baseline test tetap dapat dijalankan. |
| 2 — Deteksi | Transformasi, 23 target, validity, dwell waktu, gesture, latch. | Tahap 1. | Fixture dan uji kamera lokal dasar lulus. |
| 3 — Runtime kamera | MediaPipe Tasks, aset terkunci, jadwal inferensi, Start/Stop/recovery. | Tahap 2. | Startup dan teardown nyata, performa, regresi geometri lulus. |
| 4 — AI dan konten | JSON schema, error, cache, kuota, fallback bersumber. | Katalog tahap 1; konten mulai disiapkan sejak tahap 0. | Failure matrix dan review konten lulus. |
| 5 — UX publik | Manual selection, responsive, aksesibilitas, privasi, panduan. | Tahap 3 dan 4. | Alur kamera/manual lengkap pada desktop dan mobile lulus. |
| 6 — Packaging/CI | Lock dependency, README, CI, log, runbook, staging. | Tahap 1–5 stabil. | Clean build CI dan staging pada release candidate yang sama lulus. |
| 7 — Rilis | Uji perangkat nyata di Cloud, kuota nyata terkontrol, rollback, publikasi. | Semua gate P0/P1. | Bukti rilis, URL, versi, dan batas dukungan tercatat. |

Lakukan commit kecil yang tetap runnable; jangan mencampur perbaikan koordinat, migrasi model, dan redesign besar dalam satu perubahan. Urutan ini menjaga penyebab regresi dapat ditelusuri. Tidak ada estimasi waktu pasti sebelum spike migrasi MediaPipe dan benchmark perangkat selesai; review konten dan akses akun juga dapat menentukan durasi.

## 12. Strategi pengujian

Gunakan unit test Python untuk logika murni dan layanan yang dimock, Node test runner atau test framework ringan untuk geometri/state JS, Streamlit AppTest untuk panel/state Python, serta Playwright untuk browser. AppTest tidak membuktikan kamera iframe; mock model tidak membuktikan akurasi model nyata.

Test kamera otomatis memakai stream sintetis atau rekaman uji yang izinnya jelas. Jangan memasukkan rekaman pengguna biasa ke repository. Uji manusia lokal dapat dilakukan tanpa menyimpan video; catat hasil angka dan kondisi uji.

| Kelompok | Skenario wajib |
| --- | --- |
| Geometri | Mirror asimetris, kiri-kanan anatomis, torso miring, resolusi berbeda, satu sisi hilang, overlap, radius nol/NaN, out-of-frame. |
| Gesture | Telunjuk terulur/menekuk, kepalan, telapak terbuka, dua tangan, jitter, batas zona, tracking hilang. |
| Waktu | 10/20/30 FPS, pause panjang, tab tersembunyi, hasil model basi, hold tetap, re-entry sesudah Reset. |
| Event | Duplicate, out-of-order, revision lama, instance lama, remount, tipe invalid, topic invalid, payload terlalu besar. |
| State | Pilih A → B → A, cache hit, reset, retry sesudah gagal, request pending, dua sesi terisolasi. |
| AI | Sukses valid, None/kosong, JSON rusak, schema salah, topik salah, truncation, HTML/link, 401/403/404/429/5xx, timeout, budget cap. |
| Cache/kuota | Error tidak dicache sukses, TTL, invalidasi versi, banyak miss sama, lock dilepas saat exception, throttle, restart proses. |
| Kamera | Allow, deny, prompt diabaikan, tidak ada kamera, kamera sibuk, Stop saat startup, late permission, retry, ganti kamera, unmount. |
| Aset | CDN/model/WASM gagal atau lambat, worker gagal, konten manual tetap tersedia. |
| UI | Keyboard, pembaca layar dasar, reduced motion, zoom 200%, mobile portrait/landscape, status AI/fallback. |
| Cloud | Iframe kamera pada URL staging asli, akses publik incognito, secrets, restart, hibernasi, rollback. |

Target browser awal: Chrome dan Edge desktop serta Chrome Android pada versi stabil saat uji. Safari iPhone wajib diuji untuk menampilkan kamera sebagai fitur yang didukung di iPhone; tanpa perangkat nyata, tandai kamera iPhone belum terverifikasi dan pastikan alur manual bekerja. Catat versi browser/OS dan hardware; jangan menulis “semua browser” dari satu pengujian Chromium.

Coverage menjadi petunjuk celah, bukan bukti kualitas tunggal. Seluruh cabang kritis event/reset/geometri/error/cache wajib memiliki kasus uji bermakna. Jangan menambah test yang sekadar menyalin implementasi demi angka. Seluruh test yang relevan wajib lulus; skip/fail dicatat beserta dampaknya pada dukungan rilis.

Setiap hasil dalam `docs/TEST_REPORT.md` mencatat ID persyaratan, release commit, versi dependency/model, tanggal, perangkat/browser, kondisi input, langkah reproduksi, hasil yang diharapkan, hasil aktual, dan status `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN`. Sertakan ringkasan jumlah percobaan per zona serta request count untuk cache/deduplikasi. Bukti yang memakai mock diberi label jelas; kolom hasil tidak boleh diisi dari prediksi perilaku kode.

## 13. Target pengukuran awal

Angka berikut adalah **target yang diusulkan, belum hasil benchmark**. Kalibrasi setelah memperoleh baseline; perubahan target harus disertai alasan dan dicatat sebelum keputusan rilis, bukan diturunkan diam-diam setelah gagal.

| Aspek | Target awal | Metode dan batas |
| --- | --- | --- |
| Ketepatan target | Minimal 90% pemilihan benar pada percobaan sengaja untuk setiap target yang dipromosikan. | Sedikitnya 10 percobaan/target/perangkat referensi, minimal tiga penguji lintas keseluruhan sesi. Laporkan per-target, bukan hanya rata-rata. |
| Salah aktivasi | Maksimal satu aktivasi tidak disengaja dalam sesi non-pointing 5 menit. | Uji kepalan, gerakan biasa, pointer keluar, tangan tidak ada. |
| Dwell | 1.000 ms ±150 ms pada frame valid 10–30 FPS. | Clock palsu untuk unit test dan rekaman timestamp untuk uji nyata; pause tidak dihitung. |
| Pointer | Umur hasil pointer P95 ≤200 ms pada perangkat referensi. | Pisahkan FPS gambar dari FPS inferensi; ukur tangan dan zona. |
| Kontrol kamera | Stop menghentikan track dan respons UI dalam target ≤500 ms. | Setelah kamera aktif; uji juga late permission dan in-flight worker. |
| Loading model | Siap ≤15 detik sesudah izin pada koneksi referensi yang dicatat. | Pisahkan warm/cold asset cache dan waktu pengguna menjawab izin. Jika gagal, ada retry/manual. |
| AI | P95 hasil valid ≤8 detik pada uji request terkontrol; fault injection pulih sekitar ≤15 detik. | Jangan mengukur hanya cache hit; catat batas kuota dan waktu provider. |
| Cache | Hasil cached tampil ≤1 detik setelah selection diterima aplikasi yang sudah aktif. | Tidak memasukkan hibernasi platform. |
| Sesi panjang | Berjalan 20 menit dan 20 siklus Start/Stop tanpa stream/worker ganda. | Periksa pertumbuhan resource yang menetap, bukan fluktuasi GC sesaat. |
| Beban awal | 10 sesi aktif dengan AI dimock; uji 2 request AI nyata bersamaan secara terkendali. | Tidak melakukan load test besar pada layanan gratis; catat batas resource hasil pengukuran. |

Jika target tertentu sulit dideteksi secara konsisten, perbaiki sebelum mengiklankannya sebagai didukung. Pilihan manual tetap menyediakan akses topik; jangan menyembunyikan kegagalan pergelangan/lutut di balik akurasi rata-rata wajah yang tinggi. Target ini bukan studi klinis atau pembuktian diagnosis.

## 14. Gate rilis: kapan boleh disebut siap deploy

Kotak yang dicentang telah memiliki bukti otomatis lokal pada kandidat rilis. Item yang membutuhkan staging, perangkat nyata, keputusan pemilik, atau review domain tetap terbuka.

- [ ] G01–G05: geometri, gesture, waktu dan dukungan area lulus sesuai matriks yang dinyatakan.
- [x] S01–S03: event tervalidasi, reset dua arah, replay/duplikasi ditolak dan perilaku pending jelas.
- [ ] C01–C02/M01–M02: Start/Stop dua siklus dan model/iframe lokal lulus; iframe Cloud serta perangkat nyata belum diuji.
- [x] A01–A04: schema, error, retry, cache, limiter, concurrency cap dan sakelar AI terbukti bekerja.
- [ ] H01: seluruh konten dasar memiliki sumber/review; output AI dibatasi dan dilabeli; fallback teruji.
- [x] U01–U02: manual selection, layout mobile, keyboard native dan status yang dapat dibaca lulus pada Chromium.
- [x] P01: scan secret, validasi payload, escape output dan minimisasi log lulus.
- [x] D01/T01: clean install Python 3.12 dan test otomatis lulus; dependency/model/lisensi tercatat.
- [ ] D02/O01: staging, log, prosedur insiden, anggaran, dan rollback diverifikasi.
- [ ] Tidak ada temuan P0/P1 yang masih terbuka untuk kemampuan yang dipromosikan.
- [ ] README, catatan uji, batas browser/perangkat, kontak pengelola dan release notes sesuai perilaku nyata.
- [ ] Pemilik sudah memiliki repository/akses Cloud, menetapkan budget bila berbayar, dan meninjau hasil konkret sebelum publikasi.

Jika ada gate yang belum lulus, statusnya “belum siap rilis publik”, dengan penyebab spesifik. “Server berhasil start”, “seluruh unit test lulus”, dan “tampilan bagus” masing-masing belum cukup untuk menggantikan gate ini.

## 15. Runbook deployment dan rollback

### Persiapan

1. Siapkan `.gitignore` sebelum commit; periksa seluruh file terlacak dan history yang akan dipush. Jangan mem-push `.env` atau secrets nyata.
2. Inisialisasi/hubungkan GitHub repository yang dipilih pemilik. Jangan menciptakan nama akun, URL repository, branch milik pengguna, atau hak akses.
3. Tetapkan entrypoint `app_streamlit.py`, runtime Python final, dependency terkunci, dan artefak frontend yang dapat disajikan tanpa Node di Cloud.
4. Tambahkan CI untuk test Python/JS, AppTest, browser deterministik, build consistency, dan pemeriksaan secret/dependency. CI tidak memerlukan key produksi; Groq dimock.
5. Lindungi branch produksi agar Cloud tidak mengambil push yang belum lolos pemeriksaan. Gunakan staging terpisah dan promosi commit yang sama; jangan mengasumsikan Cloud menunggu CI sebelum auto-update.
6. Buat aplikasi staging di Community Cloud, masukkan secrets melalui pengelolaan secrets, lalu cek log startup. [Secrets Community Cloud](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management).

### Verifikasi staging

7. Buka URL HTTPS staging sebagai pengunjung biasa/incognito; uji kamera dari tombol Mulai dan konfirmasi iframe mendapatkan izin.
8. Uji seluruh alur manual, gesture, Reset, Stop, retry, konten fallback dan tampilan mobile pada perangkat nyata.
9. Verifikasi dengan network inspector bahwa kode aplikasi tidak mengirim frame/landmark ke server; key tidak terdapat dalam JS, DOM, pesan komponen, atau respons publik. Dokumentasikan request aset eksternal yang memang diharapkan.
10. Jalankan satu permintaan nyata per topik secara terkendali untuk validasi bentuk/kualitas, mengikuti kuota akun; permintaan berbayar mengikuti budget pemilik. Simpan laporan hasil tanpa secret. Uji timeout/429 melalui mock/proxy test terkontrol, bukan sengaja menghabiskan kuota.
11. Uji beberapa sesi terisolasi, cache lintas sesi, limiter, AI dimatikan, reboot aplikasi dan akses kembali. Catat status cold start dan hibernasi bila tersedia saat periode uji.

### Publikasi

12. Lengkapi laporan gate, review konten dan batas dukungan, kemudian bekukan release candidate.
13. Siapkan release/tag dan konfigurasi produksi. Jika ada perubahan setelah staging, jalankan kembali gate yang terdampak sebelum promosi.
14. Setelah pekerjaan implementasi dan bukti siap ditinjau, pemilik meninjau URL staging, materi kesehatan, quota Groq, serta hasil uji perangkat sebelum mempromosikan URL kepada pengguna umum.
15. Promosikan commit yang telah lulus, isi secrets produksi, uji smoke kembali di URL publik dan catat versi/commit yang benar-benar aktif.

### Gangguan dan rollback

16. Jika masalah hanya pada provider AI/biaya, nonaktifkan AI di konfigurasi server; pastikan reboot/rerun yang diperlukan dilakukan. Konten dasar dan pilihan zona harus tetap berfungsi.
17. Jika kamera/UI atau konten rilis baru rusak, kembalikan branch deploy ke isi rilis terakhir yang lulus melalui revert yang ditinjau, atau mekanisme branch deploy yang terdokumentasi. Jangan mengandalkan tombol rollback yang belum terbukti tersedia.
18. Pin dependency dan aset lama harus tetap dapat diakses agar revert benar-benar mereproduksi perilaku lama. Uji rollback di staging, lalu uji manual selection, kamera, reset, dan fallback pada versi yang dipulihkan.
19. Periksa log kategori error tanpa menyalin rahasia, perbaiki penyebab, uji ulang di staging, lalu rilis patch.

## 16. Observabilitas dan batas operasional

Catat log terstruktur untuk startup model/config, event ditolak, latency request, cache hit/miss, timeout, rate limit, schema invalid, dan AI disabled. Hindari logging setiap frame atau setiap pergerakan pointer. Error browser tampil sebagai status yang dapat dipahami; telemetry browser tambahan hanya ditambahkan bila diperlukan, dengan payload minimal dan keterangan privasi.

Operator menggunakan Cloud logs dan dashboard penggunaan Groq untuk meninjau kestabilan dan kuota. Catat siapa yang menangani laporan, kapan AI harus dimatikan, dan cara rollback. Rencana ini tidak membuat automation monitoring atau notifikasi; jadwal operasional dapat ditetapkan ketika rilis dilaksanakan.

Pemicu evaluasi hosting/arsitektur berikutnya: kebutuhan selalu aktif, penggunaan melewati kapasitas uji, limiter harus tahan restart/lintas instance, biaya tidak bisa dikendalikan dengan pengaturan provider, atau antrean AI terus mengganggu UX. Perubahan tersebut memerlukan rencana kapasitas baru; Community Cloud tidak dinyatakan gagal hanya karena mempunyai batas yang harus dikelola.

## 17. Hal yang masih perlu dibuktikan atau ditentukan

| Item | Status saat rencana dibuat | Kapan harus selesai |
| --- | --- | --- |
| Platform dan audiens | Sudah dipilih: Community Cloud, pengguna umum. | Selesai. |
| Repository GitHub dan branch | Tersedia: `unVeroz007/gesturedoc-cloud`, branch `codex/production-readiness`. | Selesai. |
| Versi Python/dependency/model final | Python 3.12 clean install lulus; uji Cloud menunggu staging. | Tahap staging. |
| Budget, tier dan quota Groq aktual | Belum dibaca dari akun; tidak ditebak dari tabel umum. | Sebelum live AI publik. |
| Reviewer dan sumber 20 topik | Belum ditetapkan. | Sebelum gate H01. |
| Browser/perangkat referensi | Perlu dicatat dari perangkat yang benar-benar tersedia. | Sebelum benchmark. |
| Akurasi kamera nyata dan performa Tasks | Startup, inferensi sintetis, dan dua siklus teardown lulus Chromium; manusia/perangkat nyata belum diuji. | Tahap staging. |
| Kontak pengelola dan kebijakan privasi final | Belum ditetapkan. | Sebelum publikasi. |
| Kesiapan deploy publik | Kandidat teknis siap staging; promosi publik menunggu gate pemilik dan perangkat di atas. | Setelah staging dan review. |

Implementasi teknis, fallback, test suite, CI, dokumentasi deployment, dan perlindungan secret telah tersedia. Langkah berikutnya adalah staging dari commit kandidat yang sama dan penyelesaian gate pemilik yang dicatat di atas.
