# Update Players — CourtHost

Update ini dipasang setelah CourtHost_Login_Update yang sudah berhasil kamu jalankan.

## Pasang di Windows / Git Bash

1. Hentikan `pnpm dev` dengan Ctrl+C. Buat salinan folder frontend sebagai cadangan.
2. Buka ZIP, lalu masuk ke folder `courthost-players-update`.
3. Salin **isi folder tersebut** ke `C:/Users/Thomas/Desktop/project/CourtHost/courthost-frontend-starter/`. Gabungkan folder `src` dan `public`; timpa file dengan nama yang sama. Jangan menghapus folder lama atau membuat folder update bersarang di dalam frontend.
4. `.env.local` milikmu tetap dipakai; ZIP tidak berisi konfigurasi rahasia. Tidak perlu SQL atau migrasi baru.
5. Di terminal frontend, jalankan:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Gunakan pnpm 10.8.0 seperti setup sebelumnya. Tidak ada perubahan dependensi pada update ini.

## Coba alur berikut

- Login host → halaman Players. Ubah bahasa EN/ID.
- Tambah satu pemain uji, isi nama dan kemampuan 1–10. Nama kosong dan kemampuan pecahan/di luar batas harus ditolak.
- Muat ulang browser: pemain harus tetap ada. Cari nama, lalu edit nama/kemampuannya.
- Arsipkan pemain. Di filter Aktif pemain hilang; di filter Diarsipkan pemain muncul.
- Pulihkan pemain, lalu pastikan tampil lagi di Aktif.
- Untuk pemain uji yang belum pernah masuk sesi: arsipkan → Edit → Hapus permanen → konfirmasi.
- Pemain yang pernah masuk sesi harus ditolak saat dihapus permanen. Tidak perlu membuat sesi atau menghapus data sungguhan hanya untuk mencoba ini.
- Putuskan koneksi sementara: kegagalan muat/simpan harus jelas. Jika simpan gagal dikonfirmasi, muat ulang daftar sebelum mengulang supaya tidak menambah duplikat.
- Logout → halaman login. Cek tampilan dengan lebar sekitar 375 px dan desktop, serta tombol Tab/Escape di dialog.

Arsip hanya mengubah daftar pemain aktif; tidak menarik pemain dari sesi berjalan. Edit nama/kemampuan tidak mengubah snapshot sesi yang sudah ada. Tombol Match dan History masih nonaktif, ditandai Segera hadir.

## Cakupan desain

Mengikuti roster Figma `4190:5708`, edit sheet `4247:2000`, dan ilustrasi kosong `4190:5468` pada file Belajar (Copy). Logo, ikon, dan ilustrasi diekspor langsung dari Figma. Font Plus Jakarta Sans disimpan lokal dengan lisensi OFL.

Penyesuaian fungsional: filter arsip, pagination 25 pemain, status koneksi, logout, pilihan bahasa, tombol sentuh lebih besar, warna teks lebih gelap agar terbaca. Arsip menjadi tindakan utama pengganti Delete; hapus permanen ada pada editor pemain arsip dan tetap diperiksa database. Form tambah memasukkan satu pemain per penyimpanan. Navigasi menggunakan font Jakarta agar tidak menambah font lain hanya untuk caption.

## Pemeriksaan pengembangan

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Lihat VERIFICATION.md untuk hasil dan batas pemeriksaan. Kirim screenshot halaman Players setelah update terpasang agar kesesuaian visual di browser Windows bisa diperiksa.
