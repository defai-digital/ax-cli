# Project Memory - Action Plan

> **版本**: 1.0
> **日期**: 2025-11-21
> **相關文件**:
> - project-memory-prd.md
> - project-memory-tech-spec.md

---

## 總覽

實作分為 4 個階段，每階段獨立可交付：

```
Phase 1: 核心模組 (Foundation)
   ↓
Phase 2: CLI 命令 (User Interface)
   ↓
Phase 3: Agent 整合 (Integration)
   ↓
Phase 4: 優化與文檔 (Polish)
```

---

## Phase 1: 核心模組 (Foundation)

### 目標
建立 Project Memory 的核心邏輯，不含 CLI 介面

### 任務清單

| # | 任務 | 檔案 | 依賴 | 複雜度 |
|---|------|------|------|--------|
| 1.1 | 建立 memory 模組目錄結構 | `src/memory/` | - | 低 |
| 1.2 | 定義 TypeScript types | `src/memory/types.ts` | 1.1 | 低 |
| 1.3 | 實作 Zod schemas | `src/memory/schemas.ts` | 1.2 | 低 |
| 1.4 | 實作 ContextStore (讀寫) | `src/memory/context-store.ts` | 1.3 | 中 |
| 1.5 | 實作 ContextGenerator (掃描) | `src/memory/context-generator.ts` | 1.4 | 高 |
| 1.6 | 實作 ContextInjector | `src/memory/context-injector.ts` | 1.4 | 低 |
| 1.7 | 實作 StatsCollector | `src/memory/stats-collector.ts` | 1.4 | 低 |
| 1.8 | 建立模組入口 | `src/memory/index.ts` | 1.4-1.7 | 低 |
| 1.9 | 撰寫單元測試 | `tests/memory/*.test.ts` | 1.4-1.7 | 中 |

### 驗收標準

- [ ] `ContextGenerator.generate()` 可掃描專案產生 context
- [ ] `ContextStore.save()` / `load()` 可正確讀寫 memory.json
- [ ] Zod schema 可驗證 memory.json 格式
- [ ] 單元測試覆蓋率 ≥ 80%

### 預估工作量
- 開發: 3-4 小時
- 測試: 2 小時

---

## Phase 2: CLI 命令 (User Interface)

### 目標
提供使用者操作 Project Memory 的 CLI 介面

### 任務清單

| # | 任務 | 檔案 | 依賴 | 複雜度 |
|---|------|------|------|--------|
| 2.1 | 實作 `ax memory warmup` | `src/commands/memory.ts` | Phase 1 | 中 |
| 2.2 | 實作 `ax memory refresh` | `src/commands/memory.ts` | 2.1 | 中 |
| 2.3 | 實作 `ax memory status` | `src/commands/memory.ts` | Phase 1 | 低 |
| 2.4 | 實作 `ax memory clear` | `src/commands/memory.ts` | Phase 1 | 低 |
| 2.5 | 實作 `ax memory stats` | `src/commands/memory.ts` | 1.7 | 低 |
| 2.6 | 更新 CLI help 文字 | `src/commands/memory.ts` | 2.1-2.5 | 低 |
| 2.7 | 撰寫整合測試 | `tests/commands/memory.test.ts` | 2.1-2.5 | 中 |

### 驗收標準

- [ ] `ax memory warmup` 可產生 `.ax-cli/memory.json`
- [ ] `ax memory refresh` 可更新 memory，顯示差異
- [ ] `ax memory status` 顯示正確的統計資訊
- [ ] `ax memory clear` 可刪除 memory.json
- [ ] 所有命令有正確的 help 文字
- [ ] --dry-run, --verbose 旗標正常運作

### 預估工作量
- 開發: 2-3 小時
- 測試: 1 小時

---

## Phase 3: Agent 整合 (Integration)

### 目標
將 Project Memory 整合到 ax-cli 的 agent 流程

### 任務清單

| # | 任務 | 檔案 | 依賴 | 複雜度 |
|---|------|------|------|--------|
| 3.1 | 在 agent 載入 memory context | `src/agent/index.ts` | Phase 1 | 中 |
| 3.2 | 注入 context 到 system prompt | `src/agent/index.ts` | 3.1 | 低 |
| 3.3 | 收集 cached_tokens 統計 | `src/llm/client.ts` 或 agent | 1.7 | 低 |
| 3.4 | 新增 --no-memory 旗標 | `src/index.ts` | 3.2 | 低 |
| 3.5 | 新增 --verbose 顯示快取資訊 | agent | 3.3 | 低 |
| 3.6 | 變更偵測提醒機制 | `src/memory/change-detector.ts` | Phase 1 | 中 |
| 3.7 | 撰寫整合測試 | `tests/integration/memory.test.ts` | 3.1-3.6 | 中 |

### 驗收標準

- [ ] `ax plan` 自動載入 memory context
- [ ] API response 的 cached_tokens 被記錄
- [ ] `--no-memory` 可停用 memory 注入
- [ ] `--verbose` 顯示快取命中率
- [ ] 專案變更時顯示 refresh 提醒

### 預估工作量
- 開發: 2-3 小時
- 測試: 1-2 小時

---

## Phase 4: 優化與文檔 (Polish)

### 目標
優化效能、完善文檔、準備發布

### 任務清單

