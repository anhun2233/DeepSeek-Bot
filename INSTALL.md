# Install both plugins

English | [中文](#中文)

This repository holds two DeepSeek Harness (DSH) plugins:

| Directory | Package | Version in this tree |
| --- | --- | --- |
| [`ds-bot/`](ds-bot/) | `ds-bot` | 0.2.1 |
| [`dsh-purge/`](dsh-purge/) | `dsh-purge-community` | 1.6.50 |

`dsh-purge/` is an unedited snapshot. The pin, the MIT license, and attribution to [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge) tag `v1.6.50` (the same commit as [anhun2233/dsh-purge](https://github.com/anhun2233/dsh-purge)) are in [NOTICE](NOTICE). Copyright (c) 2026 小杨. The package notice also names the original project [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge).

DS Bot's **No preset · open tools** (无预设 · 放开工具) mounts a preset that is already installed and leaves that preset's persona off. You write the persona in the Bot's settings. The preset text, including `unrestricted` and `redteam`, stays in `dsh-purge/`. It is not copied into `ds-bot/`.

The desktop app in `app/` ships DS Bot only. Use the steps below to add Purge Community to a DSH profile.

## One command

Requires Node.js 22 or later and npm. From a clone of this repository:

```sh
bash scripts/install-into-dsh.sh
```

```powershell
powershell -File scripts/install-into-dsh.ps1
```

The same program is `node scripts/install-into-dsh.mjs`.

What it does:

1. Runs `npm pack` in `dsh-purge/`, then in `ds-bot/`. Package lifecycle scripts are not run.
2. Writes both `.tgz` files to `dist/plugins/` (gitignored).
3. Writes `dist/plugins/ADD.txt` and `dist/plugins/manifest.json` next to them.
4. Prints each filename, its path, its sha256, and the add steps below.

Check the printed package names: `dsh-purge-community` first, then `ds-bot`.

### Add the tarballs in DSH

Add **dsh-purge-community** first, then **ds-bot**, so the presets exist when DS Bot lists them.

**Plugins page** (DSH Desktop and DSH Web):

1. Sidebar → **Plugins** → **Add plugin**.
2. **Package name or address**: paste the path of the `dsh-purge-community-….tgz` file the script printed.
3. **Install**, then **Enable now**.
4. Repeat for `ds-bot-….tgz`.
5. If DSH says the change takes effect at the next start, quit DSH completely and open it again.

**CLI**, when the `dsh` command is already on PATH. `<profile>` is the profile name this DSH already uses: `web` for the Web profile this repository documents, `desktop` for DSH Desktop. Pass that name; a filesystem path is not a profile.

```sh
dsh plugin --profile <profile> add "<path-to-dsh-purge-community.tgz>"
dsh plugin --profile <profile> add "<path-to-ds-bot.tgz>"
```

This repository's Docker image uses the same command: `dsh plugin --profile web add <tarball>`.

When `dsh` is not on PATH, the documented CLI in the DS Bot readme is:

```sh
npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile <profile> add "<path-to-tarball>"
```

`0.2.1-rc.2` is the DSH version in `ds-bot/dev/harness/package.json`. Run it once per tarball, Purge Community first.

To have this script call `dsh plugin add` itself:

```sh
bash scripts/install-into-dsh.sh --install --profile=web
```

`--profile` is required with `--install`. If `dsh` is not on PATH, the script still leaves the tarballs in place and exits with status 2. `--dsh=<command>` selects a dsh executable by name or path you already know. The script does not choose a data directory and does not download DSH.

### After both are enabled

Quit and reopen DSH if it asked for a restart. Open a Bot's settings. **No preset · open tools** is listed when another usable preset is installed. It mounts one of those presets and leaves that persona off. The default source is `unrestricted` when that id is installed. Write the persona in the settings field. Saving creates `$DSH_HOME/bot/personas/<bot id>/persona.md`.

## Install one package

**DS Bot only.** Desktop app, npm name `ds-bot`, or a packed tarball: [README.md](README.md#install) and [README.zh.md](README.zh.md#安装). Plugin options: [ds-bot/README.md](ds-bot/README.md).

**Purge Community only.** Pack it with the script above and add only `dsh-purge-community-….tgz`, or follow that package's own guide: [dsh-purge/README.md](dsh-purge/README.md), [dsh-purge/README.zh-CN.md](dsh-purge/README.zh-CN.md), [dsh-purge/docs/INSTALLATION.md](dsh-purge/docs/INSTALLATION.md).

`dsh-purge/scripts/install.sh` and `dsh-purge/scripts/install.ps1` are that project's installer. They download a GitHub release from kingcharleslzy-ai/dsh-purge. They are not the monorepo command. Use them when you want that release flow. Use `scripts/install-into-dsh.*` when the plugins should come from this clone.

There is no npm install of the bare name `dsh-purge-community` in this flow. DSH receives the tarball path, which is the source that package documents for its own releases (`dsh plugin add <tarball>`).

## For an agent

1. Clone this repository. Do not invent a DSH home path, a profile directory, or a machine path.
2. Run `bash scripts/install-into-dsh.sh` (or the PowerShell script).
3. Read the printed paths. Add the two tarballs in the order printed, Purge Community first.
4. Prefer the Plugins page when the profile name is unknown. Use `dsh plugin --profile <name> add <tarball>` only with the profile name the user already has (`web` or `desktop`).
5. Do not copy preset text out of `dsh-purge/` into DS Bot, into a persona file, or into another document. The open-tools mode mounts the installed preset id and drops its persona.
6. Do not edit files under `dsh-purge/`. A newer Purge Community is a new snapshot plus an updated pin in `NOTICE`.

## 中文

本仓库有两个 DeepSeek Harness（dsh）插件：`ds-bot/`（包名 `ds-bot`，0.2.1）和 `dsh-purge/`（包名 `dsh-purge-community`，1.6.50）。

`dsh-purge/` 是未改过的快照。钉住的提交、MIT 许可，以及对 [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge) 标签 `v1.6.50` 的署名（与 [anhun2233/dsh-purge](https://github.com/anhun2233/dsh-purge) 同一次提交）写在 [NOTICE](NOTICE)。Copyright (c) 2026 小杨。包内说明还记下原项目 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)。

DS Bot 的 **无预设 · 放开工具** 挂上一个已经安装的预设，并去掉该预设的人设。人设在 Bot 的设置里写。预设原文（包括 `unrestricted` 和 `redteam`）只在 `dsh-purge/`，不复制进 `ds-bot/`。

`app/` 里的桌面应用只带 DS Bot。Purge Community 按下面的步骤加进 dsh 的 profile。

### 一条命令

需要 Node.js 22 或更新版本，以及 npm。在本仓库的克隆里：

```sh
bash scripts/install-into-dsh.sh
```

```powershell
powershell -File scripts/install-into-dsh.ps1
```

它会：

1. 在 `dsh-purge/` 再在 `ds-bot/` 里执行 `npm pack`。不运行包的生命周期脚本。
2. 把两个 `.tgz` 写到 `dist/plugins/`（已被 git 忽略）。
3. 在旁边写下 `ADD.txt` 和 `manifest.json`。
4. 打印文件名、路径、sha256，以及下面的添加步骤。

先看到 `dsh-purge-community`，然后是 `ds-bot`。

### 在 dsh 里添加

先加 **dsh-purge-community**，再加 **ds-bot**，这样 DS Bot 列出预设时它们已经注册。

**插件页**（dsh Desktop 和 dsh Web）：

1. 侧栏 → **插件** → **添加插件**。
2. **包名或地址**：粘贴脚本打印的 `dsh-purge-community-….tgz` 路径。
3. **安装**，然后 **立即启用**。
4. 对 `ds-bot-….tgz` 再做一次。
5. 如果 dsh 说下次启动生效，完全退出 dsh 再打开。

**命令行**。本机 PATH 里已有 `dsh` 时使用。`<profile>` 是这个 dsh 已经在用的 profile 名：本仓库文档里的 Web 是 `web`，Desktop 是 `desktop`。填这个名字，不要填文件夹路径。

```sh
dsh plugin --profile <profile> add "<dsh-purge-community 压缩包路径>"
dsh plugin --profile <profile> add "<ds-bot 压缩包路径>"
```

本仓库的 Docker 镜像用的是同一条命令：`dsh plugin --profile web add <压缩包>`。

PATH 里没有 `dsh` 时，DS Bot 说明里的命令是：

```sh
npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile <profile> add "<压缩包路径>"
```

`0.2.1-rc.2` 是 `ds-bot/dev/harness/package.json` 里的 dsh 版本。每个压缩包跑一次，先 Purge Community。

让脚本自己调用 `dsh plugin add`：

```sh
bash scripts/install-into-dsh.sh --install --profile=web
```

`--install` 必须带 `--profile`。PATH 里没有 `dsh` 时，压缩包仍然留在原地，脚本以状态 2 退出。`--dsh=<命令>` 用来指定你已经知道的 dsh 可执行文件。脚本不挑选数据目录，也不下载 dsh。

### 两个都启用之后

如果 dsh 要求重启，退出后重新打开。打开某个 Bot 的设置。装了别的可用预设时会出现 **无预设 · 放开工具**。它挂上其中一个预设，并去掉其人设。装了 `unrestricted` 时默认用这个 id。在设置里写下人设。保存后会生成 `$DSH_HOME/bot/personas/<bot id>/persona.md`。

### 只装一个

**只装 DS Bot。** 桌面应用、npm 包名 `ds-bot`，或打好的压缩包：[README.zh.md](README.zh.md#安装) 和 [README.md](README.md#install)。插件配置见 [ds-bot/README.md](ds-bot/README.md)。

**只装 Purge Community。** 用上面的脚本，只添加 `dsh-purge-community-….tgz`，或按该包自己的说明：[dsh-purge/README.zh-CN.md](dsh-purge/README.zh-CN.md)、[dsh-purge/README.md](dsh-purge/README.md)、[dsh-purge/docs/INSTALLATION.md](dsh-purge/docs/INSTALLATION.md)。

`dsh-purge/scripts/install.sh` 和 `dsh-purge/scripts/install.ps1` 是那个项目自己的安装器，会从 kingcharleslzy-ai/dsh-purge 下载 GitHub Release。那不是本仓库的一条命令。要走它的发行流程再用它。插件要从这份克隆来，就用 `scripts/install-into-dsh.*`。

这条流程不执行 `npm install` 裸包名 `dsh-purge-community`。dsh 收到的是压缩包路径，也就是该包为自己的发行记录的来源（`dsh plugin add <压缩包>`）。

### 给 Agent

1. 克隆本仓库。不要编造 dsh 的数据目录、profile 目录或某台电脑上的路径。
2. 运行 `bash scripts/install-into-dsh.sh`（或 PowerShell 脚本）。
3. 读它打印的路径。按打印的顺序添加两个压缩包，先 Purge Community。
4. 不知道 profile 名时用插件页。只有用户已经在用的 profile 名（`web` 或 `desktop`）才使用 `dsh plugin --profile <name> add <压缩包>`。
5. 不要把 `dsh-purge/` 里的预设原文抄进 DS Bot、人设文件或其他文档。放开工具只挂已安装预设的 id，并去掉其人设。
6. 不要改 `dsh-purge/` 里的文件。更新 Purge Community 时换成新快照，并改 `NOTICE` 里的钉扎。
