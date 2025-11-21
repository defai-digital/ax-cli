# ax-cli「專案記憶（Project Memory）」功能 PRD v2.0

> **版本**: 2.0 (修訂版 - 基於 z.ai GLM-4.6 隱式快取機制)
> **日期**: 2025-11-21
> **狀態**: Draft

---

## 1. 功能概要（Feature Overview）

**功能名稱**：Project Memory（專案記憶）
**CLI 模組**：`ax memory`
**目標**：
透過 z.ai GLM-4.6 的**隱式快取（Implicit Caching）**能力，為單一專案建立可重用的「長期上下文」，降低每次請求的 token 消耗，提升：

* 深度任務（`ax plan` / `ax think` / `ax spec`）的上下文一致性
* Token 成本（快取 token 享 50% 折扣）
* 回應速度（重複內容無需重新計算）
* 大型 repo 上的可靠性與可預測性

---

## 2. 關鍵技術約束（Technical Constraints）

### 2.1 z.ai GLM-4.6 快取機制

根據 z.ai 官方文檔，GLM-4.6 的快取是**完全隱式的**：

| 特性 | 說明 |
|------|------|
| 快取建立 | **自動** - 無需呼叫任何 API |
| cache_id | **不存在** - 無法取得或儲存 |
| 快取觸發 | 相同 message prefix → 自動快取 |
| 快取計費 | `usage.prompt_tokens_details.cached_tokens` 顯示 |
| 折扣 | 快取 token 約 50% off |
| TTL | 有時效，但未公開具體時長 |

### 2.2 設計原則

由於無法顯式管理快取，Project Memory 的設計改為：

1. **本地儲存標準化上下文** - 而非儲存 cache_id
2. **一致的 prompt prefix** - 確保 z.ai 能偵測到相同內容
3. **內容雜湊追蹤** - 偵測專案變更，提示使用者 refresh

---

## 3. `ax init` vs `ax memory warmup` 職責切分

### 3.1 `ax init` - 專案配置層

**定位**：讓 repo「接上 ax-cli」的初始化（類似 `git init`）

**職責**：
- ✅ 建立 `.ax-cli/config.json`（模型、溫度、ignore patterns）
- ✅ 產生 `.ax-cli/CUSTOM.md`（專案特定指令）
- ✅ 產生 `.ax-cli/index.json`（專案 metadata）
- ✅ 互動式問答（選模型、選語言）
- ❌ **不**掃描專案產生記憶上下文
- ❌ **不**建立 `.ax-cli/memory.json`

### 3.2 `ax memory warmup` - 記憶 / 快取層

**定位**：把專案內容「餵飽 GLM 的長期記憶」

**職責**：
- ✅ 讀取 `.ax-cli/config.json` 的 ignore patterns
- ✅ 掃描專案結構、README、關鍵設定檔
- ✅ 產生標準化 context string
- ✅ 寫入 `.ax-cli/memory.json`
- ❌ **不**呼叫任何快取 API（z.ai 無此功能）
- ❌ **不**修改 `.ax-cli/config.json`

---

## 4. 資料結構設計

### 4.1 `.ax-cli/memory.json` Schema

```typescript
interface ProjectMemory {
  /** Schema 版本，用於未來遷移 */
  version: 1;

  /** 建立時間 (ISO 8601) */
  created_at: string;

  /** 最後更新時間 (ISO 8601) */
  updated_at: string;

  /** 專案根目錄絕對路徑 */
  project_root: string;

  /** context 內容的 SHA-256 雜湊，用於變更偵測 */
  content_hash: string;

  /** 掃描設定 */
  source: {
    /** 掃描的目錄設定 */
    directories: Array<{
      path: string;
      max_depth: number;
    }>;

    /** 額外納入的檔案 (相對路徑) */
    files: string[];

    /** 排除的 patterns (glob) */
    ignore: string[];
  };

  /** 產生的上下文內容 */
  context: {
    /** 格式化後的完整上下文字串 */
    formatted: string;

    /** 預估 token 數 */
    token_estimate: number;

    /** 各區塊的 token 分佈 */
    sections: {
      structure?: number;      // 目錄結構
      readme?: number;         // README 摘要
      config?: number;         // 設定檔摘要
      patterns?: number;       // 程式碼模式
    };
  };

  /** 快取統計（從 API response 收集） */
  stats?: {
    /** 最近一次使用時的 cached_tokens */
    last_cached_tokens?: number;

    /** 最近一次使用時的 prompt_tokens */
    last_prompt_tokens?: number;

    /** 累計節省的 tokens */
    total_tokens_saved?: number;

    /** 使用次數 */
    usage_count?: number;
  };
}
```

