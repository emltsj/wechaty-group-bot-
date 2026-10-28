# 定时微信群发机器人 · Scheduled WeChat Group Broadcaster

[中文](#中文) · [English](#english)

基于 [Wechaty](https://github.com/wechaty/wechaty) 的微信群定时群发工具：多分店配置、文字 + 图片、`.env` 热更新、群内命令控制。
A scheduled group-message broadcaster for WeChat built on Wechaty: multi-store configs, text + image messages, hot-reload `.env`, in-group commands.

---

# 中文

## 功能特性

- **定时群发**：常规文案 + 工作日特殊文案，所有时间点带 ±3 分钟随机偏移
- **文字 + 图片**：每条文案可以配一张图片，先发文字再发图
- **多分店**：`.env` / `env2` / `env3` / `env4` 四套独立配置，各自维护群列表与文案
- **热更新**：修改配置文件保存即生效，不用重启进程
- **自动加群**：`MASTER_NAME` 在哪个群发言，该群自动进入群发列表
- **群内命令**：`#预览`、`#测试群发`、`#群发列表` 等，随时查状态
- **降低封号风险**：时间随机偏移、发送间隔随机、5 分钟内同内容去重、群对象缓存
- **两种协议**：默认网页协议（跨平台）；`xp-bot/` 为 Windows 微信客户端 Hook 版

## 环境要求

- Node.js >= 18
- 默认版：一个还能登录网页版微信的账号（扫码登录）
- XP 版：Windows + 微信客户端 **v3.9.2.23**

## 快速开始

```bash
git clone <your-repo-url>
cd wechat-bot-scheduler
npm install

# 生成自己的配置（不要提交到仓库）
cp .env.example .env          # Windows CMD: copy .env.example .env
# 编辑 .env，填群名、文案、图片路径

npm start
```

启动后控制台会打印二维码链接，浏览器打开扫码登录。登录成功后才开始执行定时任务。

## 配置说明

| 配置项 | 说明 |
| --- | --- |
| `MASTER_NAME` | 主人的微信名/备注名，主人在哪个群发言，该群自动加入群发列表 |
| `ROOM_LIST` | 固定群发群列表，英文逗号分隔，可留空 |
| `SCHEDULE_MESSAGE_DAILY` | 常规群发文案（每天下午） |
| `SCHEDULE_IMAGE_DAILY` | 常规群发图片路径，留空只发文字 |
| `SCHEDULE_MESSAGE_MON` ~ `FRI` | 周一至周五特殊文案 |
| `SCHEDULE_IMAGE_MON` ~ `FRI` | 周一至周五特殊图片 |

图片路径可以写相对项目根目录的路径（如 `images/monday.jpg`），也可以写绝对路径；支持 `.jpg` `.jpeg` `.png` `.gif` `.webp`。

### 多分店配置

程序启动时按顺序查找项目根目录下的 `.env`、`env2`、`env3`、`env4`，存在几个就加载几个：

```bash
cp env2.example env2
cp env3.example env3
```

每个文件都是一套完整的配置（独立群列表、独立文案、独立图片）。不需要的分店直接删掉对应文件即可。

### 文案换行写法

三种写法都支持：

```env
# 1) 跨多行（推荐，所见即所得）
SCHEDULE_MESSAGE_DAILY='第一行
第二行
第三行'

# 2) 单行 + \n 转义
SCHEDULE_MESSAGE_DAILY='第一行\n第二行\n第三行'

# 3) 单行不加引号
SCHEDULE_MESSAGE_DAILY=今天正常营业
```

注意事项：

- 多行写法必须用引号包裹，**结束引号要落在最后一行行尾**，否则会一直读到文件末尾（控制台会告警）
- `\n` 转义只对 `SCHEDULE_MESSAGE_*` 生效，图片路径里的反斜杠不会被处理
- 启动和热重载时会打印每条文案的行数，例如 `📄 DAILY:17行 MON:10行 ...`，行数不对就说明写法有问题

## 群发时间表

所有时间点都会随机偏移 **±3 分钟**，避免每天同一秒发消息。

### 常规群发（每天）

从 **12:45** 开始，每 **25 分钟**一次，最后一次 **16:55**（偏移后最晚 16:58，不越过 17:00 截单）：

```
12:45  13:10  13:35  14:00  14:25  14:50  15:15  15:40  16:05  16:30  16:55
```

### 特殊群发（周一至周五）

以周一特殊文案为例（周二至周五同理，只是日期不同）：

| 阶段 | 时间 | 频率 |
| --- | --- | --- |
| 前一天晚上 | 19:30 ~ 23:30 | 每 30 分钟 |
| 当天凌晨 | 00:00 / 00:30 / 01:00 | 每 30 分钟 |
| 当天上午 | 07:00 ~ 10:45 | 每 25 分钟 |

上午最后一条 10:45（偏移后最晚 10:48，不越过 11:00 截单）。

> 周一的特殊文案在周日晚上开始预热，周二的在周一晚上预热，以此类推。

## 热更新

用编辑器直接改 `.env` / `env2` / `env3` / `env4` 并保存，程序会检测到并自动重载配置、重建定时任务：

```
📝 检测到 .env 文件变化，正在重新加载配置...
✅ 配置已加载/刷新
🔄 定时任务已根据新配置刷新
```

> 热更新只重载**配置内容**，不重载代码。改代码后需要重启 `npm start`。

## 群内命令

在机器人所在的任意群里发送：

| 命令 | 功能 |
| --- | --- |
| `#添加群发` | 把当前群加入对应分店的群发列表 |
| `#移除群发` | 把当前群从群发列表移除 |
| `#群发列表` | 查看当前群发列表 |
| `#测试群发` | 向当前分店所有群发一条测试消息 |
| `#预览` | 在当前群预览今天实际会发送的文案（含行数） |
| `#刷新配置` | 手动刷新所有分店配置 |
| `#帮助` | 显示命令说明 |

## 发送节奏

- 文字与图片之间间隔 **1.5 ~ 2.5 秒**
- 群与群之间间隔 **2 ~ 5 秒**
- 命令回复前延迟 **0.5 ~ 1.5 秒**
- 同一分店、同一群、相同内容 **5 分钟内不重复发送**

## XP Hook 版本

`xp-bot/` 目录是基于 `wechaty-puppet-xp` 的 Windows 版本，通过 Hook 已登录的微信桌面客户端发送，不需要扫码：

```bash
cd xp-bot
npm install
cp .env.example .env
npm start
```

要求：Windows 系统 + 微信客户端 v3.9.2.23，且微信必须一直保持登录。详见 [xp-bot/README.md](xp-bot/README.md)。

## 项目结构

```
wechat-bot-scheduler/
├── cli.js                 # 入口
├── src/
│   ├── index.js           # 机器人主逻辑：分店、定时、群发、命令、热更新
│   └── env-config.js      # .env 解析器（支持跨行文案、\n 转义）
├── images/                # 群发图片目录
├── .env.example           # 配置模板
├── env2.example ~ env4.example
├── xp-bot/                # Windows Hook 版本
│   ├── src/
│   ├── .env.example
│   └── README.md
├── LICENSE.md
└── README.md
```

## 隐私与安全

- `.env`、`env2`、`env3`、`env4` 含真实群名和店主信息，已在 `.gitignore` 中忽略，**不要提交**
- `images/` 下的图片默认也被忽略（可能含商业素材），需要公开再自行调整规则
- `*.memory-card.json` 是登录凭证缓存，已忽略
- 群内命令对机器人所在的**所有群**生效，建议只在可信群使用，或自行加白名单
- 不要把这个项目用于骚扰、营销轰炸等违规用途

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 扫码后提示无法登录 | 微信已限制大部分账号的网页版登录，换号或改用 `xp-bot/` |
| 收不到图片 | 检查图片路径是否存在、大小是否过大；控制台会打印图片加载结果 |
| 文案没有换行 | 看启动日志的文案行数；检查引号是否闭合在最后一行行尾 |
| 定时任务没触发 | 未登录成功时不会创建任务，确认日志里有“登录成功” |

## 免责声明

本项目仅供学习和技术研究使用。使用自动化工具操作微信可能违反平台规则并导致账号受限，风险由使用者自行承担；请遵守当地法律法规和平台条款。

## 致谢与许可

- [Wechaty](https://github.com/wechaty/wechaty) 及其 puppet 生态
- 项目脚手架参考 [wangrongding/wechat-bot](https://github.com/wangrongding/wechat-bot)（MIT）
- 本项目以 MIT 协议开源，详见 [LICENSE.md](LICENSE.md)

---

# English

## Features

- **Scheduled broadcasts** — a daily message plus weekday-specific messages; every time slot gets a random ±3 min offset
- **Text + image** — each message can be paired with one image; text is sent first, then the image
- **Multi-store** — four independent configs (`.env`, `env2`, `env3`, `env4`), each with its own group list and copy
- **Hot reload** — edit a config file, save, and it takes effect without restarting
- **Auto group discovery** — any group where `MASTER_NAME` speaks is added to the broadcast list automatically
- **In-group commands** — `#预览` (preview), `#测试群发` (test), `#群发列表` (list), and more
- **Anti-ban measures** — randomized time slots, randomized send intervals, 5-minute duplicate suppression, room cache
- **Two transports** — default web protocol (cross-platform); `xp-bot/` hooks a Windows WeChat client

## Requirements

- Node.js >= 18
- Default edition: a WeChat account still allowed to log in via WeChat Web (QR login)
- XP edition: Windows + WeChat desktop client **v3.9.2.23**

## Quick start

```bash
git clone <your-repo-url>
cd wechat-bot-scheduler
npm install

cp .env.example .env      # never commit .env
# edit .env: group names, messages, image paths

npm start
```

The console prints a QR-code URL after startup; open it in a browser and scan with WeChat. Scheduled jobs are only created after a successful login.

## Configuration

| Key | Description |
| --- | --- |
| `MASTER_NAME` | Owner's WeChat name/remark; groups where this user speaks are added automatically |
| `ROOM_LIST` | Fixed target groups, comma separated (may be empty) |
| `SCHEDULE_MESSAGE_DAILY` | Daily broadcast copy |
| `SCHEDULE_IMAGE_DAILY` | Daily image path; empty = text only |
| `SCHEDULE_MESSAGE_MON` ~ `FRI` | Monday–Friday special copy |
| `SCHEDULE_IMAGE_MON` ~ `FRI` | Monday–Friday special image |

Image paths may be relative to the project root (`images/monday.jpg`) or absolute. Supported: `.jpg` `.jpeg` `.png` `.gif` `.webp`.

### Multi-store setup

On startup the app looks for `.env`, `env2`, `env3`, `env4` in the project root and loads whichever exist:

```bash
cp env2.example env2
cp env3.example env3
```

Each file is a complete configuration (own group list, copy and images). Delete a file to drop that store.

### Message line breaks

All three formats are supported:

```env
# 1) Multi-line (recommended, WYSIWYG)
SCHEDULE_MESSAGE_DAILY='line one
line two
line three'

# 2) Single line with \n escapes
SCHEDULE_MESSAGE_DAILY='line one\nline two\nline three'

# 3) Single line without quotes
SCHEDULE_MESSAGE_DAILY=Open as usual today
```

Notes:

- Multi-line values must be quoted and the **closing quote must sit at the end of the last line**; otherwise parsing runs to end-of-file (a warning is printed)
- `\n` decoding applies only to `SCHEDULE_MESSAGE_*`; backslashes in image paths are left untouched
- On startup and on hot reload the app prints the line count of each message, e.g. `📄 DAILY:17行 MON:10行 ...`

## Schedule

Every slot is randomly shifted by **±3 minutes**.

### Daily broadcast

Starts at **12:45**, every **25 minutes**, last one at **16:55** (worst case 16:58, before the 17:00 cut-off):

```
12:45  13:10  13:35  14:00  14:25  14:50  15:15  15:40  16:05  16:30  16:55
```

### Weekday special broadcasts

Taking Monday as the example (Tue–Fri are identical with a different day):

| Phase | Time | Cadence |
| --- | --- | --- |
| Evening before | 19:30 – 23:30 | every 30 min |
| Early morning | 00:00 / 00:30 / 01:00 | every 30 min |
| Same-day morning | 07:00 – 10:45 | every 25 min |

The last morning slot is 10:45 (worst case 10:48, before the 11:00 cut-off).

> Monday's copy warms up on Sunday evening; Tuesday's on Monday evening, and so on.

## Hot reload

Edit `.env` / `env2` / `env3` / `env4` and save — the app reloads the config and rebuilds the schedules:

```
📝 detected change in .env, reloading...
✅ config loaded
🔄 schedules rebuilt
```

> Hot reload covers **configuration only**, not source code. Restart `npm start` after changing code.

## In-group commands

Send in any group the bot has joined:

| Command | Description |
| --- | --- |
| `#添加群发` | Add the current group to this store's broadcast list |
| `#移除群发` | Remove the current group from the list |
| `#群发列表` | Show the current broadcast list |
| `#测试群发` | Send a test message to all groups of this store |
| `#预览` | Preview today's actual message (with line count) in this group |
| `#刷新配置` | Manually reload all store configs |
| `#帮助` | Show help |

## Send pacing

- Text → image delay: **1.5 – 2.5 s**
- Group → group delay: **2 – 5 s**
- Command reply delay: **0.5 – 1.5 s**
- Same content to the same group is suppressed for **5 minutes**

## XP hook edition

`xp-bot/` uses `wechaty-puppet-xp` to hook an already-logged-in Windows WeChat desktop client, so no QR scan is needed:

```bash
cd xp-bot
npm install
cp .env.example .env
npm start
```

Requires Windows + WeChat desktop v3.9.2.23, and WeChat must stay logged in. See [xp-bot/README.md](xp-bot/README.md).

## Project layout

```
wechat-bot-scheduler/
├── cli.js                 # entry point
├── src/
│   ├── index.js           # bot logic: stores, schedules, sending, commands, hot reload
│   └── env-config.js      # .env parser (multi-line copy, \n escapes)
├── images/                # broadcast images
├── .env.example           # config template
├── env2.example ~ env4.example
├── xp-bot/                # Windows hook edition
├── LICENSE.md
└── README.md
```

## Privacy & security

- `.env`, `env2`, `env3`, `env4` contain real group names and owner info; they are git-ignored — **never commit them**
- Files under `images/` are ignored by default (may be private assets); relax the rule only if you intend to publish them
- `*.memory-card.json` holds login credentials and is ignored
- In-group commands work in **every group** the bot has joined; use it only in trusted groups or add your own allow-list
- Do not use this project for spam or any activity that violates platform rules

## FAQ

| Symptom | Fix |
| --- | --- |
| QR login rejected | WeChat restricts Web login for most accounts; use another account or the `xp-bot/` edition |
| Image not delivered | Check the path exists and the file is not too large; the console logs image loading results |
| Message has no line breaks | Check the line counts in the startup log; make sure the closing quote is on the last line |
| Schedules never fire | Jobs are created only after login succeeds — look for the login log line |

## Disclaimer

This project is for learning and research only. Automating WeChat may violate platform rules and lead to account restrictions; you use it at your own risk. Follow local laws and the platform's terms of service.

## Credits & license

- [Wechaty](https://github.com/wechaty/wechaty) and its puppet ecosystem
- Scaffolding inspired by [wangrongding/wechat-bot](https://github.com/wangrongding/wechat-bot) (MIT)
- Released under the MIT license, see [LICENSE.md](LICENSE.md)
