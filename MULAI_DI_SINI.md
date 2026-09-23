> **Pembaruan login:** panduan ini menjelaskan starter pertama. Setelah memasang login, ikuti `LOGIN_SETUP_ID.md`; frontend kini memakai Supabase dan memerlukan `.env.local`.

# CourtHost — langkah frontend pertama

Backend sudah disiapkan sebelumnya dan kamu sudah membuat akun host. Paket ini
menambahkan halaman awal React ke folder VS Code kamu. Halaman ini belum login,
belum mengambil data Supabase, dan belum merupakan layar final Figma.

## 1. Salin file

1. Ekstrak ZIP di luar folder proyek.
2. Buka folder hasil ekstrak `courthost-frontend-starter`.
3. Cadangkan `package.json` dan `pnpm-lock.yaml` lama ke luar proyek.
4. Salin **isi** folder starter ke root CourtHost, sejajar dengan `AGENTS.md`.
   Ganti `package.json` dan `pnpm-lock.yaml` lama. Pertahankan dokumen dan folder
   `supabase` yang sudah ada. Jangan mengganti seluruh folder proyek.
5. Tambahkan isi `GITIGNORE_FRONTEND.txt` ke `.gitignore` yang sudah ada.

Sekarang root proyek memiliki `src/` dan `supabase/`. File tipe database sudah
tersedia di `src/lib/supabase/database.types.ts`; tidak perlu dijalankan.

## 2. Jalankan dari terminal Git Bash di VS Code

```bash
# Cek versi. Paket ini memerlukan Node >=22.13.0 dan menggunakan pnpm 10.8.0.
node --version
pnpm --version

# Unduh dependency sesuai lockfile yang disertakan.
pnpm install --frozen-lockfile

# Nyalakan website lokal. Biarkan terminal ini tetap berjalan.
pnpm dev
```

Buka URL Local yang dicetak Vite, biasanya http://127.0.0.1:5173.
Untuk berhenti, tekan Ctrl+C. Tidak perlu Docker, API key, atau menjalankan SQL.
Perintah ini tidak memublikasikan website.

Kalau versi pnpm berbeda, kamu bisa memakai versi paket tanpa mengganti versi global:

```bash
npx --yes pnpm@10.8.0 install --frozen-lockfile
npx --yes pnpm@10.8.0 dev
```

## 3. Apa yang seharusnya terlihat?

Halaman CourtHost dengan tombol EN / ID. Coba ubah bahasa, lalu refresh:
pilihan bahasa tetap tersimpan jika browser mengizinkan penyimpanan lokal.
Halaman menyebutkan tahap pengembangan; itu bukan bukti koneksi ke database.

## 4. Mulai baca kode dari mana?

| File | Fungsinya |
|---|---|
| `src/app/App.tsx` | Susunan halaman; komentar menjelaskan bagian sementara dan pekerjaan berikutnya. |
| `src/styles.css` | Warna, jarak, ukuran, dan tampilan ponsel. |
| `src/lib/i18n/en.json` / `id.json` | Teks bahasa Inggris dan Indonesia. Ubah teks di sini. |
| `src/main.tsx` | Menyalakan React. |
| `src/lib/supabase/database.types.ts` | Kamus tipe database untuk TypeScript; jangan diedit manual. |
| `package.json` | Daftar dependency dan perintah proyek. |
| `pnpm-lock.yaml` | Versi dependency yang dikunci supaya instalasi konsisten. |

Coba ubah `title` di `en.json`, lalu simpan. Browser yang sedang menjalankan
`pnpm dev` akan menampilkan perubahan otomatis.

## 5. Sesudah ini

Setelah halaman ini berjalan di laptopmu: sambungkan Supabase dan buat login
host, lalu implementasikan manajemen pemain serta layar sesi sesuai Figma.
Target aplikasi awal tetap sama. Panduan lengkap ada di `START_HERE_FRONTEND.md`.

Kalau instalasi gagal, kirim teks error terminal. Jangan mereset database atau
menjalankan ulang migrasi untuk memperbaiki masalah frontend.
