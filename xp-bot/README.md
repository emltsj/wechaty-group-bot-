# 定时微信群发机器人（XP Hook 版） · Scheduled WeChat Broadcaster (XP hook edition)

[中文](#中文) · [English](#english)

基于 [wechaty-puppet-xp](https://github.com/wechaty/puppet-xp) 的 Windows 版本：Hook 本机已登录的微信桌面客户端，不需要扫码登录。
Windows edition powered by [wechaty-puppet-xp](https://github.com/wechaty/puppet-xp): hooks the WeChat desktop client already logged in on your machine, no QR scan required.

---

# 中文

## 环境要求

- Windows 系统
- Node.js >= 18
- 微信桌面客户端 **v3.9.2.23**（版本必须匹配，否则可能 Hook 失败或图片发送失败）

## 安装步骤

### 1. 安装指定版本微信

下载并安装 v3.9.2.23：

```
https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.9.2.23/WeChatSetup-3.9.2.23.exe
```

安装后登录微信，并**关闭自动更新**，避免版本被升级。

### 2. 安装依赖

```bash
cd xp-bot
npm install
```

### 3. 生成配置

```bash
cp .env.example .env
```

编辑 `.env`：群列表、文案、图片路径。需要多分店时继续复制为 `env2`、`env3`、`env4`。

### 4. 启动

保持微信客户端已登录，然后：

```bash
npm start
```

程序会自动 Hook 到已登录的微信，无需扫码。

## 与默认版本的区别

| 项目 | 默认版（wechat4u） | XP 版 |
| --- | --- | --- |
| 协议 | 网页版微信 | Windows 客户端 Hook |
| 登录方式 | 扫码 | 直接 Hook 已登录客户端 |
| 运行环境 | 任意系统 | 仅 Windows |
| 帐号风险 | 网页协议受限，风险较高 | 相对较低 |
| 图片发送 | 支持 | 支持（需 v3.9.2.23） |
| 后台运行 | 可无人值守 | 微信客户端必须保持登录 |

定时规则、配置格式、群内命令与默认版完全一致，详见[主 README](../README.md)。

## 注意事项

- 微信客户端必须一直保持登录，退出登录后机器人失效
- 不要升级微信版本
- 建议先用小号测试
- 群内命令对所有已加入的群生效，只在可信群使用

## 免责声明

仅供学习研究使用。自动化操作微信可能违反平台规则，风险自负。

---

# English

## Requirements

- Windows
- Node.js >= 18
- WeChat desktop client **v3.9.2.23** (exact version required, otherwise hooking or image sending may fail)

## Setup

### 1. Install the required WeChat version

Download and install v3.9.2.23:

```
https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.9.2.23/WeChatSetup-3.9.2.23.exe
```

Log in, then **disable auto-update** so the client is not upgraded.

### 2. Install dependencies

```bash
cd xp-bot
npm install
```

### 3. Create the config

```bash
cp .env.example .env
```

Edit `.env`: group list, messages, image paths. For multiple stores, copy again as `env2`, `env3`, `env4`.

### 4. Start

Keep WeChat logged in, then:

```bash
npm start
```

The bot hooks the running WeChat client automatically.

## Differences from the default edition

| Item | Default (wechat4u) | XP edition |
| --- | --- | --- |
| Protocol | WeChat Web | Windows client hook |
| Login | QR scan | Hooks the logged-in client |
| Platform | Any | Windows only |
| Account risk | Web protocol is restricted; higher risk | Relatively lower |
| Images | Supported | Supported (v3.9.2.23) |
| Unattended run | Possible | WeChat client must stay logged in |

Schedules, config format and in-group commands are identical to the default edition — see the [main README](../README.md).

## Notes

- WeChat must stay logged in; logging out disables the bot
- Do not upgrade the WeChat client
- Test with a secondary account first
- In-group commands apply to every group the bot has joined — only use trusted groups

## Disclaimer

For learning and research only. Automating WeChat may violate platform rules; use at your own risk.
