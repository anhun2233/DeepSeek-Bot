#!/usr/bin/env node
// Pack ds-bot and dsh-purge-community from this repository.
// Prints the DSH add steps. With --install --profile=<name>, also runs
// `dsh plugin add` when the dsh command is already on PATH.
// Lifecycle scripts stay off so packing does not download or build.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { accessSync, constants, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packages = [
  { dir: 'dsh-purge', name: 'dsh-purge-community' },
  { dir: 'ds-bot', name: 'ds-bot' },
]

const help = `Pack both plugins in this repository and print how to add them to DeepSeek Harness.

Usage:
  node scripts/install-into-dsh.mjs
  bash scripts/install-into-dsh.sh
  powershell -File scripts/install-into-dsh.ps1

Options:
  --out=<dir>         Where to write the tarballs. Default: dist/plugins
  --install           Also run: dsh plugin --profile <name> add <tarball>
  --profile=<name>    Required with --install. The profile DSH already uses
                      (web or desktop). A profile name, not a filesystem path.
  --dsh=<command>     dsh executable to use with --install. Default: dsh on PATH.
  --help              Show this help.

The script packs dsh-purge-community first, then ds-bot. It does not read or
change a DSH profile unless --install is set and the dsh command runs.
See INSTALL.md.
`

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function parseArgs(argv) {
  const out = {
    install: false,
    profile: '',
    dsh: '',
    outDir: join(root, 'dist', 'plugins'),
    help: false,
  }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--install') out.install = true
    else if (arg.startsWith('--profile=')) out.profile = arg.slice('--profile='.length)
    else if (arg.startsWith('--dsh=')) out.dsh = arg.slice('--dsh='.length)
    else if (arg.startsWith('--out=')) out.outDir = resolve(arg.slice('--out='.length))
    else fail(`Unknown argument: ${arg}\n\n${help}`, 2)
  }
  return out
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function documentedDshVersion() {
  try {
    const pkg = readJson(join(root, 'ds-bot', 'dev', 'harness', 'package.json'))
    const version = pkg.dependencies?.['@deepseek-ai/dsh']
    if (typeof version === 'string' && version !== '') return version
  } catch {
    // The harness manifest is for tests. The README names the same release.
  }
  return '0.2.1-rc.2'
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function commandOnPath(name) {
  const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path')
  const parts = (process.env[pathKey] ?? '').split(process.platform === 'win32' ? ';' : ':')
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : ['']
  for (const dir of parts) {
    if (dir === '') continue
    for (const ext of exts) {
      const candidate = join(dir, name + ext)
      try {
        accessSync(candidate, constants.F_OK)
        return candidate
      } catch {
        // Keep looking.
      }
    }
  }
  return ''
}

function npmPack(dir, outDir) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', outDir], {
    cwd: join(root, dir),
    encoding: 'utf8',
  })
  if (result.error) fail(`Could not run npm in ${dir}: ${result.error.message}`)
  if (result.status !== 0) {
    fail(`npm pack failed in ${dir} (exit ${result.status ?? 'signal'}).\n${result.stderr || result.stdout || ''}`)
  }
  const start = result.stdout.indexOf('[')
  if (start < 0) fail(`npm pack in ${dir} did not return JSON.\n${result.stdout}`)
  let parsed
  try {
    parsed = JSON.parse(result.stdout.slice(start))
  } catch (error) {
    fail(`npm pack in ${dir} returned JSON that could not be read: ${error.message}`)
  }
  const row = Array.isArray(parsed) ? parsed[0] : null
  if (!row?.filename || !row.name || !row.version) fail(`npm pack in ${dir} returned an unexpected result.`)
  return row
}

function clearOldTarballs(outDir) {
  let names = []
  try {
    names = readdirSync(outDir)
  } catch {
    return
  }
  for (const name of names) {
    if (/^(ds-bot|dsh-purge-community)-.+\.tgz$/.test(name)) rmSync(join(outDir, name))
  }
}

function showPath(path) {
  const fromRoot = relative(root, path)
  if (fromRoot === '' || fromRoot.startsWith('..') || fromRoot.startsWith('/')) return path
  return fromRoot.split('\\').join('/')
}

