# CourtHost — pasang login host

Tahap ini menambahkan login email/password, pemeriksaan profil host, pemulihan
sesi saat refresh, dan logout. Halaman welcome berubah menjadi halaman login.
Sesudah masuk, kamu melihat nama, email, dan peran host. Pengelolaan pemain dan
sesi belum dibuat pada tahap ini. Gaya hijau starter tetap dipakai; ini belum
implementasi final layar Figma.

## 1. Pasang pembaruan

1. Hentikan `pnpm dev` dengan Ctrl+C.
2. Cadangkan proyekmu ke folder lain, tanpa perlu menyalin `node_modules`.
3. Ekstrak `CourtHost_Login_Update.zip` di luar proyek.
4. Buka folder `courthost-login-update`, lalu salin **isinya** ke root CourtHost
   (sejajar `package.json`, `AGENTS.md`, dan `supabase`). Merge folder `src` dan
   pilih Replace untuk file yang tercantum dalam `UPDATE_FILES.txt`.
5. Pertahankan `.env.local` yang sudah kamu isi. Paket ini tidak memuat file itu,
   password, folder Supabase, ataupun SQL yang perlu dijalankan.

Jika kamu sudah mengubah kode starter sendiri, bandingkan file dalam
`UPDATE_FILES.txt` dengan perubahanmu sebelum memilih Replace.

## 2. Periksa konfigurasi

`.env.local` harus berada di root CourtHost, bukan di dalam `src`:

```dotenv
# Ganti placeholder dengan alamat proyek Supabase CourtHost.
VITE_SUPABASE_URL=https://PROJECT_REF_KAMU.supabase.co
# Gunakan publishable key berawalan sb_publishable_. Bukan secret/service_role.
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GANTI_DENGAN_KEY_KAMU
```

Kode tahap ini menggunakan publishable key baru, bukan legacy anon JWT.
Variabel berawalan VITE_ memang masuk ke browser; file ini bukan tempat password.
Pastikan `.gitignore` memuat `.env.local` atau `.env.*`.

## 3. Jalankan dari Git Bash di root CourtHost

```bash
# Pasang library baru sesuai versi yang dikunci.
pnpm install --frozen-lockfile

# Nyalakan frontend dengan konfigurasi .env.local.
pnpm dev
```

Gunakan pnpm 10.8.0 seperti paket sebelumnya. Bila pnpm global berbeda, gunakan
`npx --yes pnpm@10.8.0 install --frozen-lockfile` dan
`npx --yes pnpm@10.8.0 dev`.

Buka URL Local yang dicetak Vite. Masuk memakai email dan password **akun Auth
host** yang sudah kamu buat di Supabase, bukan password database atau password
akun dashboard Supabase.

## 4. Yang perlu kamu uji di laptop

- Password salah: pesan error muncul dan bisa mencoba lagi.
- Akun host benar: nama dan peran muncul.
- Refresh: akun tetap masuk, lalu profil dibaca lagi.
- Tombol EN/ID: bahasa berubah.
- Keluar: kembali ke form login.
- Layar sempit: form dan tombol tetap terbaca.

Jangan kirim password atau token ke chat. Jika gagal, kirim pesan error tampilan
atau terminal, dengan nilai konfigurasi disamarkan.

## 5. Arti file kode

| File | Fungsinya |
|---|---|
| `src/lib/supabase/config.ts` | Memeriksa format URL dan publishable key. |
| `src/lib/supabase/client.ts` | Membuat satu koneksi client Supabase dengan tipe database yang sudah ada. |
| `src/features/auth/auth-api.ts` | Tempat panggilan login, logout, dan pembacaan profil. |
| `src/features/auth/use-auth-session.ts` | Mendengarkan perubahan login dan memulihkan sesi. |
| `src/features/auth/LoginForm.tsx` | Form email/password dan pesan error. |
| `src/features/auth/HostAccess.tsx` | Memilih tampilan login, loading, akses ditolak, atau halaman host. |
| `src/app/App.tsx` | Kerangka halaman dan pengaturan cache permintaan data. |
| `src/lib/i18n/en.json` / `id.json` | Semua teks antarmuka. |
| `src/features/auth/HostAccess.test.tsx` | Tes alur memakai respons Auth tiruan. Tidak memakai password asli. |

Library tambahan: Supabase JS untuk koneksi browser, TanStack Query untuk status
permintaan profil, React Hook Form untuk form, dan Zod untuk validasi input.
Vitest/Testing Library menjalankan tes; tidak ikut bundle produksi.

Pemeriksaan profil di UI hanya mengatur tampilan. RLS dan pemeriksaan dalam RPC
backend tetap menjadi pengaman data. Tidak ada pembuatan profil otomatis atau
registrasi publik. Logout berlaku untuk browser ini.

## 6. Jika ada masalah

| Pesan/gejala | Tindakan |
|---|---|
| Hubungkan proyekmu | Periksa nama variabel, format HTTPS URL, publishable key, dan restart pnpm dev. |
| Email atau kata sandi salah | Gunakan kredensial Auth host yang benar; bukan kredensial dashboard/database. |
| Konfirmasi email | Selesaikan konfirmasi email akun Auth tersebut. |
| Akses host diperlukan | Pastikan UUID profil yang dulu kamu provision cocok dengan UUID akun yang dipakai. Jangan membuat profil kedua. |
| Profil belum dapat dibaca | Periksa koneksi, status proyek, URL/key berasal dari proyek yang sama; coba lagi. Jangan membuka akses publik tabel. |
| Kamu membuat akun tanpa password | Password login perlu password akun Auth. Kita perlu mengatur password dengan alur pemulihan atau kembali ke Magic Link; jangan mengganti SQL. |

Pemulihan password melalui email belum dibuat di UI tahap ini. Penyesuaian Auth
provider, email confirmation, dan password akun nyata harus diperiksa di proyekmu.

## 7. Catatan keputusan auth

Spesifikasi lama dan backend README menyebut OTP/Magic Link. Mengikuti langkah
email/password dalam percakapan terbaru, slice ini memakai email/password.
Catatan ini menggantikan pilihan metode login itu untuk slice ini saja; aturan
host tunggal, tanpa akun pemain, dan keamanan backend tetap sama.

## 8. Pemeriksaan kode

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm build` menghasilkan `dist`; tidak memublikasikan website.
Hasil pengujian dan batasannya ada di `VERIFICATION.md`.

Referensi API:
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://supabase.com/docs/reference/javascript/auth-signout
