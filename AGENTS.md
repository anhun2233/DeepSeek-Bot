# AGENTS.md

Instructions for AI coding agents that work on this repository. Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md), which has the same rules with more detail.

## What this project is

DS Bot is a team of long-lived Bots, built on DeepSeek Harness (DSH). This repository is a monorepo of that plugin, the desktop app, and a vendored copy of the dsh-purge community plugin:

- `ds-bot/`: the Bot features, written as a DSH plugin. The plugin runs in DSH Desktop, in DSH Web and in the desktop app. Package name `ds-bot`.
- `app/`: the desktop app for Windows, macOS and Linux. It runs a pinned DSH with the `ds-bot` plugin, in its own profile and its own `DSH_HOME`, and imports an existing team from the user's DSH. It does not bundle dsh-purge.
- `dsh-purge/`: Purge Community (`dsh-purge-community` 1.6.50), copied unchanged from the pinned commit in [NOTICE](NOTICE). Its preset text stays in that directory. DS Bot does not copy it.

The Bot team:

- Every Bot is a long-lived identity whose work runs in DSH Sessions: one for its own chat, one for each group it is in, and a fresh one when the context fills up (earlier ones stay readable). Every turn runs through the normal DSH agent loop, tools and model routes.
- The team works together: Bots message each other, share group chats and can see what the other Bots are doing. Each Bot still runs on its own and does not disturb the others.
- Bots have clear, different roles. A Main Bot has the highest rights: it creates, changes and removes other Bots. Other Bots do not get these rights. There can be more than one Main Bot.
- Users customize each Bot (name, role label, instructions, model, character).
- Behavior must be reliable: a Bot acts on evidence, stays inside its goal, and its results can be checked.

## Install both plugins

From the repository root:

```sh
bash scripts/install-into-dsh.sh
```

Windows:

```powershell
powershell -File scripts/install-into-dsh.ps1
```

The script packs `dsh-purge-community` and `ds-bot` into `dist/plugins/` and prints the DSH add steps. It leaves every DSH profile untouched unless you also pass `--install --profile=<name>` and the `dsh` command is on PATH. `<name>` is the profile that DSH is already using (`web` or `desktop`). The full steps are in [INSTALL.md](INSTALL.md).

Leave `dsh-purge/` byte-identical to the pinned release. Replace the snapshot to update it. DS Bot's open-tools mode mounts an installed preset id and strips that persona at prompt time; it does not contain the preset text.

## Hard rules

1. **Build on DSH; never patch it.** Bot features use the documented plugin APIs. The desktop app starts DSH only through its documented entry points (`@deepseek-ai/dsh/profile-boot`, the `dsh` CLI). Never patch DeepSeek Harness or depend on files inside a DSH install. If something is missing in DSH, stop and say so; do not work around it with a patch.
2. **No secrets.** Never write, print or commit API keys, tokens, cookies or `DSH_HOME` contents. Use the mock model (`ds-bot/dev/mock-llm.mjs`) for tests; it needs no key.
3. **Only original material.** Do not copy code, text, icons, logos or graphics from other products or websites. Code under a license compatible with Apache 2.0 is the only exception: say where it comes from and add its notice to the `NOTICE` file. `dsh-purge/` is that exception (MIT). Do not edit the snapshot in place.
4. **`client.js` is generated.** Change `ds-bot/src/client/`, then run `npm run build` and commit both files. Never edit `client.js` by hand.
5. **Do not touch the user's own DSH data.** The desktop app keeps its data in its own `DSH_HOME`; its import only reads `~/.dsh` and never writes there. The test bench keeps its data in `.dsh-test-<name>/`. Never point a test at `~/.dsh`, at the desktop app's data or at a DSH that the user runs.

## Commands

Run in `ds-bot/`. The unit tests and the linter load the `@deepseek-ai/*` packages from `dev/harness/`, which `npm run harness` installs from npm at the DSH version in `dev/harness/package.json`. `DSH_HARNESS` points them at another install or at a DeepSeek Harness checkout instead. The test bench needs a checkout at `../deepseek-harness` (or `DSH_HARNESS`), at the DSH version in the README.

