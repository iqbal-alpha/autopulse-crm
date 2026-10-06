# Product Requirements Document (PRD) / Dokumen Kebutuhan Produk
# AutoPulse CRM — Automotive Customer & Workforce Management System

**Document Version / Versi Dokumen:** 1.1  
**Date / Tanggal:** 2026-10-06  
**Status:** Approved (Ready for Implementation / Siap Implementasi)  
**Primary Target Users / Pengguna Utama:** HRD & People Operations, Branch Managers, Sales Consultants, Service Advisors & Technicians  
**Core Features / Fitur Utama:** Bilingual Support (ID/EN), Dual Theme Engine (Dark & Light Mode), Split-Screen Login with Pre-Auth Dealer & HRD Statistics

---

# [ID] BAGIAN BAHASA INDONESIA

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Latar Belakang
Industri otomotif (dealer 3S: Sales, Service, Spare Parts) sangat bergantung pada kecepatan dan kedisiplinan sumber daya manusia (SDM). Seringkali terjadi kesenjangan antara sistem CRM konvensional (hanya fokus pada data pelanggan) dan sistem HRD (hanya mencatat presensi tanpa mengukur produktivitas nyata).

Dampaknya:
* Prospek pelanggan sering dialokasikan ke wiraniaga yang sedang cuti/off-duty, menyebabkan hilangnya potensi penjualan.
* Tim HRD kesulitan menghitung insentif penjualan SPK (Surat Pemesanan Kendaraan) dan utilisasi mekanik secara transparan.
* Manajemen cabang tidak memiliki visibilitas *real-time* atas korelasi antara kehadiran staf dengan target harian dealer.

### 1.2 Solusi: AutoPulse CRM
**AutoPulse CRM** mengintegrasikan alur operasional otomotif dengan metrik produktivitas SDM dalam satu platform. Dimulai dari **Laman Login Split-Screen Berstatistik**, seluruh personel dealer disuguhkan indikator denyut operasional cabang (*Live Dealer Pulse*) sebelum masuk ke ruang kerja digital mereka. Dilengkapi dengan **Dukungan 2 Bahasa (Indonesia & Inggris)** serta **Peralihan Tema Ganda (Dark & Light Mode)** untuk kenyamanan kerja optimal.

---

## 2. Profil Pengguna & Matriks Hak Akses (RBAC)

| Peran (Role) | Kebutuhan Utama | Manfaat Utama |
| :--- | :--- | :--- |
| **HRD & People Ops** | Memantau absensi tim dealer, utilisasi teknisi, evaluasi KPI, dan otomatisasi komisi SPK. | Presensi terhubung langsung ke produktivitas; kalkulasi komisi otomatis siap ekspor payroll. |
| **Branch Manager** | Memantau performa cabang (penjualan unit, kehadiran staf, unit servis, dan CSAT). | Pengambilan keputusan cepat berbasis data komprehensif harian. |
| **Sales Consultant** | Mengelola prospek, follow-up test drive, penerbitan SPK, dan leaderboard komisi pribadi. | Distribusi prospek adil; leaderboard memicu motivasi kompetitif sehat. |
| **Service Advisor & Mekanik** | Mengelola antrean servis berkala, estimasi waktu pengerjaan, dan beban kerja stall. | Beban kerja stall terukur dan efisiensi waktu kerja tercatat adil. |

---

## 3. Spesifikasi Laman Login Berstatistik, Tema Ganda, & Multibahasa

### 3.1 Tata Letak Split-Screen & Kontrol Preferensi
* **Header Bar Laman Login:** Memuat selector dwibahasa (ID 🇮🇩 / EN 🇬🇧) dan tombol toggle tema (☀️ Light / 🌙 Dark) di sudut kanan atas.
* **Sisi Kiri (Authentication Portal):**
  * Brand logo AutoPulse & greeting dinamis berdasarkan waktu (*Pagi/Siang/Sore/Malam*).
  * Input NIP/Email dan Password dengan tombol pengintip (*show/hide password*).
  * Selector cabang dealer dengan penyimpanan preferensi lokal (*localStorage*).
  * Tombol Masuk utama & Tombol Single Sign-On (SSO) perusahaan.
  * Tautan bantuan langsung ke HRD (*WhatsApp & ext support*).
* **Sisi Kanan (Live Dealer Pulse & HRD Metrics):**
  * Metrik kehadiran real-time staf dealer (Sales & Teknisi Bengkel).
  * Leaderboard Top 3 Sales Consultant bulan ini (nama anonim aman: *Andi S.*, *Maya R.*).
  * Counter aktivitas harian: Prospek baru & jadwal *test drive*.
  * Ticker running text pengumuman harian dari HRD.

### 3.2 Wireframe ASCII Laman Login (Dark & Light Mode)

