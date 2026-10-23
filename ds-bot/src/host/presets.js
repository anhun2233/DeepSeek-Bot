// Agent presets. A Bot Session is created on one preset from the registry DSH already
// has (`agentPresets.list`), so a preset another plugin registered is offered with the
// ones DSH ships. Nothing here names a third-party preset or copies its text.
//
// A Session keeps the preset it was made with, and DSH will only `select` another
// while that Session is still blank. After the first turn, a change continues in a
// fresh part (`parts.js`). `blankTools` mounts that preset so its tools stay, and
// drops its persona text at assembly time (`prompt.js`), so the user's persona
// document is the only persona. The Bot's permission preset is unchanged.
export const DEFAULT_PRESET = 'standard'

const LOCKED = 'agent-preset/locked'
const MISSING = new Set(['agent-preset/not-found', 'agent-preset/invalid'])

export function personaReplacesPrompt(yaml) {
  if (typeof yaml !== 'string') return false
  const match = /name:\s*['"]?@deepseek-ai\/dsh-persona['"]?([\s\S]{0,600})/.exec(yaml)
  if (match === null) return false
  const block = match[1].split(/\n\s*- id:/)[0]
  return /\n\s*complete:\s*true\b/.test(`\n${block}`)
}

export function boundPreset(ctx, agent) {
  const projected = ctx.get?.('sessionProjections')?.stateOf?.(agent?.session, 'agentPreset')
  if (typeof projected === 'string' && projected !== '') return projected
  const header = agent?.session?.header?.agentPreset
  return typeof header === 'string' && header !== '' ? header : undefined
}

const lockedPreset = error => error?.code === LOCKED || /already started/i.test(String(error?.message ?? ''))
export const missingPreset = error => MISSING.has(error?.code) || /\bunknown agent preset\b/i.test(String(error?.message ?? ''))

export function install(rt) {
  const { ctx } = rt
  // null until the first read, so a note is not shown before DSH has been asked.
  let rows = null
  let complete = new Set()

  const service = () => {
    const presets = ctx.get?.('agentPresets')
    return typeof presets?.list === 'function' ? presets : undefined
  }
  const usable = id => (rows ?? []).some(row => row.id === id && row.broken === undefined)

  async function refreshPresets({ fresh = false } = {}) {
    if (!fresh && rows !== null) return
    const presets = service()
    if (presets === undefined) {
      rows = []
      complete = new Set()
      return
    }
    try {
      rows = await presets.list()
    } catch (error) {
      rows = []
      complete = new Set()
      rt.warn('ds-bot: agent presets could not be listed: %s', error)
      return
    }
    const next = new Set()
    if (typeof presets.readDocument === 'function') {
      await Promise.all((rows ?? []).filter(row => row.broken === undefined).map(async (row) => {
        try {
          const doc = await presets.readDocument(row.id)
          if (personaReplacesPrompt(doc?.content)) next.add(row.id)
        } catch {
          // Still listed. Blank mode can strip persona sections without the document;
          // a preset that replaces the whole prompt is excluded only when the document says so.
        }
      }))
    }
    complete = next
  }

  function presetCatalog() {
    if (service() === undefined) return undefined
    const ready = (rows ?? []).filter(row => row.broken === undefined)
    const option = row => ({
      value: row.id,
      ...(row.name ? { name: row.name } : {}),
      ...(row.description ? { description: row.description } : {}),
      kind: 'preset',
    })
    const options = ready.map(option)
    // One extra mode: mount an installed preset and drop its persona text.
    // Standard is not a source. A persona that replaces the whole prompt cannot
    // be separated from its tools, so it is not a source either.
    const sources = ready.filter(row => row.id !== DEFAULT_PRESET && !complete.has(row.id)).map(option)
    if (sources.length > 0) {
      const defaultSource = sources.some(source => source.value === 'unrestricted') ? 'unrestricted' : sources[0].value
      options.push({ value: 'blank', kind: 'open-tools', sources, defaultSource })
    }
    return { options, defaultPreset: DEFAULT_PRESET }
  }

  // The installed preset whose tools this Bot uses with its persona text removed.
  // `standard` is never this mode. A source that is no longer installed is not
  // one either: the Bot falls back to standard, persona included.
  function openToolsOf(bot) {
    const id = bot?.blankTools
    if (typeof id !== 'string' || id === '' || id === DEFAULT_PRESET) return undefined
    if (rows !== null && !usable(id)) return undefined
    return id
  }

  // The preset a Session is mounted with. Blank mode mounts the preset whose tools
  // it keeps. A saved id that is gone falls back to standard when DSH still has it.
  function mountId(bot) {
    const named = openToolsOf(bot) || (typeof bot?.preset === 'string' && bot.preset !== '' ? bot.preset : undefined)
    if (named && named !== DEFAULT_PRESET) {
      if (usable(named)) return named
      return usable(DEFAULT_PRESET) ? DEFAULT_PRESET : undefined
    }
    return usable(DEFAULT_PRESET) ? DEFAULT_PRESET : undefined
  }

  const explicit = bot => (typeof bot?.preset === 'string' && bot.preset !== '')
    || (typeof bot?.blankTools === 'string' && bot.blankTools !== '' && bot.blankTools !== DEFAULT_PRESET)

  function presetFallback(bot) {
    const open = typeof bot?.blankTools === 'string' && bot.blankTools !== '' && bot.blankTools !== DEFAULT_PRESET ? bot.blankTools : undefined
    const named = open ?? (typeof bot?.preset === 'string' && bot.preset !== '' && bot.preset !== DEFAULT_PRESET ? bot.preset : undefined)
    if (named === undefined || service() === undefined || rows === null) return undefined
    const row = (rows ?? []).find(item => item.id === named)
    if (row && row.broken === undefined) return undefined
    return { id: named, blank: open !== undefined }
  }

  function availableIds() {
    return (rows ?? []).filter(row => row.broken === undefined).map(row => row.id)
  }

  // One settings value: a preset id, or `blank:<id>` to mount that installed preset
  // and drop its persona text. Standard is not a source for that mode.
  async function cleanPresetChoice(raw) {
    const choice = String(raw ?? '').trim()
    await refreshPresets({ fresh: true })
    if (service() === undefined) throw new Error('Agent presets are not available in this DeepSeek Harness')
    if (choice === '' || choice === DEFAULT_PRESET || choice === 'blank:standard') return { preset: DEFAULT_PRESET }
    if (choice.startsWith('blank:')) {
      const source = choice.slice('blank:'.length)
      if (source === DEFAULT_PRESET) return { preset: DEFAULT_PRESET }
      if (!usable(source)) throw new Error(`Unknown agent preset "${source}". Available: ${availableIds().join(', ') || 'none'}`)
      if (complete.has(source)) throw new Error(`The preset "${source}" replaces the whole system prompt, so its tools cannot be used without its persona`)
      return { blankTools: source }
    }
    if (!usable(choice)) throw new Error(`Unknown agent preset "${choice}". Available: ${availableIds().join(', ') || 'none'}`)
    return { preset: choice }
  }

  async function presetCreateArg(bot) {
    await refreshPresets({ fresh: true })
    const id = mountId(bot ?? {})
    return id === undefined ? {} : { agentPreset: id }
  }

  function applyChoice(bot, choice) {
    if (choice.blankTools) {
      delete bot.preset
      bot.blankTools = choice.blankTools
      return
    }
    delete bot.blankTools
    if (choice.preset) bot.preset = choice.preset
    else delete bot.preset
  }

  async function followPreset(botId) {
    const bot = rt.botOf(botId)
    if (bot === undefined || !explicit(bot) || rt.readOnly?.() !== undefined) return
    await refreshPresets({ fresh: true })
    const wanted = mountId(bot)
    if (wanted === undefined) return
    const sessions = [rt.chatOf(botId), ...(rt.groupSessionsOf?.(botId) ?? [])].filter(Boolean)
    for (const sessionId of sessions) {
      let agent
      try {
        agent = await rt.resolveAgent(sessionId)
      } catch (error) {
        if (!missingPreset(error)) {
          rt.warn('ds-bot: preset for %s not checked: %s', bot.name, error)
          continue
        }
        const owner = rt.groupOwners.get(sessionId)
        if (owner !== undefined) {
          const room = rt.roomOf(owner.roomId)
          if (room !== undefined && room.sessions?.[botId] === sessionId) rt.retireGroupSession(room, botId)
          continue
        }
        if (sessionId === rt.chatOf(botId)) await replaceOwnChat(bot).catch(replaceError => rt.warn('ds-bot: %s did not move off a missing preset: %s', bot.name, replaceError))
        continue
      }
      if (boundPreset(ctx, agent) === wanted) continue
      const presets = service()
      if (presets?.select) {
        try {
          await presets.select(agent, wanted)
          continue
        } catch (error) {
          if (!lockedPreset(error)) {
            rt.warn('ds-bot: preset for %s not applied: %s', bot.name, error)
            continue
          }
        }
      }
      if (agent.status === undefined || agent.status === 'idle') rt.switchForPreset?.(agent)
    }
  }

  // A Session whose preset DSH can no longer mount cannot be read. The chat goes on
  // in a new Session on the preset we can mount; the settings note says why.
  async function replaceOwnChat(bot) {
    const current = rt.chatOf(bot.id)
    const dir = bot.workDir !== undefined && await rt.isFolder?.(bot.workDir) ? bot.workDir : undefined
    const freshId = await rt.createSession(bot.name, { dir, presetBot: bot })
    if (rt.botOf(bot.id) === undefined || rt.chatOf(bot.id) !== current) {
      await ctx.workspaceRegistry.archiveSession(freshId, { stopActivity: true }).catch(() => {})
      return
    }
    bot.sessionId = freshId
    await rt.save()
    await rt.applyModel?.(bot).catch(error => rt.warn('ds-bot: model for %s not applied: %s', bot.name, error))
    await rt.applyPermission?.(bot, freshId).catch(error => rt.warn('ds-bot: permission for %s not applied: %s', bot.name, error))
  }

  Object.assign(rt, {
    refreshPresets, presetCatalog, presetFallback, cleanPresetChoice, presetCreateArg, applyPresetChoice: applyChoice,
    mountPresetId: mountId, presetExplicit: explicit,     followPreset, boundPreset: agent => boundPreset(ctx, agent), openToolsOf,
  })
}
