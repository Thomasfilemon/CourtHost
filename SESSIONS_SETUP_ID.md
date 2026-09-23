# Update Match / Sesi CourtHost

Update ini dipasang setelah CourtHost_Players_Update. **Isi folder Players tidak ada di paket ini**, jadi perubahan tampilan Players yang kamu buat di laptop tetap dipakai.

1. Hentikan `pnpm dev` dengan Ctrl+C; cadangkan project lokal sebelum menyalin update.
2. Buka ZIP dan salin **isi** folder `courthost-sessions-update` ke `C:/Users/Thomas/Desktop/project/CourtHost/courthost-frontend-starter/`. Gabungkan folder `src`, timpa file yang namanya sama. Jangan menghapus folder yang sudah ada.
3. `.env.local` dan `pnpm-lock.yaml` milikmu tetap dipakai. Tidak ada migrasi database dan tidak ada dependensi baru.
4. Dari terminal frontend jalankan `pnpm dev`, lalu login host dan buka tab **Match** di bagian bawah.

Perubahan di luar direktori `src/features/sessions/`: navigasi host aktif dari Players ke Match di `src/app/SessionHostShell.tsx`, satu penggantian import di `src/features/auth/HostAccess.tsx`, file terjemahan Match terpisah di `src/features/sessions/locales/`, dan `db.retry: false` pada client Supabase supaya RPC mutasi tidak diam-diam terkirim ulang saat koneksi bermasalah. `PlayersPage`, form, stylesheet, API, tes, serta file terjemahan bersama EN/ID untuk Players tidak dibundel ulang.

## Coba di browser

- Tambah minimal dua pemain aktif di tab Players (atau empat untuk format ganda).
- Di tab Match pilih **Buat sesi**; isi nama, tanggal/jam, durasi, perkiraan menit per pertandingan, format, algoritma, dan centang pemain. Lalu **Simpan sesi**.
- Sesi muncul sebagai **Draf**. Buka kartunya lalu pilih **Buat jadwal**. Jika perkiraan durasi terlampaui, centang opsi lewat durasi dan coba lagi. Pilihan itu dibuat host secara sadar; penjadwalan tidak mengakhiri sesi otomatis.
- Buka pertandingan pertama, **Mulai pertandingan**. Simpan skor sementara; selesaikan dengan jumlah skor tepat empat (misal 3–1 atau 2–2). Pertandingan berikutnya dapat dimulai setelah yang sedang berjalan selesai. Tambah putaran jika masih ada waktu.
- Setelah tidak ada pertandingan yang sedang dimainkan, **Akhiri sesi** melalui dialog konfirmasi. Sesi selesai tetap ada di daftar sebagai arsip baca saja hingga halaman History dibangun.
- Untuk draf uji coba: buka lalu **Batalkan sesi** dengan konfirmasi. Sesi yang selesai/batal bisa disembunyikan dari daftar memakai **Hapus dari daftar**; ini memakai soft delete dan membuat tautan berbagi sesi tidak berlaku. Jangan mencoba tindakan ini pada data penting hanya demi tes.
- Refresh browser dan cek data tetap ada; beralih EN/ID, ponsel/desktop, dan logout/login lagi.

Jika koneksi gagal saat simpan/buat jadwal, **muat ulang sesi sebelum mengulangi tindakan** untuk menghindari duplikasi. Sesi dengan waktu lama mungkin berada di halaman daftar berikutnya (30 per halaman). Membuat draf tidak langsung membuat jadwal; dua langkah ini mengikuti kontrak backend yang sudah diterapkan.

## Ruang lingkup

UI mengikuti frame Match Figma `4216:5889`, form `4247:2884`, dan pemilihan pemain `4247:3850`. Format lapangan hanya tunggal/ganda, satu pertandingan berjalan per sesi, hasil akhir empat poin. Penyesuaian tampilan: daftar sesi, tanggal/jam eksplisit, kolom perkiraan pertandingan, pencarian pemain, status/error yang terbaca, serta tombol dan dialog konfirmasi yang lebih mudah dipakai. Menggunakan ikon dan logo yang sudah ada dari update sebelumnya; tidak ada asset visual baru dalam ZIP ini.

Halaman History, klasemen, tautan publik dan pembetulan skor pertandingan selesai akan dilanjutkan di tahap berikutnya. Database sudah menyediakan sebagian kontraknya, tetapi tab History masih nonaktif.

Pemeriksaan pengembangan: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