```
+-------------------------------------------------------------------------------------+
| [Logo AutoPulse CRM]                     [🌐 ID | EN] [🌓 Toggle Tema Light/Dark]   |
+------------------------------------------+------------------------------------------+
|          SISI KIRI: AUTENTIKASI          |       SISI KANAN: LIVE DEALER PULSE      |
|                                          |   (Showcase Statistik Kinerja & SDM)     |
| Selamat Datang di AutoPulse CRM          |                                          |
| "Kinerja Andal, Pelayanan Unggul"        | [Waktu Cabang & Status Shift Aktif]      |
|                                          |                                          |
| [ Input NIP / Email Perusahaan ]         | +--------------------------------------+ |
| [ Input Kata Sandi ] [👁️ Toggle Lihat]   | | 👥 Kehadiran Staf Hari Ini: 94.8%    | |
| [ Pilihan Cabang Dealer (Dropdown) ]     | |    - 18/19 Sales Consultant On-Duty  | |
|                                          | |    - 12/12 Teknisi Bengkel Standby   | |
| [x] Ingat Saya     [ Lupa Kata Sandi? ]  | +--------------------------------------+ |
|                                          | +--------------------------------------+ |
| [====== TOMBOL MASUK SISTEM ======]      | | 🏆 Top Sales Leaderboard (Bulan Ini) | |
|                                          | |    1. Andi S. - 14 SPK (140% Target) | |
| --- atau masuk dengan ---                | |    2. Maya R. - 11 SPK (110% Target) | |
| [ Masuk dengan Akun Perusahaan (SSO) ]   | |    3. Budi T. - 9 SPK  (90% Target)  | |
|                                          | +--------------------------------------+ |
| Butuh bantuan akun? Hubungi HRD Support  | +--------------------------------------+ |
| (WhatsApp / Ext: 104)                    | | 🚗 Aktivitas Prospek & Test Drive    | |
|                                          | |    - 32 Prospek Baru Hari Ini        | |
|                                          | |    - 8 Jadwal Test Drive Terjadwal   | |
|                                          | +--------------------------------------+ |
|                                          | 📢 Pesan HRD: "Briefing Pagi Pk 08:30"   |
+------------------------------------------+------------------------------------------+
```

---

## 4. Desain Sistem Tema (Dark Mode vs Light Mode)

Sistem menggunakan CSS Custom Properties murni (`:root` dan `[data-theme="light"]`) dengan transisi halus (`transition: background 0.3s ease, color 0.3s ease`):

| Elemen Desain | Dark Mode (Obsidian Titanium) | Light Mode (Alabaster Frost) |
| :--- | :--- | :--- |
| **Latar Belakang Utama (`--bg-primary`)** | `#0A0E17` (Deep Obsidian) | `#F8FAFC` (Pure Alabaster) |
| **Latar Belakang Kartu (`--bg-card`)** | `rgba(26, 32, 44, 0.75)` (Glass Dark) | `rgba(255, 255, 255, 0.85)` (Glass Light) |
| **Border & Divider (`--border-color`)** | `rgba(255, 255, 255, 0.1)` | `rgba(15, 23, 42, 0.08)` |
| **Teks Utama (`--text-primary`)** | `#F8FAFC` (Pure Titanium) | `#0F172A` (Slate Dark) |
| **Teks Sekunder (`--text-secondary`)**| `#94A3B8` (Cool Slate) | `#475569` (Charcoal Muted) |
| **Aksen Utama (`--accent-primary`)** | `#06B6D4` (Electric Cyan) | `#0891B2` (Deep Cyan) |
| **Aksen Aksi (`--accent-action`)** | `#E11D48` (Velocity Crimson) | `#DC2626` (Racing Red) |
| **Efek Permukaan Glass** | `backdrop-filter: blur(16px)` + glow halus | `backdrop-filter: blur(16px)` + soft shadow |

---

## 5. Fitur Multibahasa (Indonesian & English Dictionary)

Sistem menyediakan kamus i18n modular di sisi klien:
* **Bahasa Indonesia (ID):** "Selamat Datang", "Masuk Sistem", "Kehadiran Staf", "Papan Peringkat Penjualan", "Hubungi Bantuan HRD".
* **English (EN):** "Welcome Back", "Sign In", "Staff Attendance", "Sales Leaderboard", "Contact HR Support".

Preferensi bahasa dan tema otomatis tersimpan di `localStorage` dan mendeteksi preferensi browser sistem (`prefers-color-scheme`).

---

# [EN] ENGLISH SECTION

## 1. Executive Summary

### 1.1 Background
The automotive retail dealership industry (3S: Sales, Service, Spare Parts) is heavily reliant on human workforce efficiency and punctuality. Traditional automotive CRMs focus solely on customer records, completely detached from HR attendance and workforce management.

