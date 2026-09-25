# Koreksi hasil dan penarikan pemain

Fitur ini melanjutkan branch `fix/history-public-live` (PR #1). PR lanjutan menargetkan branch tersebut supaya hanya perubahan fitur ini yang tampil. Gabungkan PR #1 terlebih dahulu, lalu arahkan PR lanjutan ke `main` sebelum merge bila GitHub belum memindahkan base-nya.

## Cara memakai

1. Buka Match, pilih sesi yang sedang aktif, lalu buka **Penyesuaian sesi** di bawah daftar pertandingan.
2. **Koreksi hasil:** pilih pertandingan selesai, tekan Koreksi hasil, masukkan skor pengganti, dan konfirmasi. Total harus tepat empat, termasuk hasil seri 2–2. Dialog menjelaskan skor lama dan dampaknya pada klasemen.
3. **Tarik pemain:** pilih pemain yang tidak sedang bertanding, baca jumlah jadwal yang akan dibatalkan, lalu konfirmasi. Hasil selesai dan roster permanen tetap tersimpan. Pemain tersebut tidak dipilih pada batch berikutnya.
4. Jika pemain masih berada dalam match berjalan, selesaikan match atau gunakan **Batalkan pertandingan berjalan** terlebih dahulu. Pembatalan membutuhkan konfirmasi, tidak menghasilkan poin, dan tidak memulai pertandingan berikutnya.
5. Setelah withdrawal, gunakan **Tambah putaran berikutnya** bila ingin melanjutkan dengan pemain tersisa. Tidak ada regenerasi otomatis. Backend tetap memerlukan minimal 2 pemain untuk singles atau 4 untuk doubles.

Koreksi dan withdrawal hanya tersedia saat sesi aktif. Setelah sesi selesai/dibatalkan, data pertandingan tetap hanya baca. Backend memeriksa status dan hak akses lagi saat perintah dikirim, termasuk bila sesi berubah ketika dialog masih terbuka.

## Verifikasi di hosted project

Tidak ada migration atau dependency baru. Implementasi memakai action `correct_result`, `withdraw_player`, dan `cancel_match` pada RPC `courthost_command` yang sudah ada.

- Selesaikan match 3–1 dalam sesi aktif, ubah ke 2–2, dan cek skor serta klasemen host/pemain ikut berubah.
- Coba skor total lima: form harus menolak dan tidak mengirim perintah.
- Buka dialog withdrawal lalu batalkan: tidak ada data yang berubah.
- Tarik pemain yang punya match selesai dan jadwal mendatang: hasil lama harus tetap ada, hanya jadwal mendatang yang melibatkannya menjadi cancelled.
- Untuk pemain yang sedang bertanding, batalkan match dengan konfirmasi, lalu tarik pemain dan tambahkan batch. Pemain yang ditarik tidak boleh terpilih lagi.
- Akhiri sesi: panel penyesuaian tidak tersedia lagi. Buka History dan tautan pemain untuk memastikan hasil akhir konsisten.
- Uji koneksi gagal saat menyimpan: dialog tetap terbuka dengan skor yang diketik dan pesan kesalahan.

Tes frontend memakai mock API; pemeriksaan SQL yang sudah ada di `docs/courthost-backend/tests/core.sql` mencakup koreksi, hasil seri, withdrawal, preservasi hasil, dan penolakan koreksi setelah sesi berakhir. Tes SQL tersebut harus dijalankan hanya pada lingkungan uji sesuai petunjuk backend; tidak dijalankan terhadap hosted project dalam perubahan frontend ini.
