<div align="center">

# 🪂 Antigravity Anti-Fall (反重力·防下坠雷达)

> ### **Antigravity 插件 —— 看看今天你的基米降智了吗** 🧐

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Sidecar%20Plugin-purple.svg)](https://github.com/FlameTN7/antigravity-anti-fall)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/FlameTN7/antigravity-anti-fall/pulls)

*既然都叫「反重力（Antigravity）」了，怎么能让基米的智商被重力拉下去自由落体？*

[✨ 特性介绍](#-特性) • [⚡ 快速安装](#-快速安装) • [🔬 它是怎么抓现行的](#-它是怎么抓现行的) • [🧩 常见问题](#-常见问题)

</div>

## 本文档由Gemini-3.8-Flash-n编写
是的正是如此（）
---

## 🧐 为什么会有这个插件？

在使用 Google Antigravity 时，你是否常常陷入以下哲学沉思：

> *“明明我选的都是 `Gemini 3.8 Flash (High)`，为什么刚才写代码神挡杀神，现在却连个简单的正则都能写劈叉？”*  
> *“难道基米也有早八起床气和周五摸鱼综合征？！”*

别猜了，**你的基米可能真的被悄悄降智了！** 📉

Google 后端在面对晚高峰、算力波动或未知玄学负载时，会悄悄把你路由到不同的备用/影子端点（比如有时候是满血版 `gemini-3.8-flash-n`，有时候就变成了某种神秘的 `gemini-3.8-flash-k` 等）。  
而前端顶部的模型选择框依然岁月静好地挂着 `Gemini 3.8 Flash (High)`，仿佛什么都没发生。

**`Antigravity Anti-Fall`** 就是为此而生 —— **无感嵌入聊天输入框操作栏，实时抓出每次请求真正落地的底层端点标识！**

---

## 📸 效果预览

位置紧贴聊天输入框底部的 **修改权限按钮（`Turbo / Workspace Only`）左侧**，绝不霸占寸土寸金的侧边栏：

```text
 ┌────────────────────────────────────────────────────────┐
 │ 问点什么吧...                                          │
 │                                                        │
 │                                                        │
 │                                                        │
 ├────────────────────────────────────────────────────────┤
 │ [⚡ gemini-3.8-flash-n]  [🛡️ Turbo]  [ 42% ]  [  发送  ]│
 └────────────────────────────────────────────────────────┘
         ↑
    【Anti-Fall 实时徽标】
```

- **正常状态**：柔和微蓝闪电图标 + 精致胶囊圆角，与 Antigravity 原生暗色/亮色主题完美融为一体。
- **悬停详情**：鼠标放上去查看完整 Tooltip（真实端点、显示名称、响应更新时间、轮次序号）。
- **一键复制**：点击徽标直接把模型 ID 拷贝到剪贴板，还会弹出超萌的 `✓ 已复制` 绿色微动效。

---

## ✨ 特性

- 🎯 **不占侧栏，拒绝打扰**：直接放在输入框底部权限按钮左侧，28px 原生高度，不抢视线，随时瞄一眼。
- ⚡ **毫秒级实时刷新**：实时监听当前会话数据库（WAL 模式），后端一旦生成完毕写入元数据，徽标立刻闪电更新。
- 🔍 **多窗口 / 多会话自适应**：切换不同会话（`/c/<id>`）秒级感应，多窗口独立运作，绝不串台。
- 🛡️ **纯原生零侵入**：基于 Antigravity 官方 Sidecar 守护进程规范，由 Language Server 原生保活，**不修改任何客户端源码、不解包 asar**，升级 IDE 零风险。
- 📋 **点击即复制**：抓到了降智端点想去群里吐槽？点一下直接复制，省去按 F12 抓包翻数据库的麻烦。

---

## ⚡ 快速安装

### 方式一：一键脚本（推荐，Linux / macOS）

在终端中执行以下命令（自动克隆并软链接到 Antigravity 插件目录）：

```bash
git clone https://github.com/FlameTN7/antigravity-anti-fall.git ~/antigravity-anti-fall
cd ~/antigravity-anti-fall
./install.sh
```

> **提示**：安装脚本默认创建符号链接，后续你在仓库目录 `git pull` 更新即可实时生效！

### 方式二：手动安装

把本仓库直接克隆或复制到 Antigravity 的用户插件目录即可：

```bash
# 1. 确保目录存在
mkdir -p ~/.gemini/config/plugins

# 2. 克隆到插件目录
git clone https://github.com/FlameTN7/antigravity-anti-fall.git ~/.gemini/config/plugins/antigravity-anti-fall
```

安装完成后，**重启 Antigravity**（或者等待几秒让内置语言服务扫描），即可在输入框左侧看到微型闪电徽标！

---

## 🔬 它是怎么抓现行的？

既然前端界面把实际模型藏起来了，那它是怎么被挖出来的？

1. **后端数据库解密**：  
   Antigravity 每次流式响应完成后，都会把该轮次的 `GenerationMetadata` 打包成 Protobuf 写入会话数据库 `~/.gemini/antigravity/conversations/<uuid>.db` 的 `gen_metadata` 表。
   - `Tag 19` (`0x9a, 0x01`): 后端真实返回的底层端点名称（如 `gemini-3.8-flash-n`、`gemini-3.8-flash-k`）。
   - `Tag 21` (`0xaa, 0x01`): 前端显示的展示名称（如 `Gemini 3.8 Flash (High)`）。
2. **Sidecar 守护监听**：  
   插件以 `sidecar.json` 注册，由 Antigravity 的 Language Server 自动拉起 Node.js 守护进程。
3. **CDP 安全挂载**：  
   守护进程通过本机的 Chrome DevTools Protocol 端口连接活跃会话页面，利用 `MutationObserver` 确保在 React 组件多次销毁和重绘后，徽标依然稳如泰山地立在输入框权限按钮左边。

---

## 🧩 常见问题 (FAQ)

<details>
<summary><b>Q: 看到不同的后缀（比如 -n 和 -k）代表什么？</b></summary>
这是 Google 在其多集群网关中针对负载分流使用的影子路由标识。通常主力节点响应更快、质量更稳；备用节点可能在过载或降级容灾时接管。大家可以多记录对比不同后缀下的代码补全和思考质量！
</details>

<details>
<summary><b>Q: 为什么刚打开一个新会话时显示 <code>loading...</code>？</b></summary>
新开的空会话还没有任何后端生成请求，因此没有 <code>gen_metadata</code> 记录。一旦你发送第一条消息并收到回复，徽标就会立刻激活并显示真实端点。
</details>

<details>
<summary><b>Q: 卸载插件怎么办？</b></summary>
直接删除 <code>~/.gemini/config/plugins/antigravity-anti-fall</code> 目录并重启 Antigravity 即可，不留任何痕迹。
</details>

---

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 开源。欢迎提 Issue、PR 或分享你抓到的神奇基米端点！
