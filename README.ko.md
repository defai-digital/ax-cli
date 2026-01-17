# AX CLI - 엔터프라이즈급 Vibe Coding

> 📖 이 번역은 [README.md @ v5.2.0](./README.md) 를 기반으로 합니다

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

## 목차

- [빠른 시작](#빠른-시작)
- [GLM 사용자](#glm-사용자)
- [왜 AX CLI인가요?](#왜-ax-cli인가요)
- [지원 모델](#지원-모델)
- [설치](#설치)
- [사용법](#사용법)
- [프로젝트 초기화](#프로젝트-초기화)
- [구성](#구성)
- [MCP 통합](#mcp-통합)
- [VSCode 확장](#vscode-확장)
- [AutomatosX 통합](#automatosx-통합)
- [프로젝트 메모리](#프로젝트-메모리)
- [보안](#보안)
- [아키텍처](#아키텍처)
- [패키지](#패키지)
- [변경 내역](#변경-내역)
- [문서](#문서)
- [Enterprise](#enterprise)

---

## 빠른 시작

1분 안에 시작하세요:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**적합한 용도:** 라이브 웹 검색, 비전, 확장 추론, 2M 컨텍스트 창

CLI 안에서 `/init` 을 실행해 프로젝트 컨텍스트를 초기화하세요.

---

## GLM 사용자

> **참고:** `ax-glm` 클라우드 패키지는 더 이상 사용되지 않습니다.
>
> **GLM 클라우드 API는 [OpenCode](https://opencode.ai)를 사용하길 권장합니다.**

**로컬 GLM 모델** (GLM-4.6, CodeGeeX4)은 `ax-cli` 를 통해 Ollama, LMStudio, vLLM 기반의 오프라인 추론에서 계속 완전히 지원됩니다. 아래 [로컬/오프라인 모델](#로컬오프라인-모델-ax-cli)을 참고하세요.

---

## 왜 AX CLI인가요?

| 기능 | 설명 |
|------|------|
| **프로바이더 최적화** | Grok(xAI)에 대한 프로바이더별 파라미터를 포함한 최상급 지원 |
| **17가지 내장 도구** | 파일 편집, bash 실행, 검색, todo 등 |
| **에이전트 동작** | ReAct 추론 루프, 실패 시 자기 교정, TypeScript 검증 |
| **AutomatosX 에이전트** | 백엔드, 프론트엔드, 보안, DevOps 등 20+ 전문 에이전트 |
| **자동 버그 수정** | 타이머 누수, 리소스 문제, 타입 오류를 감지하고 롤백 안전장치로 자동 수정 |
| **지능형 리팩터링** | 데드 코드 제거, 타입 안전성 수정, 검증과 함께 복잡도 감소 |
| **MCP 통합** | 12+ 프로덕션 준비 템플릿을 갖춘 Model Context Protocol |
| **프로젝트 메모리** | 50% 토큰 절감을 위한 지능형 컨텍스트 캐싱 |
| **엔터프라이즈 보안** | AES-256-GCM 암호화, 텔레메트리 없음, CVSS 등급 보호 |
| **65% 테스트 커버리지** | 엄격한 TypeScript로 6,205+ 테스트 |

---

### Grok 하이라이트

- **Grok (ax-grok)**: 내장 웹 검색, 비전, reasoning_effort; **Grok 4.1 빠른 변형은 2M 컨텍스트, 병렬 서버 도구, x_search, 서버 측 코드 실행을 제공합니다**. 자세한 내용은 `docs/grok-4.1-advanced-features.md` 를 참고하세요.

---

## 지원 모델

### Grok (xAI)

> **Grok 4.1 advanced**: ax-grok 는 Grok 4.1의 서버 측 에이전트 도구(web_search, x_search, code_execution)를 병렬 함수 호출과 2M 컨텍스트 빠른 변형으로 활성화합니다. 전체 가이드는 `docs/grok-4.1-advanced-features.md` 를 참고하세요.

| 모델 | 컨텍스트 | 기능 | 별칭 |
|------|---------|------|------|
| `grok-4.1` | 131K | 균형 잡힌 기본값, 추론/비전/검색 내장 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 추론이 포함된 에이전트/도구 세션에 최적 | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 확장 추론 없이 가장 빠름 | `grok-fast-nr` |
| `grok-4-0709` | 131K | Grok 4 초기 릴리즈(호환) | `grok-4` |
| `grok-2-image-1212` | 32K | **이미지 생성**: 텍스트-이미지 | `grok-image` |

> **모델 별칭**: `ax-grok -m grok-latest` 처럼 별칭을 사용하세요.

### 로컬/오프라인 모델 (ax-cli)

Ollama, LMStudio, vLLM을 통한 로컬 추론에는 `ax-cli` 를 사용합니다:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # 로컬 서버 URL 구성
```

ax-cli 는 로컬 서버에서 사용 가능한 **어떤 모델**이든 동작합니다. 구성 시 모델 태그(예: `qwen3:14b`, `glm4:9b`)를 지정하세요.

**추천 모델 패밀리:**

| 모델 | 용도 |
|------|------|
| **Qwen** | 코딩 작업 전반에 최적 |
| **GLM** | 리팩터링과 문서화 |
| **DeepSeek** | 빠른 반복, 좋은 속도/품질 균형 |
| **Codestral** | C/C++/Rust 및 시스템 프로그래밍 |
| **Llama** | 호환성과 fallback에 최적 |

---

## 설치

### 요구 사항

- Node.js 24.0.0+
- macOS 14+, Windows 11+ 또는 Ubuntu 24.04+

### 설치

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### 설정

```bash
ax-grok setup
```

설정 마법사가 다음을 안내합니다:
1. API 키를 AES-256-GCM으로 안전하게 암호화해 저장
2. 기본 AI 모델과 기타 환경 설정 구성
3. 구성 검증으로 정상 설정 확인

---

## 사용법

### 대화형 모드

```bash
ax-grok              # 대화형 CLI 시작
ax-grok --continue   # 이전 대화 이어서
ax-grok -c           # 단축형
```

### 헤드리스 모드

```bash
ax-grok -p "이 코드베이스를 분석해줘"
ax-grok -p "TypeScript 오류를 수정해줘" -d /path/to/project
```

### 에이전트 동작 플래그

```bash
# ReAct 추론 모드 활성화 (생각 → 행동 → 관찰)
ax-grok --react

# 계획 단계 이후 TypeScript 검증 활성화
ax-grok --verify

# 실패 시 자기 교정 비활성화
ax-grok --no-correction
```

기본적으로 자기 교정은 ON입니다(실패 시 반성 후 자동 재시도). ReAct와 검증은 기본적으로 OFF지만 더 구조화된 추론과 품질 검사를 위해 활성화할 수 있습니다.

### 핵심 명령어

| 명령어 | 설명 |
|--------|------|
| `/init` | AX.md 프로젝트 컨텍스트 생성 ([프로젝트 초기화](#프로젝트-초기화) 참조) |
| `/help` | 모든 명령어 표시 |
| `/model` | AI 모델 전환 |
| `/lang` | 표시 언어 변경 (11개 언어) |
| `/doctor` | 진단 실행 |
| `/exit` | CLI 종료 |

### 키보드 단축키

| 단축키 | 동작 | 설명 |
|-------|------|------|
| `Ctrl+O` | 상세 로그 토글 | 자세한 로그 및 내부 프로세스 표시/숨김 |
| `Ctrl+K` | 빠른 작업 | 빠른 작업 메뉴 열기 |
| `Ctrl+B` | 백그라운드 모드 | 현재 작업을 백그라운드에서 실행 |
| `Shift+Tab` | 자동 편집 | AI 코드 제안 트리거 |
| `Esc` ×2 | 취소 | 입력 삭제 또는 작업 취소 |

---

## 프로젝트 초기화

`/init` 명령은 프로젝트 루트에 `AX.md` 파일을 생성합니다. AI가 코드베이스를 이해하도록 돕는 종합 컨텍스트 파일입니다.

### 기본 사용법

```bash
ax-grok
> /init                    # 표준 분석(권장)
> /init --depth=basic      # 소규모 프로젝트용 빠른 스캔
> /init --depth=full       # 아키텍처 매핑 포함 심층 분석
> /init --depth=security   # 보안 감사 포함 (secrets, 위험 API)
```

### 깊이 레벨

| 깊이 | 분석 내용 | 적합한 대상 |
|------|----------|-------------|
| `basic` | 이름, 언어, 기술 스택, 스크립트 | 빠른 설정, 소규모 프로젝트 |
| `standard` | + 코드 통계, 테스트 분석, 문서 | 대부분의 프로젝트(기본값) |
| `full` | + 아키텍처, 의존성, 핫스팟, 사용 가이드 | 대규모 코드베이스 |
| `security` | + 시크릿 스캔, 위험 API 탐지, 인증 패턴 | 보안 민감 프로젝트 |

### 적응형 출력

`/init` 명령은 프로젝트 복잡도에 따라 출력 상세도를 자동 조정합니다:

| 프로젝트 규모 | 파일 수 | 일반 출력 |
|-------------|--------|----------|
| 소형 | <50 파일 | 간결, 핵심만 |
| 중형 | 50-200 파일 | 표준 문서화 |
| 대형 | 200-500 파일 | 아키텍처 노트 포함 상세 |
| Enterprise | 500+ 파일 | 모든 섹션 포함 종합 |

### 옵션

| 옵션 | 설명 |
|------|------|
| `--depth=<level>` | 분석 깊이 설정 (basic, standard, full, security) |
| `--refresh` | 기존 AX.md를 최신 분석으로 업데이트 |
| `--force` | AX.md가 있어도 재생성 |

### 생성 파일

| 파일 | 목적 |
|------|------|
| `AX.md` | AI 컨텍스트 기본 파일 (항상 생성) |
| `.ax/analysis.json` | 심층 분석 데이터 (full/security만) |

### 컨텍스트 주입 방식

대화를 시작하면 AX CLI가 자동으로 `AX.md`를 읽어 AI 컨텍스트 윈도우에 주입합니다. 즉:

1. **AI가 프로젝트를 이해** - 빌드 명령, 기술 스택, 규칙
2. **반복 설명 불필요** - 프로젝트 구조를 기억
3. **더 나은 코드 제안** - 기존 패턴과 규칙을 따름

```
You run: ax-grok
         ↓
System reads: AX.md from project root
         ↓
AI receives: <project-context source="AX.md">
             # Your Project
             ## Build Commands
             pnpm build
             ...
             </project-context>
         ↓
AI understands your project before you ask anything!
```

**우선순위** (여러 컨텍스트 파일이 있는 경우):
1. `AX.md` (권장) - 새로운 단일 파일 형식
2. `ax.summary.json` (legacy) - JSON 요약
3. `ax.index.json` (legacy) - 전체 JSON 인덱스

### 레거시 형식에서 마이그레이션

레거시 파일(`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`)이 있다면 다음을 실행하세요:

```bash
> /init --force
```

새 단일 파일 형식 `AX.md`가 생성됩니다. 이후 레거시 파일을 제거할 수 있습니다.

---

## 구성

### 구성 파일

| 파일 | 목적 |
|------|------|
| `~/.ax-grok/config.json` | 사용자 설정(암호화된 API 키) |
| `.ax-grok/settings.json` | 프로젝트 오버라이드 |
| `AX.md` | 프로젝트 컨텍스트 파일(`/init`으로 생성) |

### 환경 변수

```bash
# CI/CD 용
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 통합

[Model Context Protocol (MCP)](https://modelcontextprotocol.io)로 외부 도구, API, 데이터 소스와 연결해 기능을 확장하세요:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**사용 가능한 템플릿:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive 등.

---

## VSCode 확장

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- 사이드바 채팅 패널
- 파일 변경 diff 미리보기
- 컨텍스트 인식 명령
- 체크포인트 & 되감기 시스템

---

## AutomatosX 통합

AX CLI는 [AutomatosX](https://github.com/defai-digital/automatosx)와 통합됩니다. AutomatosX는 자동 버그 수정, 지능형 리팩터링, 20+ 전문 에이전트를 제공하는 멀티 에이전트 AI 시스템입니다.

대화형 모드(`ax-grok`)에서 자연스럽게 요청하세요:

```
> 이 코드베이스의 버그를 스캔하고 수정해줘

> 인증 모듈을 리팩터링하고 데드 코드 제거에 집중해줘

> 보안 에이전트로 API 엔드포인트를 감사해줘

> 이 PRD를 리뷰하고 제품 에이전트와 함께 개선해줘

> 백엔드와 프론트엔드 에이전트가 함께 사용자 등록을 구현하도록 해줘
```

**제공되는 것:**
- **버그 수정**: 타이머 누수, 정리 누락, 리소스 문제 감지 - 롤백 안전장치로 자동 수정
- **리팩터링**: 데드 코드 제거, 타입 안정성 수정, 복잡도 감소 - typecheck로 검증
- **20+ 에이전트**: 백엔드, 프론트엔드, 보안, 아키텍처, DevOps, 데이터 등

에이전트 목록, 고급 옵션, 설정은 [AutomatosX Guide](docs/AutomatosX-Integration.md) 를 참고하세요

---

## 프로젝트 메모리

관련 프로젝트 정보를 저장/검색하는 지능형 캐시로 토큰 비용을 줄이고 컨텍스트 회상을 향상합니다.

```bash
ax-grok memory warmup    # 컨텍스트 캐시 생성
ax-grok memory status    # 토큰 분포 보기
```

---

## 보안

- **API 키 암호화:** AES-256-GCM 및 PBKDF2(600K 반복)
- **텔레메트리 없음:** 데이터 수집 없음
- **CVSS 보호:** Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6), SSRF (CVSS 7.5) 등 일반 취약점에 대한 강력한 보호

---

## 아키텍처

AX CLI는 공유 코어 위에 프로바이더별 CLI를 둔 모듈형 아키텍처를 사용합니다:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 확장 추론                                         │
│  • xAI API defaults                                         │
│  • 라이브 웹 검색                                            │
│  • ~/.ax-grok/ 구성                                          │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  공유 기능: 17개 도구, MCP 클라이언트, 메모리,               │
│  체크포인트, React/Ink UI, 파일 작업, Git 지원               │
└─────────────────────────────────────────────────────────────┘
```

---

## 패키지

| 패키지 | 설치? | 설명 |
|--------|:-----:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **예** | 웹 검색, 비전, 확장 사고를 갖춘 Grok 최적화 CLI |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 선택 | Ollama/LMStudio/vLLM + DeepSeek Cloud용 로컬 우선 CLI |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | 아니오 | 공유 코어 라이브러리(의존성으로 자동 설치) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | 아니오 | 공유 Zod 스키마(의존성으로 자동 설치) |

> **GLM Cloud 사용자:** GLM 클라우드 API는 [OpenCode](https://opencode.ai)를 권장합니다.

---

## 변경 내역

| 버전 | 하이라이트 |
|------|-----------|
| **v5.2.0** | Feature: AX.md 컨텍스트 주입 - 시작 시 프로젝트 자동 이해 |
| **v5.1.19** | 성능: 의존성 분석 O(N×M) → O(N+M), 캐시 제거 최적화, UI 버그 수정 |
| **v5.1.18** | 리팩터링: 명명된 상수, 변수명 통일, 6,205 테스트 통과 |
| **v5.1.17** | 수정: ESC 취소 버그, 타이머 누수, MCP 타임아웃 처리 |

[GitHub에서 전체 변경 내역 보기 →](https://github.com/defai-digital/ax-cli/releases)

---

## 문서

- [기능](docs/features.md)
- [구성](docs/configuration.md)
- [CLI 레퍼런스](docs/cli-reference.md)
- [MCP 통합](docs/mcp.md)
- [AutomatosX Guide](docs/AutomatosX-Integration.md)
- [VSCode Guide](docs/vscode-integration-guide.md)
- [Figma 통합](docs/figma-guide.md)
- [문제 해결](docs/troubleshooting.md)

---

## Enterprise

고급 기능이 필요한 팀을 위해:

- 컴플라이언스 보고서(SOC2, HIPAA)
- 고급 감사 로그
- SSO/SAML 통합
- 우선 지원(24시간 SLA)

문의: **sales@defai.digital**

---

## 라이선스

MIT 라이선스 - [LICENSE](LICENSE) 참조

---

<p align="center">
  ❤️ 를 담아 <a href="https://github.com/defai-digital">DEFAI Digital</a> 제작
</p>
