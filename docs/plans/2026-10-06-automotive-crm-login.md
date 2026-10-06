# AutoPulse CRM - Login Page with Live Statistics Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Membangun antarmuka web Laman Login Split-Screen modern berestetika otomotif premium dengan integrasi showcase statistik kehadiran dan performa SDM dealer, didukung fitur **Bilingual (Indonesia & Inggris)** serta **Peralihan Tema Ganda (Dark & Light Mode)**.

**Architecture:** Arsitektur frontend modular berbasis Semantic HTML5, Vanilla CSS3 modern dengan Dual Theme System (Obsidian Dark & Alabaster Light) menggunakan CSS Custom Properties, serta Vanilla JavaScript (ES6) untuk simulasi live data feed pre-auth `/api/v1/public/dealer-pulse`, counter animation, language switcher, dan theme persistence (`localStorage`).

**Tech Stack:** HTML5 Semantic, Vanilla CSS3 (Custom Variables, Flexbox, CSS Grid, Backdrop Filters), Vanilla JavaScript ES6, Google Fonts (Outfit & Inter), Node.js (untuk lightweight validation runner).

---

### Task 1: Dual Theme Tokens & Base Stylesheet (`styles.css`)

**Files:**
- Create: `styles.css`

**Step 1: Definisikan CSS Variables untuk Dark Mode & Light Mode**
Definisikan palet warna `:root` (Dark Mode default: `#0A0E17`, `#111827`, `#1E293B`, teks `#F8FAFC`, aksen `#06B6D4`) dan `[data-theme="light"]` (Light Mode: `#F8FAFC`, `#FFFFFF`, `#F1F5F9`, teks `#0F172A`, aksen `#0891B2`). Tambahkan efek transisi halus pada pergantian tema.

**Step 2: Buat Utility Kelas & Tata Letak Split-Screen Responsif**
Buat class `.split-container` dengan rasio 50:50 pada layar desktop, collapsible pada tablet/ponsel, styling kartu metrik `.metric-card` (glassmorphism adaptif untuk dark dan light), tombol switch tema `.theme-toggle`, dan tombol switch bahasa `.lang-toggle`.

**Step 3: Verifikasi sintaksis stylesheet**
Pastikan tidak ada syntax error pada CSS dan seluruh token variabel siap digunakan oleh HTML.

---

### Task 2: Struktur Semantic HTML & Layout Laman Login (`index.html`)

**Files:**
- Create: `index.html`

**Step 1: Susun Top Bar Kontrol Global (Tema & Bahasa)**
- Top Bar: Language Switcher button (`#lang-toggle` dengan label ID / EN) dan Theme Switcher button (`#theme-toggle` dengan ikon ☀️/🌙).

**Step 2: Susun Semantic Markup Laman Login Split-Screen**
- Sisi Kiri (`#auth-section`): Logo AutoPulse, Dynamic Greeting (`#greeting-text`), input NIP/Email (`#nip-email`), input Kata Sandi (`#password`), toggle lihat sandi (`#toggle-pwd`), dropdown cabang dealer (`#branch-select`), tombol Masuk (`#btn-login`), tombol SSO Korporat (`#btn-sso`), dan kontak bantuan HRD (`#hr-support-link`).
- Sisi Kanan (`#pulse-section`): Status waktu operasional dealer, Kartu Kehadiran SDM (`#stat-attendance`), Kartu Leaderboard Sales (`#stat-leaderboard`), Kartu Aktivitas Prospek & Test Drive (`#stat-activity`), dan Banner Pengumuman HRD (`#hr-announcement`).

**Step 3: Hubungkan CDN Google Fonts & Stylesheet**
Muat font *Outfit* dan *Inter*, serta tautkan file [styles.css](file:///c:/Users/ASUS/Documents/Antigravity/coba2/styles.css) dan [app.js](file:///c:/Users/ASUS/Documents/Antigravity/coba2/app.js).

---

### Task 3: Logika Interaktif, Bilingual i18n & Theme Switcher (`app.js`)

**Files:**
- Create: `app.js`

**Step 1: Implementasi Modul Theme Switcher & Storage Persistence**
Deteksi preferensi tema dari `localStorage` atau `window.matchMedia('(prefers-color-scheme: light)')`. Simpan perubahan saat tombol `#theme-toggle` ditekan dan terapkan atribut `data-theme` pada elemen `<html>`.

**Step 2: Implementasi Modul Bilingual i18n (Indonesia & Inggris)**
Sediakan kamus terjemahan bilingual (ID & EN) untuk semua teks antarmuka (greeting, label formulir, placeholder, judul statistik, nama badge, tombol bantuan HRD). Fungsi `setLanguage(lang)` memperbarui seluruh teks pada DOM dan menyimpan pilihan di `localStorage`.

**Step 3: Implementasi Dynamic Time Greeting & Password Toggle**
Logika deteksi jam lokal pengguna disesuaikan dengan bahasa aktif (contoh: "Selamat Pagi" vs "Good Morning") dan fungsi toggle visibilitas kata sandi.

**Step 4: Implementasi Pre-Auth Live Statistics Feed & Counter Animation**
Simulasi service feed statistik pre-auth yang aman (*Zero PII*), render otomatis ke dalam kartu metrik, serta animasi *number counter* halus (0% -> 94.8%).

**Step 5: Validasi Form Autentikasi & Modal Bantuan HRD**
Validasi input NIP/Email dan Password, pesan galat ramah pengguna dalam bahasa yang aktif, feedback loading, serta interaksi cepat modal bantuan HRD.

---

### Task 4: Verifikasi & Uji Responsivitas Antarmuka

**Files:**
- Test/Verification: browser preview / DOM check

**Step 1: Jalankan pengujian switch tema (Dark <-> Light)**
Pastikan warna latar, teks, border, dan glassmorphism berubah mulus tanpa kontras rusak.

**Step 2: Jalankan pengujian switch bahasa (ID <-> EN)**
Pastikan seluruh teks di halaman login dan kartu statistik beralih bahasa dengan tepat.

**Step 3: Verifikasi kelengkapan elemen ID & tampilan mobile**
Pastikan formulir tetap mudah digunakan pada resolusi mobile/tablet untuk wiraniaga dan staf lapangan.
