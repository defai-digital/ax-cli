# AX CLI - Vibe Coding cấp Doanh Nghiệp

> 📖 Bản dịch này dựa trên [README.md @ v5.1.19](./README.md)

[![downloads](https://img.shields.io/npm/dt/@defai.digital/automatosx?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-6,205+%20passing-brightgreen.svg)](#)
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

- [Khởi động nhanh](#khởi-động-nhanh)
- [Người dùng GLM](#người-dùng-glm)
- [Vì sao AX CLI?](#vì-sao-ax-cli)
- [Mô hình hỗ trợ](#mô-hình-hỗ-trợ)
- [Cài đặt](#cài-đặt)
- [Sử dụng](#sử-dụng)
- [Cấu hình](#cấu-hình)
- [Tích hợp MCP](#tích-hợp-mcp)
- [Tiện ích VSCode](#tiện-ích-vscode)
- [Tích hợp AutomatosX](#tích-hợp-automatosx)
- [Bộ nhớ dự án](#bộ-nhớ-dự-án)
- [Bảo mật](#bảo-mật)
- [Kiến trúc](#kiến-trúc)
- [Gói](#gói)
- [Changelog](#changelog)
- [Tài liệu](#tài-liệu)
- [Enterprise](#enterprise)

---

## Khởi động nhanh

Bắt đầu trong chưa đầy một phút:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Phù hợp nhất cho:** tìm kiếm web trực tiếp, vision, suy luận mở rộng, cửa sổ ngữ cảnh 2M

Chạy `/init` trong CLI để khởi tạo ngữ cảnh dự án.

---

## Người dùng GLM

> **Lưu ý:** gói đám mây `ax-glm` đã bị ngừng.
>
> **Để truy cập GLM cloud API, chúng tôi khuyến nghị dùng [OpenCode](https://opencode.ai).**

**Các mô hình GLM cục bộ** (GLM-4.6, CodeGeeX4) vẫn được hỗ trợ đầy đủ qua `ax-cli` để suy luận offline bằng Ollama, LMStudio hoặc vLLM. Xem [Mô hình cục bộ/offline](#mô-hình-cục-bộoffline-ax-cli) bên dưới.

---

## Vì sao AX CLI?

| Tính năng | Mô tả |
|---------|------|
| **Tối ưu theo nhà cung cấp** | Hỗ trợ hạng nhất cho Grok (xAI) với tham số riêng cho nhà cung cấp |
| **17 công cụ tích hợp** | Sửa file, chạy bash, tìm kiếm, todo và hơn thế nữa |
| **Hành vi agentic** | Vòng lặp ReAct, tự sửa khi thất bại, xác minh TypeScript |
| **Agent AutomatosX** | 20+ agent chuyên biệt cho backend, frontend, bảo mật, DevOps, ... |
| **Sửa lỗi tự động** | Quét và tự sửa rò rỉ timer, vấn đề tài nguyên, lỗi kiểu với an toàn rollback |
| **Refactor thông minh** | Loại bỏ code chết, sửa an toàn kiểu, giảm độ phức tạp có xác minh |
| **Tích hợp MCP** | Model Context Protocol với 12+ template sẵn sàng production |
| **Bộ nhớ dự án** | Cache ngữ cảnh thông minh tiết kiệm 50% token |
| **Bảo mật doanh nghiệp** | Mã hóa AES-256-GCM, không telemetry, bảo vệ theo CVSS |
| **65% độ phủ kiểm thử** | 6,205+ bài test với TypeScript nghiêm ngặt |

---

### Điểm nổi bật của Grok

- **Grok (ax-grok)**: tìm kiếm web tích hợp, vision, reasoning_effort; **các biến thể nhanh của Grok 4.1 có ngữ cảnh 2M, công cụ server song song, x_search và thực thi code phía server**. Xem `docs/grok-4.1-advanced-features.md` để biết chi tiết.

---

## Mô hình hỗ trợ

### Grok (xAI)

> **Grok 4.1 advanced**: ax-grok kích hoạt các công cụ agent phía server của Grok 4.1 (web_search, x_search, code_execution) với gọi hàm song song và biến thể nhanh ngữ cảnh 2M. Xem hướng dẫn đầy đủ tại `docs/grok-4.1-advanced-features.md`.

| Mô hình | Ngữ cảnh | Tính năng | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Mặc định cân bằng với suy luận, vision, tìm kiếm | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Tốt nhất cho phiên agentic/công cụ có suy luận | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Nhanh nhất không có suy luận mở rộng | `grok-fast-nr` |
| `grok-4-0709` | 131K | Bản phát hành Grok 4 gốc (tương thích) | `grok-4` |
| `grok-2-image-1212` | 32K | **Tạo ảnh**: từ văn bản sang ảnh | `grok-image` |

> **Alias mô hình**: dùng alias như `ax-grok -m grok-latest` thay vì tên đầy đủ.

### Mô hình cục bộ/offline (ax-cli)

Để suy luận cục bộ qua Ollama, LMStudio hoặc vLLM, dùng `ax-cli`:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Cấu hình URL máy chủ cục bộ
```

ax-cli hoạt động với **bất kỳ mô hình** nào có trên máy chủ cục bộ của bạn. Chỉ cần chỉ định tag mô hình khi cấu hình (ví dụ: `qwen3:14b`, `glm4:9b`).

**Các họ mô hình khuyến nghị:**

| Mô hình | Phù hợp nhất |
|-------|------------|
| **Qwen** | Tốt nhất tổng thể cho tác vụ coding |
| **GLM** | Refactor và tài liệu |
| **DeepSeek** | Lặp nhanh, cân bằng tốc độ/chất lượng |
| **Codestral** | C/C++/Rust và lập trình hệ thống |
| **Llama** | Tương thích tốt và dự phòng |

---

## Cài đặt

### Yêu cầu

- Node.js 24.0.0+
- macOS 14+, Windows 11+ hoặc Ubuntu 24.04+

### Cài đặt

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Thiết lập

```bash
ax-grok setup
```

Trình hướng dẫn thiết lập sẽ hỗ trợ:
1. Mã hóa và lưu khóa API an toàn (AES-256-GCM).
2. Cấu hình mô hình AI mặc định và các tuỳ chọn khác.
3. Xác thực cấu hình để đảm bảo mọi thứ đúng.

---

## Sử dụng

### Chế độ tương tác

```bash
ax-grok              # Bắt đầu phiên CLI tương tác
ax-grok --continue   # Tiếp tục cuộc trò chuyện trước
ax-grok -c           # Dạng rút gọn
```

### Chế độ headless

```bash
ax-grok -p "phân tích codebase này"
ax-grok -p "sửa lỗi TypeScript" -d /path/to/project
```

### Cờ hành vi agentic

```bash
# Bật chế độ ReAct (Suy nghĩ → Hành động → Quan sát)
ax-grok --react

# Bật xác minh TypeScript sau các pha lập kế hoạch
ax-grok --verify

# Tắt tự sửa khi thất bại
ax-grok --no-correction
```

Mặc định, tự sửa được BẬT (agent tự thử lại với phản tư). ReAct và xác minh mặc định TẮT nhưng có thể bật để suy luận có cấu trúc và kiểm tra chất lượng.

### Lệnh thiết yếu

| Lệnh | Mô tả |
|------|------|
| `/init` | Khởi tạo ngữ cảnh dự án |
| `/help` | Hiển thị tất cả lệnh |
| `/model` | Đổi mô hình AI |
| `/lang` | Đổi ngôn ngữ hiển thị (11 ngôn ngữ) |
| `/doctor` | Chạy chẩn đoán |
| `/exit` | Thoát CLI |

### Phím tắt

| Phím tắt | Hành động | Mô tả |
|---------|----------|------|
| `Ctrl+O` | Bật/tắt chi tiết | Hiển thị hoặc ẩn log chi tiết và quy trình nội bộ |
| `Ctrl+K` | Hành động nhanh | Mở menu hành động nhanh |
| `Ctrl+B` | Chế độ nền | Chạy tác vụ hiện tại ở nền |
| `Shift+Tab` | Tự chỉnh sửa | Kích hoạt gợi ý code bằng AI |
| `Esc` ×2 | Hủy | Xóa nhập liệu hoặc hủy thao tác |

---

## Cấu hình

### File cấu hình

| File | Mục đích |
|------|---------|
| `~/.ax-grok/config.json` | Cài đặt người dùng (khóa API đã mã hóa) |
| `.ax-grok/settings.json` | Ghi đè theo dự án |
| `.ax-grok/CUSTOM.md` | Chỉ dẫn AI tuỳ chỉnh |
| `ax.index.json` | Chỉ mục dự án dùng chung (ở gốc) |

### Biến môi trường

```bash
# Cho CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## Tích hợp MCP

Mở rộng khả năng với [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — tiêu chuẩn mở để kết nối trợ lý AI với công cụ bên ngoài, API và nguồn dữ liệu:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Template khả dụng:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive, v.v.

---

## Tiện ích VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Bảng chat ở thanh bên
- Xem trước diff cho thay đổi file
- Lệnh theo ngữ cảnh
- Hệ thống checkpoint & rewind

---

## Tích hợp AutomatosX

AX CLI tích hợp với [AutomatosX](https://github.com/defai-digital/automatosx) - hệ thống AI đa agent với tự động sửa bug, refactor thông minh và 20+ agent chuyên biệt.

Trong chế độ tương tác (`ax-grok`), chỉ cần hỏi tự nhiên:

```
> hãy quét và sửa lỗi trong codebase này

> refactor mô-đun xác thực, tập trung loại bỏ code chết

> dùng agent bảo mật để kiểm tra các endpoint API

> xem xét PRD này và làm việc với agent sản phẩm để cải thiện

> nhờ agent backend và frontend cùng triển khai đăng ký người dùng
```

**Bạn nhận được:**
- **Sửa lỗi**: Phát hiện rò rỉ timer, thiếu cleanup, vấn đề tài nguyên - tự sửa với an toàn rollback
- **Refactor**: Loại bỏ code chết, sửa an toàn kiểu, giảm độ phức tạp - xác minh bằng typecheck
- **20+ agent**: Backend, frontend, bảo mật, kiến trúc, DevOps, dữ liệu, ...

Xem [AutomatosX Guide](docs/AutomatosX-Integration.md) để biết danh sách agent, tuỳ chọn nâng cao và cấu hình

---

## Bộ nhớ dự án

Giảm chi phí token và cải thiện khả năng nhớ ngữ cảnh bằng cache thông minh lưu trữ và truy xuất thông tin dự án liên quan, tránh xử lý lặp.

```bash
ax-grok memory warmup    # Tạo cache ngữ cảnh
ax-grok memory status    # Xem phân bố token
```

---

## Bảo mật

- **Mã hóa khóa API:** AES-256-GCM với PBKDF2 (600K vòng lặp)
- **Không telemetry:** Không thu thập dữ liệu
- **Bảo vệ CVSS:** Bảo vệ mạnh trước các lỗ hổng phổ biến như Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) và SSRF (CVSS 7.5).

---

## Kiến trúc

AX CLI dùng kiến trúc mô-đun với các CLI theo nhà cung cấp dựa trên lõi chung:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 suy luận mở rộng                                  │
│  • xAI API defaults                                         │
│  • Tìm kiếm web trực tiếp                                   │
│  • ~/.ax-grok/ cấu hình                                      │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Chia sẻ chức năng: 17 công cụ, MCP client, bộ nhớ,          │
│  checkpoints, UI React/Ink, thao tác file, hỗ trợ git        │
└─────────────────────────────────────────────────────────────┘
```

---

## Gói

| Gói | Cài? | Mô tả |
|-----|:---:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Có** | CLI tối ưu cho Grok với tìm kiếm web, vision, suy nghĩ mở rộng |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Tùy chọn | CLI ưu tiên local cho Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Không | Thư viện lõi dùng chung (tự cài như dependency) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Không | Zod schema dùng chung (tự cài như dependency) |

> **Người dùng GLM Cloud:** Với GLM cloud API, chúng tôi khuyến nghị [OpenCode](https://opencode.ai).

---

## Changelog

| Phiên bản | Điểm nổi bật |
|----------|-------------|
| **v5.1.19** | Hiệu năng: phân tích phụ thuộc O(N×M) → O(N+M), tối ưu loại bỏ cache, sửa lỗi UI |
| **v5.1.18** | Refactor: hằng số có tên, thống nhất tên biến, 6,205 bài test qua |
| **v5.1.17** | Sửa: lỗi hủy ESC, rò rỉ timer, xử lý timeout MCP |

[Xem changelog đầy đủ trên GitHub →](https://github.com/defai-digital/ax-cli/releases)

---

## Tài liệu

- [Tính năng](docs/features.md)
- [Cấu hình](docs/configuration.md)
- [Tham chiếu CLI](docs/cli-reference.md)
- [Tích hợp MCP](docs/mcp.md)
- [Hướng dẫn AutomatosX](docs/AutomatosX-Integration.md)
- [Hướng dẫn VSCode](docs/vscode-integration-guide.md)
- [Tích hợp Figma](docs/figma-guide.md)
- [Khắc phục sự cố](docs/troubleshooting.md)

---

## Enterprise

Dành cho các đội ngũ cần khả năng nâng cao:

- Báo cáo tuân thủ (SOC2, HIPAA)
- Ghi log kiểm toán nâng cao
- Tích hợp SSO/SAML
- Hỗ trợ ưu tiên (SLA 24 giờ)

Liên hệ: **sales@defai.digital**

---

## Giấy phép

Giấy phép MIT - xem [LICENSE](LICENSE)

---

<p align="center">
  Làm với ❤️ bởi <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
