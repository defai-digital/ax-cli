# AX CLI - Công cụ Lập trình AI Cấp Doanh nghiệp

> 📖 Bản dịch này dựa trên [README.md @ v5.1.9](./README.md)

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

## Mục lục

- [Người dùng GLM](#người-dùng-glm)
- [Bắt đầu Nhanh](#bắt-đầu-nhanh)
- [Tại sao AX CLI?](#tại-sao-ax-cli)
- [Các Mô hình Được Hỗ trợ](#các-mô-hình-được-hỗ-trợ)
- [Cài đặt](#cài-đặt)
- [Sử dụng](#sử-dụng)
- [Cấu hình](#cấu-hình)
- [Tích hợp MCP](#tích-hợp-mcp)
- [Tiện ích VSCode](#tiện-ích-vscode)
- [Tích hợp AutomatosX](#tích-hợp-automatosx)
- [Bộ nhớ Dự án](#bộ-nhớ-dự-án)
- [Bảo mật](#bảo-mật)
- [Kiến trúc](#kiến-trúc)
- [Các Gói](#các-gói)

---

## Người dùng GLM

> **Quan trọng:** Gói ax-glm cloud đã ngừng hỗ trợ. Để truy cập API cloud GLM, chúng tôi khuyến nghị sử dụng OpenCode. Bắt đầu với OpenCode: https://opencode.ai.
>
> **Lưu ý:** Các mô hình GLM cục bộ (GLM-4.6, CodeGeeX4) vẫn được hỗ trợ đầy đủ thông qua `ax-cli` để suy luận ngoại tuyến qua Ollama, LMStudio hoặc vLLM. Xem phần [Mô hình Cục bộ/Ngoại tuyến](#mô-hình-cục-bộngoại-tuyến-ax-cli) bên dưới.

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Trợ lý lập trình AI cấp doanh nghiệp được tối ưu hóa cho Grok</strong>
</p>

## Bắt đầu Nhanh

Bắt đầu trong vòng chưa đầy một phút:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Tốt nhất cho:** Tìm kiếm web trực tiếp, thị giác, suy luận mở rộng

Chạy `/init` trong CLI để khởi tạo ngữ cảnh dự án của bạn.

> **Người dùng GLM:** Vui lòng sử dụng [OpenCode CLI](https://opencode.ai) thay vì ax-glm.

---

## Tại sao AX CLI?

| Tính năng | Mô tả |
|-----------|-------|
| **Tối ưu hóa theo Nhà cung cấp** | Hỗ trợ hàng đầu cho Grok (xAI) với các tham số riêng của nhà cung cấp |
| **17 Công cụ Tích hợp** | Chỉnh sửa tệp, thực thi bash, tìm kiếm, todos và nhiều hơn nữa |
| **Hành vi Tác nhân** | Vòng lặp suy luận ReAct, tự sửa lỗi khi thất bại, xác minh TypeScript |
| **Tác nhân AutomatosX** | 20+ tác nhân AI chuyên biệt cho backend, frontend, bảo mật, DevOps và nhiều hơn nữa |
| **Sửa lỗi Tự động** | Quét và tự động sửa rò rỉ bộ đếm thời gian, vấn đề tài nguyên, lỗi kiểu với an toàn rollback |
| **Tái cấu trúc Thông minh** | Loại bỏ mã chết, sửa an toàn kiểu, giảm độ phức tạp với xác minh |
| **Tích hợp MCP** | Model Context Protocol với 12+ mẫu sẵn sàng sản xuất |
| **Bộ nhớ Dự án** | Bộ nhớ đệm ngữ cảnh thông minh với tiết kiệm 50% token |
| **Bảo mật Doanh nghiệp** | Mã hóa AES-256-GCM, không có telemetry, bảo vệ đánh giá CVSS |
| **65% Độ phủ Test** | 6.084+ bài test với TypeScript nghiêm ngặt |

---

### Điểm nổi bật của Grok

- **Grok (ax-grok)**: Tìm kiếm web tích hợp, thị giác, reasoning_effort; **Các biến thể nhanh Grok 4.1 bao gồm ngữ cảnh 2M, công cụ máy chủ song song, x_search và thực thi mã phía máy chủ**.
- CLI chia sẻ cùng chuỗi công cụ (chỉnh sửa tệp, MCP, bash) và bộ nhớ dự án với lõi chung.

---

## Các Mô hình Được Hỗ trợ

### Grok (xAI)

| Mô hình | Ngữ cảnh | Tính năng | Bí danh |
|---------|----------|-----------|---------|
| `grok-4.1` | 131K | Mặc định cân bằng với suy luận, thị giác, tìm kiếm tích hợp | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Tốt nhất cho các phiên tác nhân/nặng công cụ với suy luận | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Chạy tác nhân nhanh nhất không có suy luận mở rộng | `grok-fast-nr` |
| `grok-4-0709` | 131K | Phiên bản Grok 4 gốc (tương thích) | `grok-4` |
| `grok-2-image-1212` | 32K | **Tạo hình ảnh**: Văn bản thành hình ảnh | `grok-image` |

> **Bí danh Mô hình**: Sử dụng bí danh tiện lợi như `ax-grok -m grok-latest` thay vì tên mô hình đầy đủ.

---

## Cài đặt

### Yêu cầu

- Node.js 24.0.0+
- macOS 14+, Windows 11+ hoặc Ubuntu 24.04+

### Lệnh Cài đặt

```bash
npm install -g @defai.digital/ax-grok
```

### Thiết lập

```bash
ax-grok setup
```

Trình hướng dẫn thiết lập sẽ hướng dẫn bạn qua:
1. Mã hóa và lưu trữ khóa API của bạn một cách an toàn (sử dụng mã hóa AES-256-GCM)
2. Cấu hình mô hình AI mặc định và các tùy chọn khác
3. Xác thực cấu hình của bạn để đảm bảo mọi thứ được thiết lập đúng

---

## Sử dụng

### Chế độ Tương tác

```bash
ax-grok              # Bắt đầu phiên CLI tương tác
ax-grok --continue   # Tiếp tục cuộc trò chuyện trước
ax-grok -c           # Dạng ngắn
```

### Chế độ Headless

```bash
ax-grok -p "phân tích codebase này"
ax-grok -p "sửa lỗi TypeScript" -d /đường/dẫn/đến/dự-án
```

### Cờ Hành vi Tác nhân

```bash
# Bật chế độ suy luận ReAct (chu kỳ Suy nghĩ → Hành động → Quan sát)
ax-grok --react

# Bật xác minh TypeScript sau các giai đoạn lập kế hoạch
ax-grok --verify

# Tắt tự sửa lỗi khi thất bại
ax-grok --no-correction
```

Theo mặc định, tự sửa lỗi được BẬT (tác nhân tự động thử lại khi thất bại với phản ánh). ReAct và xác minh được TẮT theo mặc định nhưng có thể được bật để suy luận có cấu trúc hơn và kiểm tra chất lượng.

### Các Lệnh Thiết yếu

| Lệnh | Mô tả |
|------|-------|
| `/init` | Khởi tạo ngữ cảnh dự án |
| `/help` | Hiển thị tất cả các lệnh |
| `/model` | Chuyển đổi mô hình AI |
| `/lang` | Thay đổi ngôn ngữ hiển thị (11 ngôn ngữ) |
| `/doctor` | Chạy chẩn đoán |
| `/exit` | Thoát CLI |

### Phím Tắt

| Phím tắt | Hành động | Mô tả |
|----------|-----------|-------|
| `Ctrl+O` | Chuyển đổi chi tiết | Hiển thị hoặc ẩn log chi tiết và quy trình nội bộ |
| `Ctrl+K` | Hành động nhanh | Mở menu hành động nhanh cho các lệnh thông dụng |
| `Ctrl+B` | Chế độ nền | Chạy tác vụ hiện tại ở chế độ nền |
| `Shift+Tab` | Tự động chỉnh sửa | Kích hoạt gợi ý mã được hỗ trợ bởi AI |
| `Esc` ×2 | Hủy | Xóa đầu vào hiện tại hoặc hủy thao tác đang diễn ra |

---

## Cấu hình

### Tệp Cấu hình

| Tệp | Mục đích |
|-----|----------|
| `~/.ax-grok/config.json` | Cài đặt người dùng (khóa API được mã hóa) |
| `.ax-grok/settings.json` | Ghi đè dự án |
| `.ax-grok/CUSTOM.md` | Hướng dẫn AI tùy chỉnh |
| `ax.index.json` | Chỉ mục dự án chia sẻ (tại root, được sử dụng bởi tất cả CLI) |

### Biến Môi trường

```bash
# Cho CI/CD
export XAI_API_KEY=your_key
```

---

## Tích hợp MCP

Mở rộng khả năng với [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — một tiêu chuẩn mở để kết nối trợ lý AI với các công cụ bên ngoài, API và nguồn dữ liệu:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Các Mẫu Có sẵn:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive và nhiều hơn nữa.

---

## Tiện ích VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Bảng chat thanh bên
- Xem trước diff cho thay đổi tệp
- Lệnh nhận biết ngữ cảnh
- Hệ thống checkpoint và quay lại

---

## Tích hợp AutomatosX

AX CLI tích hợp với [AutomatosX](https://github.com/defai-digital/automatosx) - một hệ thống AI đa tác nhân với sửa lỗi tự động, tái cấu trúc thông minh và 20+ tác nhân chuyên biệt.

Trong chế độ tương tác (`ax-grok`), chỉ cần hỏi một cách tự nhiên:

```
> vui lòng quét và sửa lỗi trong codebase này

> tái cấu trúc module xác thực, tập trung vào loại bỏ mã chết

> sử dụng tác nhân bảo mật để kiểm tra các endpoint API
```

**Những gì bạn nhận được:**
- **Sửa lỗi**: Phát hiện rò rỉ bộ đếm thời gian, dọn dẹp bị thiếu, vấn đề tài nguyên - tự động sửa với an toàn rollback
- **Tái cấu trúc**: Loại bỏ mã chết, sửa an toàn kiểu, giảm độ phức tạp - được xác minh bởi kiểm tra kiểu
- **20+ tác nhân**: Backend, frontend, bảo mật, kiến trúc, DevOps, dữ liệu và nhiều hơn nữa

---

## Bộ nhớ Dự án

Giảm chi phí token và cải thiện khả năng nhớ ngữ cảnh với bộ nhớ đệm thông minh lưu trữ và truy xuất thông tin dự án liên quan, tránh xử lý dư thừa.

```bash
ax-grok memory warmup    # Tạo bộ nhớ đệm ngữ cảnh
ax-grok memory status    # Xem phân phối token
```

---

## Bảo mật

- **Mã hóa Khóa API:** AES-256-GCM với PBKDF2 (600K lần lặp)
- **Không Telemetry:** Không thu thập dữ liệu
- **Bảo vệ CVSS:** Các biện pháp bảo vệ mạnh mẽ chống lại các lỗ hổng phổ biến như Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) và SSRF (CVSS 7.5)

---

## Kiến trúc

AX CLI sử dụng kiến trúc modular với các CLI riêng cho từng nhà cung cấp được xây dựng trên một lõi chia sẻ:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cài đặt Người dùng                        │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • Suy luận mở rộng Grok 3                                  │
│  • Mặc định API xAI                                         │
│  • Tìm kiếm web trực tiếp                                   │
│  • Cấu hình ~/.ax-grok/                                     │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Chức năng chia sẻ: 17 công cụ, MCP client, bộ nhớ,         │
│  checkpoint, React/Ink UI, thao tác tệp, hỗ trợ git         │
└─────────────────────────────────────────────────────────────┘
```

---

## Các Gói

| Gói | Cài đặt? | Mô tả |
|-----|:--------:|-------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Có** | CLI tối ưu cho Grok với tìm kiếm web, thị giác, suy nghĩ mở rộng |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Tùy chọn | CLI local-first cho Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Không | Thư viện lõi chia sẻ (tự động cài đặt như dependency) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Không | Schemas Zod chia sẻ (tự động cài đặt như dependency) |

> **Lưu ý:** ax-glm đã ngừng hỗ trợ. Vui lòng sử dụng [OpenCode CLI](https://opencode.ai).

---

## Giấy phép

Giấy phép MIT - xem [LICENSE](LICENSE)

---

<p align="center">
  Được tạo với tình yêu bởi <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
