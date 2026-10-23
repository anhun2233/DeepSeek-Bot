import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../index.js'
import { fakeContext } from './fake-ctx.js'

// Fei2411/DeepSeek-Bot#37: under DSH Desktop's default PTC preset a model may call only
// run_code, so the group_relay call made for a group chat's Session was turned down
// and no group message reached its Bots.

const TEAM = {
  version: 1,
  mainBotIds: ['chief'],
  revision: 1,
  whaleStored: true,
  bots: { chief: { id: 'chief', sessionId: 'chief', name: 'Chief', role: 'Lead', instructions: '', createdAt: 1 } },
  rooms: { room: { id: 'room', name: 'Desk', members: ['chief'], admin: 'chief', mode: 'everyone', sessions: {}, seq: 0, log: [] } },
  exchanges: [],
  exchangeTurns: {},
  questions: {},
}

function start({ presets, readDocument } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-agent-preset-'))
  writeFileSync(join(home, 'state.json'), JSON.stringify(TEAM))
  const services = presets === undefined ? {} : {
    agentPresets: {
      list: async () => presets,
      select: async (_agent, id) => id,
      ...(readDocument ? { readDocument } : {}),
    },
  }
  const ctx = fakeContext({ services })
  const created = []
  Object.assign(ctx, {
    workspaceRegistry: {
      get: id => (id === 'w1' ? { id } : undefined),
      resolveByPath: async () => undefined,
      create: async path => ({ id: 'w1', path }),
      archiveSession: async () => {},
    },
    sessionController: {
      create: async (request) => {
        created.push(request)
        return { sessionId: `new${created.length}` }
      },
      resolveAgent: async id => ({ agent: { id, session: { id } } }),
    },
    sessionTitle: { rename: async () => {} },
  })
  const rt = createRuntime(ctx, { home, github: false, diagnosticsFile: false })
  const relay = ctx.listeners.get('llm/stream').find(listener => /relayOrPass/.test(String(listener)))
  const stop = async () => {
    await ctx.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
  return { rt, ctx, created, relay, home, stop }
}

async function drain(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

const userText = text => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const declared = (...names) => names.map(name => ({ name, description: '', parameters: {} }))
const relayCall = async (relay, tools) => {
  const chunks = await drain(relay({ provider: 'deepseek', model: 'v4', sessionId: 'room', messages: [userText('Hello team')], tools }, () => {
    throw new Error('a group round never reaches the model')
  }))
  assert.equal(chunks.at(-1).reason.kind, 'tool-calls')
  return chunks.find(chunk => chunk.type === 'block-end').block
}

test('a new Bot Session is made with the standard preset when DSH serves it', async (t) => {
  const { rt, created, stop } = start({ presets: [{ id: 'ptc' }, { id: 'standard' }] })
  t.after(stop)
  await rt.load()
  await rt.createSession('Chief')
  assert.deepEqual(created, [{ workspaceId: 'w1', agentPreset: 'standard' }])
})

test('without a usable standard preset a Bot Session keeps DSH\'s default', async (t) => {
  for (const presets of [undefined, [{ id: 'ptc' }], [{ id: 'standard', broken: 'failed to start' }]]) {
    const { rt, created, stop } = start({ presets })
    t.after(stop)
    await rt.load()
    await rt.createSession('Chief')
    assert.deepEqual(created, [{ workspaceId: 'w1' }])
  }
})

test('a Bot Session uses the preset saved on that Bot', async (t) => {
  const { rt, created, stop } = start({ presets: [{ id: 'ptc' }, { id: 'standard' }, { id: 'unrestricted', name: 'Open' }] })
  t.after(stop)
  await rt.load()
  await rt.createSession('Chief', { presetBot: { preset: 'unrestricted' } })
  await rt.createSession('Member', { presetBot: { blankTools: 'unrestricted' } })
  assert.deepEqual(created.map(request => request.agentPreset), ['unrestricted', 'unrestricted'])
})

test('a missing preset falls back to standard', async (t) => {
  const { rt, created, stop } = start({ presets: [{ id: 'standard' }] })
  t.after(stop)
  await rt.load()
  await rt.createSession('Chief', { presetBot: { preset: 'unrestricted' } })
  assert.deepEqual(created, [{ workspaceId: 'w1', agentPreset: 'standard' }])
  assert.deepEqual(rt.presetFallback({ preset: 'unrestricted' }), { id: 'unrestricted', blank: false })
  assert.deepEqual(rt.presetFallback({ blankTools: 'unrestricted' }), { id: 'unrestricted', blank: true })
})

test('the preset list is every installed preset, plus blank tool modes', async (t) => {
  const readDocument = async (id) => ({
    content: id === 'minimal'
      ? "name: '@deepseek-ai/dsh-persona'\n  prefix: hello\n  complete: true\n"
      : "name: '@deepseek-ai/dsh-tool-fs'\n",
  })
  const { rt, stop } = start({
    presets: [
      { id: 'standard' },
      { id: 'ptc' },
      { id: 'minimal' },
      { id: 'cordis', name: 'Creator mode' },
      { id: 'unrestricted', name: 'Open' },
    ],
    readDocument,
  })
  t.after(stop)
  await rt.refreshPresets()
  const catalog = rt.presetCatalog()
  assert.deepEqual(catalog.options.map(option => option.value), ['standard', 'ptc', 'minimal', 'cordis', 'unrestricted', 'blank'])
  const expanded = catalog.options.find(option => option.kind === 'open-tools')
  assert.equal(expanded.defaultSource, 'unrestricted')
  assert.deepEqual(expanded.sources.map(option => option.value), ['ptc', 'cordis', 'unrestricted'])
  assert.deepEqual(await rt.cleanPresetChoice('blank:standard'), { preset: 'standard' })
  await assert.rejects(rt.cleanPresetChoice('blank:minimal'), /replaces the whole system prompt/)
  assert.deepEqual(await rt.cleanPresetChoice('blank:unrestricted'), { blankTools: 'unrestricted' })
  assert.equal(rt.openToolsOf({ blankTools: 'unrestricted' }), 'unrestricted')
  assert.equal(rt.openToolsOf({ blankTools: 'standard' }), undefined)
  assert.equal(rt.openToolsOf({ blankTools: 'gone' }), undefined)
})

test('open-tools mode is hidden when no other preset is installed', async (t) => {
  const { rt, stop } = start({ presets: [{ id: 'standard' }] })
  t.after(stop)
  await rt.refreshPresets()
  assert.deepEqual(rt.presetCatalog().options.map(option => option.value), ['standard'])
})

test('a Bot cannot set the preset or the persona; the user can, and the file is created', async (t) => {
  const { rt, ctx, home, stop } = start({ presets: [{ id: 'standard' }, { id: 'unrestricted', name: 'Open' }] })
  t.after(stop)
  await rt.load()
  const tool = (args, sessionId) => ctx.registeredTools.get('update_bot').execute(args, { agent: { id: sessionId, session: { id: sessionId } } })
  assert.match(await tool({ preset: 'unrestricted', name: 'Nope' }, 'chief'), /Only the user can change/)
  assert.equal(rt.botOf('chief').name, 'Chief')
  assert.equal(rt.botOf('chief').preset, undefined)
  await rt.updateBot('chief', { preset: 'blank:unrestricted' })
  assert.equal(rt.botOf('chief').blankTools, 'unrestricted')
  assert.equal(rt.botOf('chief').preset, undefined)
  const saved = await rt.writePersona('chief', 'Calm and brief.\n')
  assert.equal(saved.path, 'personas/chief/persona.md')
  const file = join(home, 'personas', 'chief', 'persona.md')
  assert.equal(existsSync(file), true)
  assert.match(ctx.sections.get('bot-persona').text({ agent: { id: 'chief' } }), /^# Persona\nCalm and brief\.$/)
  assert.equal(ctx.sections.get('bot-persona').order, 100)
  assert.equal(ctx.sections.get('bot-identity').order, 640)
  assert.doesNotMatch(ctx.sections.get('bot-identity').text({ agent: { id: 'chief' } }), /Calm and brief/)
})

test('a group round calls group_relay directly when the Session declares it', async (t) => {
  const { relay, stop } = start()
  t.after(stop)
  for (const tools of [declared('read', 'group_relay'), declared('run_code', 'group_relay')]) {
    const block = await relayCall(relay, tools)
    assert.deepEqual([block.name, block.arguments], ['group_relay', '{}'])
  }
})

test('a group made under the PTC preset relays through run_code', async (t) => {
  const { relay, stop } = start()
  t.after(stop)
  const block = await relayCall(relay, declared('run_code'))
  assert.equal(block.name, 'run_code')
  assert.deepEqual(JSON.parse(block.arguments), {
    description: 'Relay the group chat to its Bots',
    code: 'return await tools.group_relay({})',
    timeoutMs: 600_000,
  })
})
