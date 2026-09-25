# History, tautan pemain, dan pembaruan langsung

## Menjalankan

Gunakan Node sesuai `package.json`, lalu `corepack pnpm install --frozen-lockfile` dan `corepack pnpm dev`.
Gunakan `.env.local` yang sudah ada: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`. Jangan commit file tersebut.
Tidak ada dependency atau migration baru. Fitur menggunakan backend yang sudah ada: `get_public_session`, `courthost_command` (`rotate_share` / `revoke_share`), dan trigger broadcast `session_changed`.

## Alur host

1. Buka Match dan pilih sesi. Generate jadwal terlebih dahulu bila masih draft.
2. Di bagian **Tautan pemain**, salin tautan atau buka tampilan pemain.
3. Bagikan tautan kepada peserta. Siapa pun yang memiliki tautan dapat membaca nama peserta, jadwal, skor, dan peringkat sesi tersebut.
4. **Cabut tautan** menghentikan akses. **Buat tautan baru** menonaktifkan tautan lama dan menghasilkan tautan pengganti. Keduanya meminta konfirmasi.
5. Klasemen host tersedia di bagian yang sama. Input skor yang belum disimpan tetap dipertahankan saat data diperbarui.

## Halaman pemain

Alamat `/s/<token>` dapat dibuka tanpa login. Pilih nama untuk menandai pertandingan sendiri dan mendapatkan pemberitahuan dalam halaman ketika pertandingan berikutnya melibatkan pemain tersebut. Pemilihan nama tidak mengubah izin akses; MVP memakai satu tautan per sesi.
Pembaruan memakai Broadcast untuk memicu pembacaan ulang melalui RPC token. Payload broadcast tidak pernah digunakan sebagai skor. Fallback memperbarui data setiap 15 detik selama halaman terlihat dan browser online. Status koneksi ditampilkan.
Jika pembacaan gagal atau akses dicabut, hasil lama disembunyikan. Halaman mencoba lagi secara berkala; tidak ada penyimpanan hasil sesi di localStorage.

## History

Pencarian nama, status, dan tanggal diproses sebelum pagination di backend. Batas tanggal mengikuti zona waktu browser; tanggal akhir termasuk seluruh hari tersebut. Ada 30 hasil per halaman.
Jumlah pertandingan dihitung dari penampilan pemain: singles dibagi 2, doubles dibagi 4. Total poin adalah jumlah poin individual leaderboard (doubles memberi poin penuh ke setiap anggota tim).
Satu pembacaan leaderboard dipakai bersama untuk ringkasan dan tabel. Klik judul kartu untuk membuka atau menutup tabel.

## Hosting

Hosting harus mengarahkan permintaan `/s/*` ke `index.html` (SPA fallback), tanpa mengubah URL. Vite dev/preview mendukungnya. Konfigurasi rewrite produksi bergantung pada hosting yang digunakan. Tetap pertahankan meta `referrer=no-referrer`.

## Verifikasi live setelah mengambil branch

1. Buka app sebagai host dan tautan pemain di jendela incognito.
2. Mulai pertandingan, simpan skor, dan selesaikan pertandingan. Pastikan kedua tampilan memperbarui skor dan klasemen.
3. Uji satu pertandingan doubles: History harus menunjukkan satu pertandingan, bukan dua.
4. Cabut/rotate tautan ketika halaman pemain masih terbuka. Data lama harus hilang setelah sinyal/refetch; tautan lama tidak bisa memuat ulang sesi.
5. Putuskan dan sambungkan kembali internet. Status koneksi dan data harus pulih; input skor host yang belum disimpan tidak boleh hilang.
6. Uji lebih dari 30 sesi, lalu cari nama sesi lama dan gunakan filter tanggal/status.

Tes otomatis frontend memakai mock API; tes tersebut tidak membuktikan migration sudah diterapkan di hosted Supabase. Pastikan backend yang didokumentasikan di `supabase/README.md` sudah diterapkan. Tidak perlu melonggarkan RLS tabel untuk mengaktifkan pembaruan publik.

## Hasil pemeriksaan otomatis

TypeScript, ESLint, build produksi, dan tes Vitest/smoke dijalankan saat perubahan ini dibuat. Build berhasil dengan peringatan ukuran bundle dan anotasi komentar dependency Zod; dependency dan lockfile tidak diubah.