```sh
npm ci                                 # build tool only (esbuild)
npm run harness                        # once: the DSH packages for the tests and the linter
npm run build                          # src/client → client.js
npm test                               # unit tests; also fail if client.js is stale
node scripts/build-client.mjs --check  # client.js matches src/client
npm run lint                           # oxlint
CONTEXT_WINDOW=100000 CHECK_RATIO=0.45 dev/bench.sh smoke 3096 8796 reset && node dev/smoke.mjs smoke 3096   # smoke test
dev/bench.sh smoke 3096 8796 stop
```

A change is done when `npm test`, the `--check` and `npm run lint` pass; CI runs them on every pull request. Run the smoke test as well for changes to `index.js` or `src/host/`. Use a free port for each bench, and stop every bench and process that you started.

## Branches, pull requests and issues

The full workflow is in [CONTRIBUTING.md](CONTRIBUTING.md#how-we-work). The parts that an agent must follow:

- Start work from the latest `dev` on a branch named `fix/<issue>-<name>`, `feat/<issue>-<name>`, `docs/<name>` or `chore/<name>`. Never start a branch name with `dev/`. Open the pull request into `dev`, not `main`; only releases and hotfixes go into `main`.
- Bring a branch up to date with `git merge dev`. Never rebase a pushed branch and never force-push.
- Fill in the pull request template. Link the issue with `Fixes #<number>`; a bug fix names the bug it fixes. Write the user-visible change in the Changelog field, and do not edit `CHANGELOG.md`.
- Do not start work on an issue or pull request with the `maintainer` label; it waits for the maintainer. Do not take an issue that someone else is assigned to.
- Before you change behavior, read the design for it in `docs/plans/` (and `docs/vision.md`); for interface work also `docs/design/ui-standard.md`. A change to a decided design needs the maintainer; a new large feature adds its design note to the same pull request.
- Do not close an issue without evidence: the pull request or commit that fixed it, the issue it duplicates, or the reason it will not be fixed.
- To triage issues, follow [.agents/skills/issue-triage/SKILL.md](.agents/skills/issue-triage/SKILL.md).
- To record a demonstration GIF for an interface change, follow [.agents/skills/record-browser-gif/SKILL.md](.agents/skills/record-browser-gif/SKILL.md).

## Layout

- `ds-bot/index.js` and `ds-bot/src/host/`: the server side (roster and store, tools, turns and delivery, groups, conversation parts and the search index, images, the browser bridge, the `api/bot` channel).
- `ds-bot/src/client/`: the browser side (sidebar, chat, panels, themes, characters, the Bot browser panel).
- `ds-bot/web-search.js`: the `auto` web-search provider, independent of the Bot team code.
- `ds-bot/test/`: unit tests and fixtures. `ds-bot/dev/`: the DSH packages for the tests (`harness/`), mock model, test bench, smoke test, character generator, Desktop scripts for Linux.
- `app/`: the desktop app (Electron main process and window, first-run setup and import, installer and updates).
- `dsh-purge/`: vendored Purge Community snapshot (package `dsh-purge-community`). Attribution and the pinned commit are in `NOTICE`.
- `scripts/install-into-dsh.mjs`: packs both plugins. `scripts/install-into-dsh.sh` and `scripts/install-into-dsh.ps1` call it.

## Style

- Follow the code around your change. Keep functions small and names plain.
- Write a comment only when the reason is not clear from the code: a hidden constraint, an invariant, a workaround. Do not describe what the code does.
- Commit messages in English, imperative subject, the reason in the body. Keep commits small.
- The person who asked for the change is the commit author. Do not set an AI agent or bot as author or committer, and do not add `Co-authored-by` lines for one.
- User-facing text in the plugin is English. Keep the README and README.zh.md in step when you change one of them.
