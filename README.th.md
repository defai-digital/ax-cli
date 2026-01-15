# AX CLI - เครื่องมือเขียนโค้ด AI ระดับองค์กร

> 📖 การแปลนี้อ้างอิงจาก [README.md @ v5.1.9](./README.md)

[![downloads](https://img.shields.io/npm/dt/@defai.digital/automatosx?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-6,084+%20passing-brightgreen.svg)](#)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.ko.md">한국어</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.pt.md">Português</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.vi.md">Tiếng Việt</a> |
  <a href="./README.th.md">ไทย</a>
</p>

## สารบัญ

- [ผู้ใช้ GLM / Z.AI](#ผู้ใช้-glm--zai)
- [เริ่มต้นอย่างรวดเร็ว](#เริ่มต้นอย่างรวดเร็ว)
- [ทำไมต้อง AX CLI?](#ทำไมต้อง-ax-cli)
- [โมเดลที่รองรับ](#โมเดลที่รองรับ)
- [การติดตั้ง](#การติดตั้ง)
- [การใช้งาน](#การใช้งาน)
- [การตั้งค่า](#การตั้งค่า)
- [การรวม MCP](#การรวม-mcp)
- [ส่วนขยาย VSCode](#ส่วนขยาย-vscode)
- [การรวม AutomatosX](#การรวม-automatosx)
- [หน่วยความจำโปรเจกต์](#หน่วยความจำโปรเจกต์)
- [ความปลอดภัย](#ความปลอดภัย)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [แพ็คเกจ](#แพ็คเกจ)

---

## ผู้ใช้ GLM / Z.AI

> **สำคัญ:** Z.AI ได้เปิดตัวเครื่องมือ CLI อย่างเป็นทางการชื่อ **OpenCode** เราแนะนำให้ผู้ใช้ GLM/Z.AI ใช้ OpenCode โดยตรงแทน ax-glm เริ่มต้นกับ OpenCode: https://opencode.ai แพ็คเกจ ax-glm คลาวด์ถูกยกเลิกและลบออกจาก repository นี้เพื่อสนับสนุนโซลูชันอย่างเป็นทางการของ Z.AI
>
> **หมายเหตุ:** โมเดล GLM ในเครื่อง (GLM-4.6, CodeGeeX4) ยังคงได้รับการสนับสนุนอย่างเต็มที่ผ่าน `ax-cli` สำหรับการอนุมานแบบออฟไลน์ผ่าน Ollama, LMStudio หรือ vLLM ดูส่วน [โมเดลในเครื่อง/ออฟไลน์](#โมเดลในเครื่องออฟไลน์-ax-cli) ด้านล่าง

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>ผู้ช่วยเขียนโค้ด AI ระดับองค์กรที่ปรับแต่งสำหรับ Grok</strong>
</p>

## เริ่มต้นอย่างรวดเร็ว

เริ่มต้นได้ภายในไม่ถึงหนึ่งนาที:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**เหมาะสำหรับ:** ค้นหาเว็บแบบเรียลไทม์, วิชั่น, การให้เหตุผลขยาย

เรียกใช้ `/init` ใน CLI เพื่อเริ่มต้นบริบทโปรเจกต์ของคุณ

> **ผู้ใช้ GLM/Z.AI:** กรุณาใช้ [OpenCode CLI](https://opencode.ai) อย่างเป็นทางการของ Z.AI แทน ax-glm

---

## ทำไมต้อง AX CLI?

| ฟีเจอร์ | คำอธิบาย |
|---------|----------|
| **ปรับแต่งตามผู้ให้บริการ** | รองรับระดับแรกสำหรับ Grok (xAI) พร้อมพารามิเตอร์เฉพาะของผู้ให้บริการ |
| **17 เครื่องมือในตัว** | แก้ไขไฟล์, รัน bash, ค้นหา, todos และอื่นๆ |
| **พฤติกรรมเอเจนต์** | ลูปการให้เหตุผล ReAct, แก้ไขตัวเองเมื่อล้มเหลว, การตรวจสอบ TypeScript |
| **เอเจนต์ AutomatosX** | 20+ เอเจนต์ AI เฉพาะทางสำหรับ backend, frontend, ความปลอดภัย, DevOps และอื่นๆ |
| **แก้ไขบั๊กอัตโนมัติ** | สแกนและแก้ไขการรั่วไหลของตัวจับเวลา, ปัญหาทรัพยากร, ข้อผิดพลาดประเภทพร้อมความปลอดภัยในการย้อนกลับ |
| **การรีแฟคเตอร์อัจฉริยะ** | ลบโค้ดที่ไม่ใช้, แก้ไขความปลอดภัยของประเภท, ลดความซับซ้อนพร้อมการตรวจสอบ |
| **การรวม MCP** | Model Context Protocol พร้อม 12+ เทมเพลตพร้อมใช้งานจริง |
| **หน่วยความจำโปรเจกต์** | แคชบริบทอัจฉริยะประหยัด Token 50% |
| **ความปลอดภัยระดับองค์กร** | เข้ารหัส AES-256-GCM, ไม่มี telemetry, การป้องกันระดับ CVSS |
| **65% ครอบคลุมการทดสอบ** | 6,084+ การทดสอบพร้อม TypeScript เข้มงวด |

---

### ไฮไลท์ของ Grok

- **Grok (ax-grok)**: ค้นหาเว็บในตัว, วิชั่น, reasoning_effort; **รุ่นเร็วของ Grok 4.1 มีบริบท 2M, เครื่องมือเซิร์ฟเวอร์แบบขนาน, x_search และการรันโค้ดฝั่งเซิร์ฟเวอร์**
- CLI ใช้เครื่องมือร่วมกัน (แก้ไขไฟล์, MCP, bash) และหน่วยความจำโปรเจกต์กับแกนกลางที่ใช้ร่วมกัน

---

## โมเดลที่รองรับ

### Grok (xAI)

| โมเดล | บริบท | ฟีเจอร์ | นามแฝง |
|-------|--------|---------|--------|
| `grok-4.1` | 131K | ค่าเริ่มต้นสมดุลพร้อมการให้เหตุผล, วิชั่น, การค้นหาในตัว | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | ดีที่สุดสำหรับเซสชันเอเจนต์/เครื่องมือหนักพร้อมการให้เหตุผล | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | การรันเอเจนต์เร็วที่สุดโดยไม่มีการให้เหตุผลขยาย | `grok-fast-nr` |
| `grok-4-0709` | 131K | รุ่น Grok 4 ดั้งเดิม (เข้ากันได้) | `grok-4` |
| `grok-2-image-1212` | 32K | **สร้างภาพ**: ข้อความเป็นภาพ | `grok-image` |

> **นามแฝงโมเดล**: ใช้นามแฝงที่สะดวกเช่น `ax-grok -m grok-latest` แทนชื่อโมเดลเต็ม

---

## การติดตั้ง

### ข้อกำหนด

- Node.js 24.0.0+
- macOS 14+, Windows 11+ หรือ Ubuntu 24.04+

### คำสั่งติดตั้ง

```bash
npm install -g @defai.digital/ax-grok
```

### การตั้งค่า

```bash
ax-grok setup
```

วิซาร์ดการตั้งค่าจะนำทางคุณผ่าน:
1. เข้ารหัสและจัดเก็บ API key ของคุณอย่างปลอดภัย (ใช้การเข้ารหัส AES-256-GCM)
2. กำหนดค่าโมเดล AI เริ่มต้นและการตั้งค่าอื่นๆ
3. ตรวจสอบการกำหนดค่าของคุณเพื่อให้แน่ใจว่าทุกอย่างถูกต้อง

---

## การใช้งาน

### โหมดโต้ตอบ

```bash
ax-grok              # เริ่มเซสชัน CLI แบบโต้ตอบ
ax-grok --continue   # ดำเนินการสนทนาก่อนหน้า
ax-grok -c           # รูปแบบย่อ
```

### โหมด Headless

```bash
ax-grok -p "วิเคราะห์ codebase นี้"
ax-grok -p "แก้ไขข้อผิดพลาด TypeScript" -d /path/to/project
```

### แฟล็กพฤติกรรมเอเจนต์

```bash
# เปิดใช้งานโหมดการให้เหตุผล ReAct (วงจรคิด → ทำ → สังเกต)
ax-grok --react

# เปิดใช้งานการตรวจสอบ TypeScript หลังขั้นตอนการวางแผน
ax-grok --verify

# ปิดการแก้ไขตัวเองเมื่อล้มเหลว
ax-grok --no-correction
```

โดยค่าเริ่มต้น การแก้ไขตัวเองเปิดอยู่ (เอเจนต์ลองใหม่โดยอัตโนมัติเมื่อล้มเหลวพร้อมการสะท้อน) ReAct และการตรวจสอบปิดโดยค่าเริ่มต้นแต่สามารถเปิดใช้งานเพื่อการให้เหตุผลที่มีโครงสร้างมากขึ้นและการตรวจสอบคุณภาพ

### คำสั่งหลัก

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `/init` | เริ่มต้นบริบทโปรเจกต์ |
| `/help` | แสดงคำสั่งทั้งหมด |
| `/model` | สลับโมเดล AI |
| `/lang` | เปลี่ยนภาษาแสดงผล (11 ภาษา) |
| `/doctor` | รันการวินิจฉัย |
| `/exit` | ออกจาก CLI |

### แป้นพิมพ์ลัด

| ทางลัด | การกระทำ | คำอธิบาย |
|--------|----------|----------|
| `Ctrl+O` | สลับความละเอียด | แสดงหรือซ่อนบันทึกโดยละเอียดและกระบวนการภายใน |
| `Ctrl+K` | การกระทำด่วน | เปิดเมนูการกระทำด่วนสำหรับคำสั่งทั่วไป |
| `Ctrl+B` | โหมดพื้นหลัง | รันงานปัจจุบันในพื้นหลัง |
| `Shift+Tab` | แก้ไขอัตโนมัติ | ทริกเกอร์คำแนะนำโค้ดที่ขับเคลื่อนด้วย AI |
| `Esc` ×2 | ยกเลิก | ล้างอินพุตปัจจุบันหรือยกเลิกการดำเนินการที่กำลังดำเนินอยู่ |

---

## การตั้งค่า

### ไฟล์การตั้งค่า

| ไฟล์ | วัตถุประสงค์ |
|------|--------------|
| `~/.ax-grok/config.json` | การตั้งค่าผู้ใช้ (API key ที่เข้ารหัส) |
| `.ax-grok/settings.json` | การแทนที่โปรเจกต์ |
| `.ax-grok/CUSTOM.md` | คำแนะนำ AI ที่กำหนดเอง |
| `ax.index.json` | ดัชนีโปรเจกต์ที่ใช้ร่วมกัน (ที่ root, ใช้โดย CLI ทั้งหมด) |

### ตัวแปรสภาพแวดล้อม

```bash
# สำหรับ CI/CD
export XAI_API_KEY=your_key
```

---

## การรวม MCP

ขยายความสามารถด้วย [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — มาตรฐานเปิดสำหรับเชื่อมต่อผู้ช่วย AI กับเครื่องมือภายนอก, API และแหล่งข้อมูล:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**เทมเพลตที่มีอยู่:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive และอื่นๆ

---

## ส่วนขยาย VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- แผงแชทแถบด้านข้าง
- ดูตัวอย่าง diff สำหรับการเปลี่ยนแปลงไฟล์
- คำสั่งที่รับรู้บริบท
- ระบบ checkpoint และย้อนกลับ

---

## การรวม AutomatosX

AX CLI รวมกับ [AutomatosX](https://github.com/defai-digital/automatosx) - ระบบ AI หลายเอเจนต์พร้อมการแก้ไขบั๊กอัตโนมัติ, การรีแฟคเตอร์อัจฉริยะ และ 20+ เอเจนต์เฉพาะทาง

ในโหมดโต้ตอบ (`ax-grok`) เพียงถามอย่างเป็นธรรมชาติ:

```
> กรุณาสแกนและแก้ไขบั๊กใน codebase นี้

> รีแฟคเตอร์โมดูลการยืนยันตัวตน โฟกัสที่การลบโค้ดที่ไม่ใช้

> ใช้เอเจนต์ความปลอดภัยตรวจสอบ API endpoints
```

**สิ่งที่คุณได้รับ:**
- **แก้ไขบั๊ก**: ตรวจจับการรั่วไหลของตัวจับเวลา, การทำความสะอาดที่ขาดหาย, ปัญหาทรัพยากร - แก้ไขอัตโนมัติพร้อมความปลอดภัยในการย้อนกลับ
- **รีแฟคเตอร์**: ลบโค้ดที่ไม่ใช้, แก้ไขความปลอดภัยของประเภท, ลดความซับซ้อน - ตรวจสอบโดยการตรวจสอบประเภท
- **20+ เอเจนต์**: Backend, frontend, ความปลอดภัย, สถาปัตยกรรม, DevOps, ข้อมูล และอื่นๆ

---

## หน่วยความจำโปรเจกต์

ลดค่าใช้จ่าย Token และปรับปรุงการเรียกคืนบริบทด้วยแคชอัจฉริยะที่จัดเก็บและเรียกคืนข้อมูลโปรเจกต์ที่เกี่ยวข้อง หลีกเลี่ยงการประมวลผลซ้ำซ้อน

```bash
ax-grok memory warmup    # สร้างแคชบริบท
ax-grok memory status    # ดูการกระจาย Token
```

---

## ความปลอดภัย

- **การเข้ารหัส API Key:** AES-256-GCM พร้อม PBKDF2 (600K รอบ)
- **ไม่มี Telemetry:** ไม่เก็บข้อมูลใดๆ
- **การป้องกัน CVSS:** การป้องกันที่แข็งแกร่งต่อช่องโหว่ทั่วไปเช่น Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) และ SSRF (CVSS 7.5)

---

## สถาปัตยกรรม

AX CLI ใช้สถาปัตยกรรมแบบโมดูลาร์พร้อม CLI เฉพาะของผู้ให้บริการที่สร้างบนแกนร่วม:

```
┌─────────────────────────────────────────────────────────────┐
│                    การติดตั้งผู้ใช้                           │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • การให้เหตุผลขยาย Grok 3                                   │
│  • ค่าเริ่มต้น API xAI                                       │
│  • ค้นหาเว็บแบบเรียลไทม์                                      │
│  • การตั้งค่า ~/.ax-grok/                                    │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  ฟังก์ชันร่วม: 17 เครื่องมือ, MCP client, หน่วยความจำ,       │
│  checkpoint, React/Ink UI, การดำเนินการไฟล์, รองรับ git     │
└─────────────────────────────────────────────────────────────┘
```

---

## แพ็คเกจ

| แพ็คเกจ | ติดตั้ง? | คำอธิบาย |
|---------|:--------:|----------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **ใช่** | CLI ที่ปรับแต่งสำหรับ Grok พร้อมค้นหาเว็บ, วิชั่น, การคิดขยาย |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | เลือกได้ | CLI local-first สำหรับ Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | ไม่ | ไลบรารีแกนร่วม (ติดตั้งอัตโนมัติเป็น dependency) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | ไม่ | Schemas Zod ร่วม (ติดตั้งอัตโนมัติเป็น dependency) |

> **หมายเหตุ:** ax-glm ถูกยกเลิกเพื่อสนับสนุน [OpenCode CLI](https://opencode.ai) อย่างเป็นทางการของ Z.AI

---

## สิทธิ์การใช้งาน

สิทธิ์การใช้งาน MIT - ดู [LICENSE](LICENSE)

---

<p align="center">
  สร้างด้วยความรักโดย <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