function instructions(packed, version) {
  const lines = []
  lines.push('Packed both plugins from this repository.')
  lines.push('Add dsh-purge-community first, then ds-bot.')
  lines.push('')
  for (const item of packed) {
    lines.push(`${item.name} ${item.version}`)
    lines.push(`  file: ${item.filename}`)
    lines.push(`  path: ${item.path}`)
    lines.push(`  sha256: ${item.sha256}`)
    lines.push('')
  }
  lines.push('DSH Plugins page')
  lines.push('  1. Sidebar → Plugins → Add plugin.')
  lines.push('  2. Package name or address: paste the path of the dsh-purge-community tarball above.')
  lines.push('  3. Install, then Enable now.')
  lines.push('  4. Repeat for the ds-bot tarball.')
  lines.push('  5. If DSH says the change takes effect at the next start, quit DSH completely and open it again.')
  lines.push('')
  lines.push('DSH CLI, when the dsh command is on PATH. <profile> is the profile this DSH already uses (web or desktop):')
  for (const item of packed) {
    lines.push(`  dsh plugin --profile <profile> add "${item.path}"`)
  }
  lines.push('')
  lines.push(`Same subcommand through npx when dsh is not on PATH (DSH ${version}, the version this repository's tests use):`)
  for (const item of packed) {
    lines.push(`  npx @deepseek-ai/dsh@${version} plugin --profile <profile> add "${item.path}"`)
  }
  lines.push('')
  lines.push('After DSH is open again: Bot settings → No preset · open tools.')
  lines.push('That mode mounts an installed preset (unrestricted when that id is installed) and leaves its persona off.')
  lines.push('Write the persona in DS Bot. The preset text stays in the dsh-purge-community package.')
  lines.push('')
  lines.push('One package at a time: add only the tarball you need, in the same Plugins page or with the same dsh command.')
  lines.push('Purge Community\'s own scripts/install.sh downloads an upstream GitHub release. This script packs the snapshot in this repository.')
  return lines.join('\n')
}

function validProfile(profile) {
  return /^[A-Za-z0-9._-]+$/.test(profile)
}

function installWithDsh(dshBin, profile, packed) {
  for (const item of packed) {
    console.log(`\n$ ${dshBin} plugin --profile ${profile} add ${item.path}`)
    const result = spawnSync(dshBin, ['plugin', '--profile', profile, 'add', item.path], { stdio: 'inherit' })
    if (result.error) fail(`Could not run dsh: ${result.error.message}`)
    if (result.status !== 0) fail(`dsh plugin add failed for ${item.name} (exit ${result.status ?? 'signal'}).`, result.status || 1)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(help)
    return
  }
  if (args.install && !validProfile(args.profile)) {
    fail('--install needs --profile=<name>, a DSH profile name such as web or desktop.\nA filesystem path is not a profile name.', 2)
  }

  for (const item of packages) {
    const pkg = readJson(join(root, item.dir, 'package.json'))
    if (pkg.name !== item.name) fail(`${item.dir}/package.json name is "${pkg.name}", expected "${item.name}".`)
  }

  mkdirSync(args.outDir, { recursive: true })
  clearOldTarballs(args.outDir)

  const packed = []
  for (const item of packages) {
    const row = npmPack(item.dir, args.outDir)
    if (row.name !== item.name) fail(`npm pack of ${item.dir} produced "${row.name}", expected "${item.name}".`)
    const path = join(args.outDir, row.filename)
    packed.push({
      name: row.name,
      version: row.version,
      filename: row.filename,
      path,
      sha256: sha256(path),
    })
  }

  const text = `${instructions(packed, documentedDshVersion())}\n`
  writeFileSync(join(args.outDir, 'ADD.txt'), text)
  const manifest = {
    outDir: showPath(args.outDir),
    packages: packed.map(item => ({
      name: item.name,
      version: item.version,
      file: item.filename,
      sha256: item.sha256,
    })),
  }
  writeFileSync(join(args.outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(text)

  if (!args.install) {
    console.log('Packed only. Re-run with --install --profile=<web|desktop> to call dsh plugin add.')
    return
  }

  const dshBin = args.dsh || commandOnPath('dsh')
  if (dshBin === '') {
    console.error('The dsh command is not on PATH. The tarballs above are ready.')
    console.error('Add them from Plugins → Add plugin, or install the DSH CLI and re-run with --install.')
    process.exit(2)
  }
  installWithDsh(dshBin, args.profile, packed)
  console.log('\nBoth plugins were passed to dsh plugin add.')
  console.log('If DSH says the change takes effect at the next start, quit DSH completely and open it again.')
}

main()