| # | 任務 | 檔案 | 依賴 | 複雜度 |
|---|------|------|------|--------|
| 4.1 | 效能優化：大型專案掃描 | `context-generator.ts` | Phase 3 | 中 |
| 4.2 | 美化 CLI 輸出 (progress bar, colors) | `src/commands/memory.ts` | Phase 2 | 低 |
| 4.3 | 更新 CLAUDE.md | `CLAUDE.md` | Phase 3 | 低 |
| 4.4 | 撰寫使用者文檔 | `docs/project-memory.md` | Phase 3 | 中 |
| 4.5 | 更新 README | `README.md` | 4.4 | 低 |
| 4.6 | 端到端測試 | `tests/e2e/memory.test.ts` | Phase 3 | 中 |
| 4.7 | 效能基準測試 | `tests/perf/memory.test.ts` | 4.1 | 低 |

### 驗收標準

- [ ] 5k 檔案專案 warmup < 5 秒
- [ ] 文檔完整且準確
- [ ] 所有測試通過
- [ ] 無 TypeScript 錯誤

### 預估工作量
- 開發: 2-3 小時
- 文檔: 1-2 小時
- 測試: 1 小時

---

## 實作順序建議

### 最小可行版本 (MVP)

先完成以下即可發布初版：

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2
```

這條路徑提供：
- ✅ `ax memory warmup` / `refresh` / `status`
- ✅ Agent 自動載入 memory
- ❌ 詳細統計 (可後續加入)
- ❌ 變更偵測提醒 (可後續加入)

### 完整版本

按 Phase 順序完成所有任務。

---

## 檔案變更總覽

### 新增檔案

```
src/memory/
├── index.ts
├── types.ts
├── schemas.ts
├── context-generator.ts
├── context-store.ts
├── context-injector.ts
├── stats-collector.ts
└── change-detector.ts

tests/memory/
├── context-generator.test.ts
├── context-store.test.ts
├── context-injector.test.ts
├── stats-collector.test.ts
└── schemas.test.ts

docs/
└── project-memory.md
```

### 修改檔案

```
src/commands/memory.ts       # 新增 warmup/refresh/status/clear/stats
src/agent/index.ts           # 整合 memory context
src/llm/client.ts            # 收集 cached_tokens (可選)
src/index.ts                 # 新增 --no-memory 旗標
src/schemas/index.ts         # 匯出 memory schemas
CLAUDE.md                    # 更新開發指南
README.md                    # 更新功能說明
```

---

## 風險與緩解

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|---------|
| z.ai 快取行為變更 | 低 | 高 | 監控 cached_tokens，保留 fallback |
| 大型專案掃描過慢 | 中 | 中 | 預設限制 depth，提供 --depth 調整 |
| context 過大超出限制 | 中 | 中 | 預設 8k tokens 上限，自動截斷 |
| 與現有 memory 命令衝突 | 低 | 低 | 現有 show/edit/add 保持不變 |

---

## 測試策略

### 單元測試 (Phase 1)

```typescript
// context-generator.test.ts
describe('ContextGenerator', () => {
  it('should scan directory structure correctly');
  it('should respect max depth');
  it('should apply ignore patterns');
  it('should estimate tokens accurately');
  it('should truncate large files');
});

// context-store.test.ts
describe('ContextStore', () => {
  it('should save memory.json atomically');
  it('should load and validate schema');
  it('should handle missing file gracefully');
  it('should update stats correctly');
});
```

### 整合測試 (Phase 2-3)

```typescript
// memory-commands.test.ts
describe('ax memory commands', () => {
  it('warmup creates memory.json');
  it('refresh updates existing memory');
  it('status shows correct info');
  it('clear removes memory.json');
});

// agent-integration.test.ts
describe('Agent with memory', () => {
  it('should inject memory context into system prompt');
  it('should skip memory with --no-memory flag');
  it('should record cache statistics');
});
```

### E2E 測試 (Phase 4)

```typescript
// e2e/memory.test.ts
describe('Project Memory E2E', () => {
  it('full workflow: init → warmup → plan → refresh');
  it('handles large projects (5k files)');
  it('cache hit rate improves over sessions');
});
```

---

## 驗收檢查清單

### Phase 1 完成
- [ ] `src/memory/` 目錄結構建立
- [ ] 所有 types 定義完成
- [ ] Zod schemas 通過測試
- [ ] ContextStore CRUD 正常
- [ ] ContextGenerator 可產生 context
- [ ] 單元測試 ≥ 80% 覆蓋率

### Phase 2 完成
- [ ] `ax memory warmup` 可用
- [ ] `ax memory refresh` 可用
- [ ] `ax memory status` 可用
- [ ] `ax memory clear` 可用
- [ ] CLI help 文字完整
- [ ] 整合測試通過

### Phase 3 完成
- [ ] Agent 自動載入 memory
- [ ] cached_tokens 被記錄
- [ ] `--no-memory` 旗標可用
- [ ] `--verbose` 顯示快取資訊
- [ ] 整合測試通過

### Phase 4 完成
- [ ] 效能符合要求 (warmup < 5s)
- [ ] 文檔完整
- [ ] 所有測試通過
- [ ] README 更新
- [ ] 無 TypeScript 錯誤

---

## 後續迭代 (v2 考量)

以下功能在 v1 範圍外，可作為後續迭代：

1. **智慧 context 壓縮**
   - 使用 LLM 摘要大型檔案
   - 偵測重要程式碼片段

2. **增量 refresh**
   - 僅更新變更的區塊
   - 減少 token 計算開銷

3. **多模型優化**
   - 針對不同模型調整 context 格式
   - 支援 Claude, GPT 等

4. **團隊共享**
   - 同步 memory.json 到雲端
   - 團隊成員共用專案記憶

5. **自訂模板**
   - 允許使用者自訂 context 結構
   - 支援行業/框架特定模板
