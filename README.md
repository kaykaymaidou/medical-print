<div align="center">

# 🏥 MedPrint

**面向医疗健康与高精单据的下一代跨平台打印报告单设计器与高性能引擎**

*Next-Generation Medical Report Designer & Cross-Platform Printing Engine (Rust + WASM + Vue 3)*

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Vue 3](https://img.shields.io/badge/vue-3.4%2B-green.svg)](https://vuejs.org/)
[![WASM](https://img.shields.io/badge/WebAssembly-Enabled-purple.svg)](https://webassembly.org/)
[![信创适配](https://img.shields.io/badge/信创支持-统信UOS%20%7C%20银河麒麟-red.svg)](#信创国产化适配)

</div>

---

## 💡 为什么需要 MedPrint？直击医疗打印的核心痛点

在医院信息化（HIS、LIS 检验、PACS 影像、心电、电子病历）建设中，报告单打印是核心生命线。传统方案（如葡萄城 ActiveReports / SpreadJS、C-Lodop、FastReport 等）在实际医院现场常年面临以下痛点：

1. **分辨率模糊失真**：传统 Web 报表将 HTML 栅格化为位图（96 DPI），导致采血管条形码锯齿发虚被扫码枪拒读、心电图 \(1\text{mm}\) 网格漂移、超声微小病灶模糊；
2. **多服务部署噩梦**：前端引入 npm，终端电脑还得挨台安装 Windows 打印后台，数千台终端版本割裂、自签 HTTPS 证书被现代浏览器拦截、杀毒软件频频报毒拦截；
3. **A5 横向双列折流难以排版**：化验单主流采用 A5 横向（\(210 \times 148\text{mm}\)），要求**左列排满自上而下折回右列并自动克隆表头，两列均满才允许分页**，传统报表一旦折行左右列全部高低错位；
4. **设计器门槛太高**：满屏复杂的 CAD 坐标与公式，临床医生和护士长根本不会用；
5. **硬件真实状态丢失**：传统 Web 打印甚至 C-Lodop 无法可靠感知物理打印机的缺纸（Paper Out）、卡纸（Paper Jam）与真正物理出纸完毕，导致处方号与医保发票号重复发药或虚假核销；
6. **缺乏内置临床公式与防伪签章**：eGFR、LDL-C、BMI 等临床指标以及三级医疗责任签名链和防伪红章无法开箱即用；
7. **高昂商业授权壁垒**：闭源且按服务器核心数高额收费，遇到深层硬件兼容 Bug 无法自行修复。

---

## ✨ 核心特性

- **物理毫米（mm）纯矢量内核**：全链路采用绝对物理精度排版，直出 300/600 DPI 纯矢量 PDF，内置纯矢量条码（Code 128 / DataMatrix / QR），绝无 DOM 栅格化模糊；
- **全场景一键交付矩阵**：
  - `medprint-server`：单个静态 Rust 二进制（内置打好的 Vue3 设计器），双击即运行，对外提供 REST/WebSocket API，解决双服务部署痛点；
  - `packages/extension`：Chrome/Edge 浏览器扩展（Native Messaging 通信），免去开放本地网络端口与 SSL 证书烦恼；
  - `apps/desktop`：基于 Tauri 2.0 的跨平台桌面端，脱机离线开箱即用；
  - `packages/designer`：纯前端 Web SDK（WASM 客户端极速排版并直出 PDF）。
- **A5 横向双列折流平衡算法（Snaking Flow）**：左列满折右列，双列满才分页，内置单页弹性微调机制，保证整单 100% 紧凑在 1 页内打印；
- **双轨制设计器（Dual-Mode UX）**：
  - **临床向导模式（Doctor Wizard）**：专为医生/护士打造，零拖拽门槛，勾选字段与预设，10 秒出单；
  - **专业极客模式（Pro Canvas）**：为信息科提供像素级吸附、图层编排、复杂动态脚本。
- **医学高保真影像与专业图表**：
  - **血栓弹力图（TEG）**：纺锤凝血反应曲线高精度拟合；
  - **心电图（ECG）**：严苛的 \(1\text{mm} \times 1\text{mm}\) 物理绝对网格；
  - **PACS 影像网格**：1/2/4/6 自适应网格排版，保持原始影像比例不拉伸，支持微米标尺；
- **内置临床医疗公式库与动态参考值**：开箱即用 eGFR、LDL-C、BMI、阴离子间隙、校正钙计算，根据年龄/性别/孕周自动匹配参考区间并打上 `↑` `↓` 标记；
- **合规三级责任链与防伪专用红章**：采样/检验/审核/报告四级签名链，矢量红章自带微偏转角防伪与半透明正片叠底，严格执行 `Keep-With-Next` 防孤立规则；
- **全栈信创国产化适配**：原生兼容统信 UOS、银河麒麟 Linux 系统，支持龙芯 LoongArch64、鲲鹏/飞腾 AArch64、海光/兆芯 x86_64 芯片。

---

## 🏛️ 仓库架构 (Monorepo)

```
medprint/
├── crates/
│   ├── medprint-core/       # Rust 核心排版引擎 (物理毫米/A5折流/公式/TEG图表/纯矢量PDF)
│   ├── medprint-wasm/       # wasm-bindgen 浏览器前端极速排版与渲染桥接
│   ├── medprint-spooler/    # 打印机硬件守护进程 (Windows Spooler / Linux CUPS 双向状态监听与 NativeHost)
│   └── medprint-server/     # 单一二进制独立微服务 (内置 Vue3 静态托管 + REST/WebSocket API + 本地离线持久化)
├── packages/
│   ├── designer/            # Vue 3 + TypeScript 医疗设计器 (Apple Design: 医生向导 + 极客画布 + 公式实验室)
│   ├── extension/           # Chrome/Edge 浏览器扩展 (Native Messaging 直连打印机免端口与证书)
│   └── ai-agent/            # 医疗排版 AI 智能体 (接入 DeepSeek Harness dsh 插件体系，实现临床自主规划)
├── apps/
│   └── desktop/             # Tauri 2.0 跨平台独立桌面客户端
├── .github/                 # 开源 Issue 模板 (医疗单据/打印机兼容度/信创反馈) 与 CI
├── docs/                    # 痛点深度调研白皮书与技术规范
└── AGENTS.md                # 跨 AI 协作规范与医疗工程七大准则
```

---

## 🚀 快速上手

### 1. 编译纯前端 Web 设计器
```bash
pnpm install
pnpm build:designer
```

### 2. 编译并运行单文件微服务 (`medprint-server`)
```bash
cargo run -p medprint-server
# 访问 http://localhost:19800 即可直接使用完整 Web Studio、离线档案库与 300 DPI 矢量打印
```

### 3. 本地开发调试
```bash
pnpm dev:designer
```

---

## 🤝 开源协作与 Issue 提交

欢迎各大医院信息科、医疗软件厂商（HIS/LIS/PACS）、打印机厂商与开源爱好者共同建设：
- [🏥 医疗单据模板需求申报](../../issues/new?template=1-medical-template.yml)
- [🖨️ 打印机硬件兼容性反馈](../../issues/new?template=2-printer-compatibility.yml)
- [🇨🇳 信创国产化系统问题反馈](../../issues/new?template=3-xinchuang-report.yml)
- [🐛 缺陷与建议反馈](../../issues/new?template=4-bug-report.yml)

---

## 📄 开源许可证

本项目基于 [Apache-2.0 许可证](LICENSE) 开源，允许商业友好集成与定制。
