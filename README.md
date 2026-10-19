# Smart POS Billing & Mobile Barcode Scanning System

A production-ready Point of Sale (POS), inventory management, and barcode scanning solution designed for single-shop operations. It uses your laptop as the main billing counter and any smartphone camera as a high-speed wireless barcode scanner.

---

## ⚡ Highlights & Key Features

- **Wireless Mobile Phone Scanner (< 15ms latency)**: Scan products using any Android or iPhone camera in the mobile browser. Zero app installation required. Uses WebSockets (`Socket.IO`) over your local Wi-Fi router or phone mobile hotspot.
- **Laptop POS Billing Counter**: Instant product lookup, auto-increment on repeat scans, manual product search fallback, tax & discount calculation, cash tender change calculator, and keyboard shortcuts (`F2`, `F4`, `F9`, `Enter`).
- **Thermal Receipt Printing**: Formatted specifically for **80mm** (standard) and **58mm** (compact) thermal receipt printers with receipt reprint support that never duplicates sales.
- **Barcode Label Designer & Sticker Sheet Printer**: Generate and print **Code 128** and **EAN-13** barcode labels (A4 24/40 stickers or single roll label).
- **MySQL Database via Prisma ORM**: Works with your local MySQL or your hosted **Hostinger MySQL** cloud database.
- **Sales Analytics & Gross Profit Reports**: Daily, weekly, monthly, and yearly sales reports, gross profit estimation (`Revenue - Purchase Cost - Tax`), payment tender breakdown (Cash vs UPI vs Card), and 1-click CSV export.
- **Offline & Local-First Resilient**: Continues operating smoothly over local Wi-Fi or phone hotspot.

---

## 🏗️ Architecture & Technology Stack

```
Mobile Phone (Camera Barcode Scanner)
       │
       │ WebSocket / LAN HTTP (< 15ms)
       ▼
Laptop POS Terminal (Express 5 + Socket.IO + React 18 + Vite)
       │
       │ Prisma ORM (Type-Safe Client)
       ▼
MySQL Database (Hostinger Cloud or Local)
       │
       ▼
Thermal Receipt Printer (80mm / 58mm Paper)
```

- **Backend**: Node.js, Express 5, Socket.IO, Prisma ORM, TypeScript.
- **Frontend**: React 18, Vite, TypeScript, Lucide Icons, Html5-Qrcode, JsBarcode.
- **Database**: MySQL (hosted on Hostinger or local).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18+)
- MySQL (Local or Hostinger Cloud)

### 2. Configuration (`.env`)
The database connection string is configured in `.env`:
```env
# Local MySQL (Default):
DATABASE_URL="mysql://root:root123@127.0.0.1:3307/pos_billing_db"

# Or Hostinger Cloud MySQL:
# DATABASE_URL="mysql://u123456789_user:Password@195.35.x.x:3306/u123456789_pos_db"

PORT=5001
CLIENT_URL="http://localhost:5173"
```

### 3. Sync Database & Seed Data
```bash
# Push schema to MySQL
npm run prisma:push

# Seed sample products, barcodes, and shop settings
npm run prisma:seed
```

### 4. Start the Application
```bash
npm run dev
```
This automatically boots both the backend API server (port 5001) and the Vite POS frontend (port 5173).

- **Laptop Billing Terminal**: Open [http://localhost:5173](http://localhost:5173) in Chrome or Safari.
- **Mobile Camera Scanner**: Connect your phone to the same shop Wi-Fi and open the URL shown in the terminal (or scan the **Pair Phone** QR code from the laptop navbar).

---

## 📱 How Mobile Barcode Scanning Works

1. On the laptop billing screen, click **Pair Phone** in the top-right corner.
2. A QR code appears showing your laptop's local network address (e.g. `http://192.168.1.5:5173/scanner`).
3. Point your smartphone's camera at the QR code to open the mobile web scanner.
4. Allow camera permissions when prompted.
5. Point your phone at any product barcode:
   - On a valid product scan: The phone gives a **green flash + chime sound + haptic vibration**.
   - The product instantly appears in your laptop billing cart in **< 15 milliseconds**!
   - Repeated scans of the same product automatically increment the quantity (`+1`).
   - If an uncatalogued barcode is scanned, the laptop displays a **Quick Add Product** modal so the operator can type the name and price in 5 seconds without leaving checkout.

---

## 🌐 Connecting to Hostinger Cloud MySQL

To store your products and invoices in your Hostinger MySQL database:
1. Log in to your **Hostinger hPanel**.
2. Go to **Databases** → **Remote MySQL**.
3. Under **IP (IPv4 or IPv6)**, enter `%` (wildcard to allow external connection) or your shop's IP address.
4. Select your database and click **Create**.
5. Update `DATABASE_URL` in `.env` with your Hostinger database details:
   ```env
   DATABASE_URL="mysql://u123456789_user:YourStrongPassword@remote-ip:3306/u123456789_pos_db"
   ```
6. Run `npm run prisma:push` to create all tables on Hostinger.

---

## 🖨️ Thermal Receipt Printing (80mm & 58mm)

- Standard thermal printer paper size is supported (**80mm** default, or **58mm** compact).
- When a sale is completed, the receipt print dialog opens automatically.
- Receipts include shop name, address, GSTIN, invoice number, item descriptions, rates, tax breakdown, and footer greeting.
- Past receipts can be retrieved and reprinted anytime from the **Invoices** tab without duplicating sales or re-deducting stock.

---

## 🏷️ Barcode Label Printing

- Go to the **Barcode Generator** tab.
- Select any product or type custom values.
- Choose **Code 128** (internal alphanumeric) or **EAN-13** (standard retail 13-digit).
- Choose your layout (A4 sticker sheet with 24 labels, 40 labels, or single roll label printer).
- Click **Print Barcode Labels** to print adhesive sticker sheets.

---

## ⌨️ Keyboard Shortcuts for Rapid Billing

| Shortcut | Action |
| :--- | :--- |
| `F2` | Discard active bill / New transaction |
| `F4` | Focus product search input |
| `F9` | Open Payment & Checkout modal |
| `Enter` | Complete sale & print receipt |
