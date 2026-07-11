# 用户使用说明

## 1. 安装

需要 Node.js 18+、Git 和 pnpm。

推荐克隆方式：

```powershell
git clone --recurse-submodules https://github.com/LoranaAurelia/CloudmusicMCP.git
cd CloudmusicMCP
.\install.ps1
```

也可以在 GitHub 点击 **Code → Download ZIP**。解压后运行 `install.ps1`，脚本会自动下载官方 `api-enhanced` 后端。

## 2. 登录网易云

双击 `login.bat`，使用网易云音乐 App 扫描终端二维码并在手机确认。登录信息只保存在本机 `data/session.json`，不要分享或提交该文件。

## 3. 后端与 MCP

MCP 启动时会自动启动后端，退出时只关闭由它自己启动的后端。也可手动使用：

```text
backend-start.bat
backend-status.bat
backend-stop.bat
```

默认后端地址为 `http://127.0.0.1:3300`。可复制 `.env.example` 为 `.env` 调整端口。

安装脚本会尝试把 stdio MCP 注册为 `cloudmusic`。重新打开 Codex 后即可使用。

## 4. 常用能力

可以直接让 Agent：

- 搜索歌曲并核对歌曲、歌手和专辑。
- 查看自己的歌单与完整曲序。
- 创建、改名或管理歌单。
- 给歌单增删歌曲、调整歌曲顺序。
- 批量读取红心 ID、歌曲详情、艺人发行、相似歌曲和专辑曲目。

删除歌单要求显式确认。批量加歌会自动检查网易云的顺序反转，并在安全时修复后回读验证。

## 5. Skills 触发方式

### 推荐并创建歌单

```text
$netease-music-curator 推荐 10 首偏暗的 Artcore，女声优先，帮我创建私密歌单。
```

也可用自然语言明确要求“推荐多少首并创建歌单”。该 Skill 不会自动运行。

### 同步反馈

```text
$netease-music-feedback 同步红心和我登记的受管歌单反馈。
```

它只读网易云并更新本地状态，不会创建、删改歌单或取消红心。

### 审计推荐质量

```text
$netease-music-audit 检查最近推荐的重复、集中度、证据和反馈漂移。
```

审计只生成本地报告，不修改网易云数据。

## 6. 自定义偏好

复制 `config/recommender.example.json` 为 `data/recommender-config.json`，再填写自己的偏好与排除项。`data/` 已加入忽略规则，不会被 Git 提交。