Key operational hurdles include:
* Incoming sales leads are frequently assigned to offline or on-leave sales reps, leading to cold inquiries and lost deals.
* HR teams struggle to compute vehicle order commission (SPK incentives) and service technician utilization transparently and promptly.
* Dealership branch managers lack unified, real-time visibility into the direct link between staff attendance and daily sales targets.

### 1.2 Solution: AutoPulse CRM
**AutoPulse CRM** unifies automotive customer journeys with real-time workforce operational intelligence. Starting directly on the **Split-Screen Login Page with Live Statistics**, dealership staff, managers, and HR personnel are greeted with real-time dealership vital signs (*Live Dealer Pulse*) before entering their daily workspace. Featuring seamless **Bilingual Support (Indonesian & English)** and a **Dual Theme Engine (Dark & Light Mode)**.

---

## 2. User Roles & Permission Matrix (RBAC)

| Role | Core Needs | Primary Value Delivered |
| :--- | :--- | :--- |
| **HRD & People Ops** | Monitor dealership attendance, technician flat-rate hours, KPI grading, and SPK sales incentive automation. | Attendance linked directly to real output; one-click export for payroll processing. |
| **Branch Manager** | Real-time branch performance overview (vehicle sales, technician duty rate, active service orders, CSAT). | High-velocity decision making powered by unified operational intelligence. |
| **Sales Consultant** | Lead management, test drive tracking, vehicle order (SPK) issuance, and personal commission tier tracker. | Merit-based lead allocation and motivational showroom leaderboard. |
| **Service Advisor & Technician** | Service booking queue, repair duration tracking, and workshop bay workload allocation. | Transparent workshop load balancing and accurate technician efficiency logging. |

---

## 3. Login Page Specifications: Statistics, Dual Theme, & i18n

### 3.1 Split-Screen Layout Architecture & Controls
* **Top Header Navigation:** Houses the Language Selector (ID 🇮🇩 / EN 🇬🇧) and Theme Switcher (☀️ Light / 🌙 Dark) at the top-right corner.
* **Left Panel (Authentication Portal):**
  * AutoPulse Brand Identity & time-adaptive greeting (*Morning / Afternoon / Evening*).
  * Employee ID (NIP) / Corporate Email input with real-time validation.
  * Password input with show/hide visibility toggle.
  * Dealership Branch selector with persistence.
  * Primary Action Sign-In & Corporate Single Sign-On (SSO via Google / Microsoft Entra).
  * Direct HR Helpdesk route (*WhatsApp & phone extension*).
* **Right Panel (Live Dealer Pulse & HR Showcase):**
  * Live Staff Attendance percentage (Sales Consultants & Service Technicians on duty).
  * Monthly Sales Leaderboard (privacy-compliant top 3 performers: *Andi S.*, *Maya R.*).
  * Daily pipeline counters: New incoming leads & scheduled test drives.
  * Live HR Announcement broadcast ticker.

### 3.2 Security, Pre-Auth Sanitization & Zero PII
* **Privacy-Safe Public Endpoint:** Public statistics are retrieved from `GET /api/v1/public/dealer-pulse`.
* **Zero PII Protection:** No customer identity, contact info, vehicle plate numbers, or confidential financial values are exposed before authentication.
* **Rate Limiting & Caching:** Statistics data is aggregated and cached via Redis/memory (TTL: 60 seconds) with an IP rate limit of 30 requests/minute.
* **Graceful Fallback:** If network delay occurs on the statistics feed, the right panel seamlessly falls back to a static automotive showcase image without interrupting the core login form on the left.

---

## 4. Theme System Tokens (Dark Mode vs Light Mode)

Configured cleanly through CSS custom properties with hardware-accelerated transitions:

```css
:root {
  /* Dark Mode Default */
  --bg-primary: #0A0E17;
  --bg-card: rgba(26, 32, 44, 0.75);
  --border-color: rgba(255, 255, 255, 0.1);
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --accent-primary: #06B6D4;
  --accent-action: #E11D48;
}

[data-theme="light"] {
  /* Light Mode */
  --bg-primary: #F8FAFC;
  --bg-card: rgba(255, 255, 255, 0.85);
  --border-color: rgba(15, 23, 42, 0.08);
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --accent-primary: #0891B2;
  --accent-action: #DC2626;
}
```

---

## 5. Implementation Roadmap / Tahapan Rencana Kerja

1. **Sprint 1:** Split-Screen Login Page UI, Dual Theme Engine (Dark/Light), Bilingual i18n Switcher (ID/EN), and Animated Pre-Auth Dealer Pulse Stats.
2. **Sprint 2:** Authenticated Dashboard, Smart Lead Allocation (connected to HR attendance clock-in), and Sales Pipeline tracker.
3. **Sprint 3:** Automated Sales Commission Engine, Incentive calculation, and HR Payroll Export.
4. **Sprint 4:** Workshop Bay Technician Utilization, Service Booking Scheduler, and Branch KPI Analytics.
