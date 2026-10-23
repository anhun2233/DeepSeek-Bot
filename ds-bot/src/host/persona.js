// The user's persona document for one Bot. Instructions stay the short job line in
// the team record (a Bot may change that with update_bot). This file is the longer
// description only the user edits, in settings or in the file itself.
//
//   $DSH_HOME/bot/personas/<bot id>/persona.md
//
// when the team home is the default `$DSH_HOME/bot`. A custom `home` keeps the same
// `personas/<bot id>/persona.md` under that directory.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { replaceFile } from './files.js'

export const PERSONA_MAX = 100_000
const FILE = 'persona.md'

// Session ids are safe path segments. Anything else is folded so a strange id
// cannot escape the personas directory.
export function personaKey(botId) {
  const id = String(botId ?? '')
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(id)) return id
  return `b-${createHash('sha256').update(id).digest('hex').slice(0, 32)}`
}

export function install(rt) {
  const dirOf = botId => join(rt.home, 'personas', personaKey(botId))
  const fileOf = botId => join(dirOf(botId), FILE)

  // A path the settings page can show. Never an absolute path. Under the default
  // team home this is `bot/personas/<bot id>/persona.md` relative to the DSH home.
  function personaWhere(botId) {
    const fromDsh = relative(rt.dshHome, fileOf(botId)).split('\\').join('/')
    if (fromDsh !== '' && !fromDsh.startsWith('..') && !fromDsh.startsWith('/')) return fromDsh
    return `personas/${personaKey(botId)}/${FILE}`
  }

  function personaText(botId) {
    let text
    try {
      text = readFileSync(fileOf(botId), 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return ''
      rt.warn('ds-bot: persona for %s not read: %s', botId, error)
      return ''
    }
    return text.length > PERSONA_MAX ? text.slice(0, PERSONA_MAX) : text
  }

  async function readPersona(botId) {
    if (rt.botOf(botId) === undefined) throw new Error('Unknown Bot')
    return { text: personaText(botId), path: personaWhere(botId) }
  }

  async function writePersona(botId, text) {
    if (rt.botOf(botId) === undefined) throw new Error('Unknown Bot')
    const readOnly = rt.readOnly?.()
    if (readOnly !== undefined) throw new Error(readOnly)
    const body = String(text ?? '')
    if (body.length > PERSONA_MAX) throw new Error(`A persona document can be at most ${PERSONA_MAX} characters`)
    const file = fileOf(botId)
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, body, 'utf8')
    await replaceFile(temp, file)
    return { text: body, path: personaWhere(botId) }
  }

  async function copyPersona(fromId, toId) {
    const text = personaText(fromId)
    if (text === '') return
    await writePersona(toId, text)
  }

  async function archivePersona(botId) {
    const dir = dirOf(botId)
    const dest = join(rt.home, 'personas', 'archive', `${personaKey(botId)}-${Date.now()}`)
    try {
      await mkdir(dirname(dest), { recursive: true })
      await rename(dir, dest)
    } catch (error) {
      if (error?.code === 'ENOENT') return
      rt.warn('ds-bot: persona of %s not archived: %s', botId, error)
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  Object.assign(rt, { personaText, personaWhere, readPersona, writePersona, copyPersona, archivePersona })
}
