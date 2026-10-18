# 🩺 Caseboard

เว็บแอปแจกเคสและติดตามคนไข้สำหรับนักศึกษาแพทย์ / แพทย์ประจำบ้านที่ขึ้นวอร์ด
ทำงานบน **Google Sheets + Google Apps Script** ใช้ได้ทุกวอร์ด ทุกสาย ทุก Rotation

**▶︎ ลองเล่น Sandbox (ข้อมูลจำลอง ไม่ต่อชีทจริง):** https://charliegogoyeh-dotcom.github.io/OBGYN-alphza-sandbox/

## ฟีเจอร์

- **Active cases** — ดูคนไข้ที่ยังนอนอยู่ แยกตามคนรับ / วอร์ด / เตียง
- **แจกเคสใหม่** — สุ่มด้วยวงล้อถ่วงน้ำหนักตามภาระงาน (Active, Consult, แผล, นอนนาน) หรือเลือกผู้รับเอง
- **D/C จากหน้าเว็บ** — ทีละคนหรือหลายคนพร้อมกัน พร้อมปุ่ม Undo
- **สถานะคนไข้** — แผล / Consult / ย้ายวอร์ด-เตียง
- **Notes + Templates** — progress note แบบ rich text, template SOAP / post-op / pre-op
- **Imaging** — แนบภาพ X-ray / CT / MRI / US เก็บใน Google Drive
- **Avatar** — เลือก avatar ประจำตัวได้ 20 แบบ
- **ตั้งค่าในเว็บ** — ชื่อสาย, คนรับเคส, อาจารย์, วอร์ด, ตารางเวร, น้ำหนักคะแนน
- **แท็บ Caseboard ในชีท** — ปุ่ม 🚀 Deploy + ลิงก์เว็บแอปที่ช่อง C1

## โครงสร้าง repo

```
apps-script/
  Code.gs           ฝั่งเซิร์ฟเวอร์ (อ่าน/เขียนชีท, คำนวณคะแนน, Drive)
  Index.html        หน้าเว็บทั้งหมด (HTML + CSS + JS ไฟล์เดียว)
  appsscript.json   manifest (V8, Asia/Bangkok, web app = User accessing)
index.html          Sandbox สำหรับ GitHub Pages — จำลอง Code.gs ในเบราว์เซอร์
docs/index.html     สำเนาเดียวกัน (ใช้ได้ทั้ง Pages แบบ / (root) และ /docs)
```

## ติดตั้ง (ประมาณ 5 นาที)

1. สร้าง Google Sheet เปล่า → **Extensions → Apps Script**
2. วางโค้ด `Code.gs` และสร้างไฟล์ HTML ชื่อ **`Index`** แล้ววาง `Index.html`
3. Project Settings → ติ๊ก *Show "appsscript.json"* → วางเนื้อหา `appsscript.json`
4. กลับไปที่ชีท รีโหลด → เมนู **🩺 Caseboard → ตั้งค่าเริ่มต้น**
5. ทำตามหน้าต่าง 🚀 Deploy:
   **Deploy → New deployment → Web app**
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone with Google account**
6. วางลิงก์ `/exec` ในหน้าต่าง 🚀 → ลิงก์จะขึ้นที่แท็บ **Caseboard** ช่อง C1
7. แชร์ชีท (สิทธิ์ **Editor**) ให้ทุกคนในทีม → เปิดเว็บ → **ตั้งค่า** ใส่ชื่อสาย คนรับเคส อาจารย์ วอร์ด

> **แก้โค้ดแล้วอัปเดตเว็บ:** Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy (ลิงก์เดิม)

### ใช้ clasp (ไม่บังคับ)

```bash
npm i -g @google/clasp && clasp login
clasp clone <SCRIPT_ID> --rootDir apps-script   # SCRIPT_ID จาก Project Settings
clasp push
```

`.clasp.json` อยู่ใน `.gitignore` แล้ว — แต่ละกลุ่มผูกกับสคริปต์ของตัวเอง

## เปิด Sandbox บน GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → Branch `main` / folder **`/ (root)`** หรือ **`/docs`** ก็ได้ → Save

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| คนอื่นเปิดลิงก์แล้วขึ้น *"Sorry, unable to open the file at this time"* | Who has access ยังเป็น *Only myself* → แก้เป็น *Anyone with Google account* · หรือล็อกอินหลายบัญชีในเบราว์เซอร์เดียว → ลองเปิดใน Incognito |
| เว็บเปิดได้แต่โหลดข้อมูลไม่ขึ้น | ยังไม่ได้แชร์ชีทเป็น Editor ให้คนนั้น |
| ปุ่ม 🚀 ในชีทกดไม่ได้ | ปุ่มรูปภาพใช้ไม่ได้บนแอปมือถือ → ใช้เมนู 🩺 Caseboard บนคอมพิวเตอร์ |

## ความเป็นส่วนตัวของข้อมูลผู้ป่วย

ข้อมูลคนไข้ (ชื่อ, HN, Dx) อยู่ใน **Google Sheet ของกลุ่มเท่านั้น** ไม่มีใน repo นี้
**ห้าม commit ไฟล์ export ของชีท หรือภาพหน้าจอที่มีข้อมูลคนไข้จริง** — Sandbox ใช้ข้อมูลสมมติทั้งหมด