### 4.2 Zod Schema

```typescript
import { z } from 'zod';

export const ProjectMemorySchema = z.object({
  version: z.literal(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  project_root: z.string(),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source: z.object({
    directories: z.array(z.object({
      path: z.string(),
      max_depth: z.number().int().min(1).max(10),
    })),
    files: z.array(z.string()),
    ignore: z.array(z.string()),
  }),
  context: z.object({
    formatted: z.string(),
    token_estimate: z.number().int().min(0),
    sections: z.object({
      structure: z.number().int().optional(),
      readme: z.number().int().optional(),
      config: z.number().int().optional(),
      patterns: z.number().int().optional(),
    }),
  }),
  stats: z.object({
    last_cached_tokens: z.number().int().optional(),
    last_prompt_tokens: z.number().int().optional(),
    total_tokens_saved: z.number().int().optional(),
    usage_count: z.number().int().optional(),
  }).optional(),
});

export type ProjectMemory = z.infer<typeof ProjectMemorySchema>;
```

---

## 5. CLI 介面設計

### 5.1 `ax memory warmup`

**用途**：初次對專案建立 Project Memory

```bash
ax memory warmup [options]

Options:
  -d, --depth <n>      目錄掃描深度 (default: 3)
  -v, --verbose        顯示詳細掃描過程
  --dry-run            預覽產生的內容，不寫入檔案
  --max-tokens <n>     context 最大 token 數 (default: 8000)
```

**行為流程**：

```
1. 檢查 .ax-cli/config.json 是否存在
   └─ 若無 → 提示先執行 ax init

2. 讀取 ignore patterns（從 config.json 或預設值）

3. 掃描專案內容：
   ├─ 目錄結構（tree 格式，深度限制）
   ├─ README.md / docs/*.md（摘要，每檔 max 4KB）
   ├─ 設定檔：package.json, tsconfig.json, docker-compose*
   └─ 偵測的程式碼模式（從現有 ProjectAnalyzer）

4. 組裝標準化 context string：
   # Project: {name}

   ## Directory Structure
   {tree}

   ## Key Configuration
   {config summaries}

   ## Architecture Patterns
   {detected patterns}

   ## Development Conventions
   {conventions from ProjectAnalyzer}

5. 計算 content_hash (SHA-256)

6. 估算 token 數

7. 寫入 .ax-cli/memory.json

8. 輸出成功訊息：
   ✓ Project memory created
     Context: ~{N} tokens
     Files scanned: {M}

   💡 This context will be automatically included in ax plan/think/spec
```

**輸出範例**：

```
✓ Project memory created (2,847 tokens)

📊 Context breakdown:
   Structure:    892 tokens (31%)
   README:       634 tokens (22%)
   Config:       521 tokens (18%)
   Patterns:     800 tokens (28%)

💡 Run `ax plan` or `ax think` to use this context
   z.ai will automatically cache identical content
```

---

### 5.2 `ax memory refresh`

**用途**：專案變更後更新 Project Memory

```bash
ax memory refresh [options]

Options:
  -v, --verbose        顯示變更細節
  --force              強制重新產生（即使無變更）
```

**行為流程**：

```
1. 讀取現有 .ax-cli/memory.json
   └─ 若不存在 → 提示執行 ax memory warmup

2. 重新掃描專案內容

3. 計算新的 content_hash

4. 比較雜湊：
   ├─ 相同 → 顯示 "No changes detected" (除非 --force)
   └─ 不同 → 更新 memory.json

5. 輸出變更摘要
```

**輸出範例**：

