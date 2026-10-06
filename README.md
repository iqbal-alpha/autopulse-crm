# AutoPulse CRM — Automotive Dealership & Workforce Management System

[![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-Modern_Tokens-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![HTML5](https://img.shields.io/badge/HTML5-Semantic_A11y-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Tests](https://img.shields.io/badge/Tests-31%20Passing%20(100%25)-success)](https://nodejs.org/api/test.html)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-blueviolet)](#technology-stack)

**AutoPulse CRM** is an enterprise-grade automotive 3S (*Sales, Service, Spare Parts*) dealership operations and workforce management web application. Designed for multi-branch dealership networks, it unifies daily attendance discipline, vehicle sales commission pipelines, showroom lead stages, workshop stall telemetry, and branch executive reports into a responsive, high-performance interface.

---

## 🚀 Live Demo & Quick Access

- **Live URL:** [[https://iqbal-alpha.github.io/autopulse-crm/]
- **Demo Account (Pre-filled):**
  - **NIP / Employee ID:** `10230045`
  - **Work Email:** `rina.kartika@autopulse.id`
  - **Password:** `demo123` *(or click the "Isi otomatis / Auto-fill" button on the login screen)*
  - **Default Role:** HRD & People Operations (switchable to Branch Manager via dropdown)

---

## 🌟 Core Features & Modules

### 1. Pre-Auth "Live Dealer Pulse" (Login Portal)
- Real-time aggregated showroom & service telemetry (zero customer PII).
- Interactive SVG attendance gauge with department breakdown.
- Hourly customer inquiry & test-drive trend sparklines.
- Dealership branch selector with dynamic data recalculation.
- Account lockout protection (30-second cooldown after 5 failed attempts) and HR support modal.

### 2. Multi-Role Adaptive Dashboard
- **HRD & People Operations View:**
  - 4 Key Metrics: Staff Attendance Rate, Approved Leaves, Workshop Stall Utilization, and Estimated SPK Commission.
  - 30-Day Attendance Trend Line Chart (custom SVG with 7d/30d filter & department series toggle).
  - Staff Status Composition Donut Chart.
  - Leave Request Approval Queue with interactive *Approve* and *Reject* workflows.
- **Branch Manager View:**
  - 4 Key Metrics: Delivered Units (SPK), Workshop Service Volume, Lead-to-SPK Conversion, and Dealership CSAT.
  - 8-Week Sales Realization vs Target Bar Chart (custom SVG with weekly targets).
  - Monthly Dealership Target Achievement Semicircle Gauge.
  - Top Sales Consultant Leaderboard & active leads ranking.
  - Workshop Stall Telemetry Queue (*In Progress*, *Queued*, *Past Due*).

### 3. Integrated Sub-View Modules
- **Presensi Staf (Staff Attendance & Punctuality):** Daily shift records (morning/afternoon), check-in/out timestamps, status filtering, and simulated Excel attendance export.
- **Insentif SPK (Vehicle Order Incentives):** Automated tier calculation (Rp 1.500.000/SPK + accelerator bonus for delivery > 10 units), payroll verification status, and batch finance submission.
- **Direktori Tim (3S Team Directory):** Employee card grid with live status indicators, company email, telephone extensions, KPI index badges, and internal contact triggers.
- **Pipeline Prospek (Vehicle Sales Leads):** 5-stage customer conversion funnel (*New Inquiry*, *Contacted*, *Test Drive*, *Financing Negotiation*, *Delivered*), vehicle interest tracking, and showroom lead creation.
- **Laporan Cabang (Dealership 3S Analytics):** Executive monthly summary, sales realization, workshop volume, CSAT index (4.8/5.0), spare parts turnover ratio, dealership SOP compliance audit, and official PDF/Excel report downloads.

### 4. Experience & Accessibility
- **Dual Theme Engine:** *Obsidian Dark* (`[data-theme="dark"]`) and *Alabaster Light* (`[data-theme="light"]`) with smooth CSS token transitions and zero-flash pre-paint script.
- **Bilingual Interface:** Instant switching between natural **Bahasa Indonesia** and **English** with 100% dictionary key parity.
- **Accessibility (A11y):** Full keyboard navigation with skip-link, semantic landmarks, descriptive ARIA attributes, live regions for toasts, and `prefers-reduced-motion` compliance.

---

## 🛠️ Technology Stack & Architecture

Built completely with the **Pure Vanilla Web Platform** to ensure zero runtime overhead, instant load times, and maximum maintainability:

| Layer | Technologies Used | Key Characteristics |
| :--- | :--- | :--- |
| **Structure** | Semantic HTML5 | Accessible landmarks, ARIA labels, skip-links, WCAG compliance |
| **Styling** | Modern Vanilla CSS3 | Custom Properties (Design Tokens), Glassmorphism (`backdrop-filter`), `color-mix()`, CSS Grid & Flexbox |
| **Logic** | Vanilla JavaScript (ES6+) | Modular UMD architecture, reactive state management, zero external libraries |
| **Visualization** | Native SVG Engine | Mathematical coordinate generation for line charts, bar charts, donut charts, and gauges without Chart.js or D3 |
| **Session** | Session API (`session.js`) | Time-to-Live (TTL) enforcement, role validation, route guards, and automatic timeout handling |
| **Testing** | Node.js Test Runner | 31 automated unit and DOM integrity tests with 100% pass rate |

---

## 📂 Project Structure

```text
autopulse-crm/
├── index.html              # Login portal with Live Dealer Pulse telemetry
├── dashboard.html          # Main application shell with multi-role subviews
├── styles.css              # Core design tokens, dark/light themes, and login styles
├── dashboard.css          # Scoped dashboard layout, charts, cards, and subview styles
├── app.js                  # Login authentication logic, input validation, and pulse feed
├── dashboard.js            # Reactive dashboard controller, SVG rendering, and tab routing
├── dashboard-data.js       # Deterministic seeded mock data engine (5 branches, 2 roles)
├── dashboard-i18n.js       # Bilingual dictionary (Indonesian & English)
├── session.js              # Client-side session management with TTL & route guards
├── serve.js                # Lightweight zero-dependency Node.js HTTP preview server
├── tests/                  # Automated test suite
│   ├── dashboard-data.test.js # Data consistency and PRNG determinism tests
│   ├── i18n.test.js        # Bilingual dictionary parity and completeness tests
│   ├── integrity.test.js   # HTML ID uniqueness and JS DOM query matching tests
│   └── session.test.js     # Session lifecycle, expiry, and storage fallback tests
└── README.md               # Technical documentation
```

---

## 💻 Running Locally

### Option 1: Native Node.js Preview Server (Recommended)
This repository includes a zero-dependency HTTP server:

```bash
# Clone the repository
git clone https://github.com/iqbal-alpha/autopulse-crm.git

# Enter project directory
cd autopulse-crm

# Start the preview server
node serve.js
```
Open **`http://127.0.0.1:5500`** in your browser.

### Option 2: Direct File Open
Because the project uses relative paths and standard ES6 modules, you can also simply double-click **`index.html`** or serve it with any static web server (such as VS Code Live Server).

---

## 🧪 Automated Testing

All core modules are verified by Node.js built-in test runner:

```bash
# Run all test suites
node --test "tests/*.test.js"
```

**Test Coverage Highlights:**
- **31 / 31 passing unit tests**:
  - Deterministic data generation across all 5 branches (`jkt`, `bsd`, `bdg`, `sby`, `mdn`).
  - Strict 1:1 key parity between Indonesian and English dictionaries.
  - HTML ID uniqueness and 100% selector consistency between JavaScript and HTML templates.
  - Session timeout, role validation, and storage fail-safe handling.