```
🔄 Refreshing project memory...

Changes detected:
  + src/new-feature/     (new directory)
  ~ package.json         (dependencies updated)
  - src/deprecated.ts    (removed)

✓ Project memory updated
   Previous: 2,847 tokens
   Current:  3,102 tokens (+255)
```

---

### 5.3 `ax memory status`

**用途**：查看當前專案的記憶狀態

```bash
ax memory status [options]

Options:
  -v, --verbose        顯示完整 context 內容
  --json               輸出 JSON 格式
```

**輸出範例**：

```
📦 Project Memory Status

   Created:     2025-11-21 10:30:00
   Updated:     2025-11-21 14:15:00
   Context:     3,102 tokens
   Hash:        sha256:abc123...

📊 Token Distribution:
   ████████████░░░░░░░░  Structure  (31%)
   ███████░░░░░░░░░░░░░  README     (22%)
   █████░░░░░░░░░░░░░░░  Config     (18%)
   ████████░░░░░░░░░░░░  Patterns   (28%)

📈 Cache Statistics (last 7 days):
   Usage count:     47
   Avg cache rate:  78%
   Tokens saved:    ~89,000
   Est. savings:    $0.45
```

---

### 5.4 `ax memory clear`

**用途**：清除本地記憶設定

```bash
ax memory clear [options]

Options:
  -y, --yes            跳過確認提示
```

**行為**：
- 刪除 `.ax-cli/memory.json`
- 不影響 `.ax-cli/config.json` 或 `CUSTOM.md`

---

### 5.5 `ax memory stats`

**用途**：顯示快取效益統計

```bash
ax memory stats [options]

Options:
  --days <n>           統計區間 (default: 7)
  --json               輸出 JSON 格式
```

**輸出範例**：

```
📈 Cache Efficiency Report (Last 7 Days)

   Total API calls:        47
   Calls with cache hit:   42 (89%)

   Tokens:
     Prompt tokens:        156,000
     Cached tokens:        122,000 (78%)
     Output tokens:        45,000

   Estimated savings:      $0.61 (vs no caching)
```

---

## 6. 與其他命令的整合

### 6.1 自動附帶 Memory Context

當執行以下命令時：
- `ax plan ...`
- `ax spec ...`
- `ax think ...`
- `ax` (interactive mode)

**整合流程**：

```typescript
// agent/index.ts 或類似位置
async function buildSystemPrompt(): Promise<string> {
  const basePrompt = await loadCustomInstructions(); // CUSTOM.md
  const memoryContext = await loadProjectMemory();   // memory.json

  if (memoryContext) {
    // 將 memory context 作為 system prompt 的固定 prefix
    // z.ai 會自動偵測相同 prefix 並快取
    return `${memoryContext.context.formatted}\n\n---\n\n${basePrompt}`;
  }

  return basePrompt;
}
```

### 6.2 快取統計收集

每次 API 呼叫後，更新 memory.json 的 stats：

```typescript
// 在 LLMClient 或 agent 層
async function onApiResponse(response: LLMResponse): Promise<void> {
  const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens;

  if (cachedTokens !== undefined && cachedTokens > 0) {
    await updateMemoryStats({
      last_cached_tokens: cachedTokens,
      last_prompt_tokens: response.usage?.prompt_tokens,
      usage_count: (currentStats?.usage_count ?? 0) + 1,
      total_tokens_saved: (currentStats?.total_tokens_saved ?? 0) + cachedTokens,
    });
  }
}
```

### 6.3 變更偵測提醒

若偵測到大量檔案變更，提示使用者 refresh：

```typescript
// 在 ax plan/think/spec 執行前
async function checkMemoryFreshness(): Promise<void> {
  const memory = await loadProjectMemory();
  if (!memory) return;

  // 快速檢查關鍵檔案的 mtime
  const keyFilesChanged = await detectKeyFileChanges(memory);

  if (keyFilesChanged) {
    console.warn('⚠️  Project files may have changed since last memory warmup');
    console.warn('   Consider running: ax memory refresh');
  }
}
```

### 6.4 手動覆寫

提供旗標讓使用者控制：

```bash
# 強制不使用 project memory
ax plan "..." --no-memory

# 顯示詳細的快取資訊
ax plan "..." --verbose
# Output: cached_tokens: 2,500 / prompt_tokens: 3,200 (78% cache hit)
```

---

## 7. 成功指標（KPIs）

### 7.1 效能指標

| 指標 | 目標 | 測量方式 |
|------|------|---------|
| 快取命中率 | ≥ 70% | `cached_tokens / prompt_tokens` |
| Token 節省 | ≥ 30% | 比較有/無 memory 的 token 消耗 |
| warmup 時間 | < 5s | 中型專案（< 5k 檔案）|
| context size | ≤ 8k tokens | 預設上限，可調整 |

### 7.2 使用者指標

| 指標 | 目標 | 測量方式 |
|------|------|---------|
| 採用率 | ≥ 60% | 有 memory.json 的專案比例 |
| refresh 頻率 | ~1x/week | 平均 refresh 間隔 |
| 滿意度 | ≥ 4/5 | 使用者回饋 |

---

## 8. 風險與對策

| 風險 | 對策 |
|------|------|
| context 過大導致 token 超限 | 預設 8k 上限，可配置；自動截斷低優先區塊 |
| 專案變更未 refresh | mtime 偵測 + 提醒機制 |
| z.ai 快取機制變更 | version 欄位控管，必要時遷移 schema |
| memory.json 意外刪除 | 僅為優化，不影響核心功能；可隨時 warmup 重建 |
| 隱式快取不可靠 | 監控 cached_tokens，若持續為 0 則告警 |

---

## 9. 排除範圍（Out of Scope - v1）

- ❌ 跨 repo 共用記憶
- ❌ 檔案層級增量更新（僅支援全量 refresh）
- ❌ 記憶版本歷史 / 回滾
- ❌ 雲端同步記憶
- ❌ 自訂 context 模板

---

## 10. 未來擴展（Future Considerations）

### v2 可能功能

1. **智慧 context 壓縮** - 使用 LLM 摘要大型檔案
2. **增量 refresh** - 僅更新變更的區塊
3. **記憶分享** - 團隊共用專案記憶
4. **多模型支援** - 針對不同模型優化 context 格式

---

## Appendix A: 標準 Context 格式範例

```markdown
# Project: ax-cli

## Overview
Enterprise-class AI CLI for GLM-4.6 with multi-provider support.
TypeScript 5.3+, Node.js 24+, ESM modules, Zod validation.

## Directory Structure
```
src/
├── index.ts           # CLI entry (Commander)
├── agent/             # Main orchestration
├── llm/               # API client & types
├── tools/             # bash, editor, search, todo
├── mcp/               # MCP server integration
├── ui/                # Ink/React terminal UI
├── utils/             # Shared utilities
└── schemas/           # Zod validation
```

## Key Configuration
- package.json: ESM, bin: ax-cli, vitest testing
- tsconfig.json: strict mode, NodeNext module
- Dependencies: openai, commander, ink, zod

## Architecture Patterns
- Agent-Tool pattern: GrokAgent orchestrates tools
- Event-driven streaming: EventEmitter for real-time updates
- Two-tier config: user (~/.ax-cli) + project (.ax-cli)
- Zod validation: all external inputs validated

## Development Commands
- Build: `npm run build`
- Test: `npm test` (vitest)
- Dev: `npm run dev:node`
```

---

## Appendix B: 與現有命令的關係圖

```
┌─────────────────────────────────────────────────────────┐
│                    ax-cli Commands                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ ax init  │───▶│ ax memory    │───▶│ ax plan/     │  │
│  │          │    │ warmup       │    │ think/spec   │  │
│  └──────────┘    └──────────────┘    └──────────────┘  │
│       │                 │                    │          │
│       ▼                 ▼                    ▼          │
│  .ax-cli/          .ax-cli/            z.ai API        │
│  ├─ config.json    └─ memory.json      (auto cache)    │
│  ├─ CUSTOM.md                                          │
│  └─ index.json                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘

Flow:
1. ax init      → Creates config, CUSTOM.md, index.json
2. ax memory warmup → Creates memory.json with project context
3. ax plan/...  → Loads memory.json, injects as system prompt prefix
                → z.ai auto-caches identical prefix content
```
