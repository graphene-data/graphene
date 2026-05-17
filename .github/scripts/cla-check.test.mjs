import {describe, it, expect, vi} from 'vitest'

import {runCheck, isSignedInSheet, isOrgMember} from './cla-check.mjs'

function makeDeps(overrides = {}) {
  let calls = {
    setStatus: [],
    upsertComment: [],
    dismissed: 0,
  }
  return {
    calls,
    deps: {
      author: 'octocat',
      prNumber: 1,
      log: () => {},
      fetchOrgMembership: vi.fn().mockResolvedValue(false),
      fetchSignedUsernames: vi.fn().mockResolvedValue([]),
      setStatus: vi.fn(async (state, desc) => {
        calls.setStatus.push({state, desc})
      }),
      upsertComment: vi.fn(async body => {
        calls.upsertComment.push(body)
      }),
      dismissCommentIfPresent: vi.fn(async () => {
        calls.dismissed += 1
      }),
      ...overrides,
    },
  }
}

describe('runCheck', () => {
  it('skips bots with success', async () => {
    let {deps, calls} = makeDeps({author: 'dependabot[bot]'})
    let r = await runCheck(deps)
    expect(r.decision).toBe('bot')
    expect(calls.setStatus).toEqual([{state: 'success', desc: 'Bot author — CLA not required'}])
    expect(deps.fetchOrgMembership).not.toHaveBeenCalled()
    expect(deps.fetchSignedUsernames).not.toHaveBeenCalled()
    expect(calls.upsertComment).toEqual([])
  })

  it('passes internal org members and dismisses any prior comment', async () => {
    let {deps, calls} = makeDeps({
      fetchOrgMembership: vi.fn().mockResolvedValue(true),
    })
    let r = await runCheck(deps)
    expect(r.decision).toBe('internal')
    expect(calls.setStatus[0].state).toBe('success')
    expect(calls.dismissed).toBe(1)
    expect(deps.fetchSignedUsernames).not.toHaveBeenCalled()
  })

  it('passes external signers (case insensitive match)', async () => {
    let {deps, calls} = makeDeps({
      author: 'OctoCat',
      fetchSignedUsernames: vi.fn().mockResolvedValue(['someone-else', 'octocat']),
    })
    let r = await runCheck(deps)
    expect(r.decision).toBe('signed')
    expect(calls.setStatus[0].state).toBe('success')
    expect(calls.dismissed).toBe(1)
    expect(calls.upsertComment).toEqual([])
  })

  it('blocks unsigned external contributors with comment + failing status', async () => {
    let {deps, calls} = makeDeps({
      fetchSignedUsernames: vi.fn().mockResolvedValue(['someone-else']),
    })
    let r = await runCheck(deps)
    expect(r.decision).toBe('unsigned')
    expect(calls.setStatus[0].state).toBe('failure')
    expect(calls.upsertComment).toHaveLength(1)
    expect(calls.upsertComment[0]).toContain('<!-- cla-check-bot -->')
    expect(calls.upsertComment[0]).toContain('graphenedata.com/cla?username=octocat')
    expect(calls.dismissed).toBe(0)
  })
})

describe('isSignedInSheet', () => {
  it('handles empty sheets', async () => {
    let signed = await isSignedInSheet('anyone', {fetchSignedUsernames: async () => []})
    expect(signed).toBe(false)
  })

  it('matches case-insensitively', async () => {
    let usernames = ['Hubot', 'OctoCat']
    expect(await isSignedInSheet('octocat', {fetchSignedUsernames: async () => usernames})).toBe(true)
    expect(await isSignedInSheet('OCTOCAT', {fetchSignedUsernames: async () => usernames})).toBe(true)
    expect(await isSignedInSheet('someone-else', {fetchSignedUsernames: async () => usernames})).toBe(false)
  })
})

describe('isOrgMember', () => {
  it('short-circuits bots without making a call', async () => {
    let fetchOrgMembership = vi.fn()
    expect(await isOrgMember('renovate[bot]', {fetchOrgMembership})).toBe(true)
    expect(fetchOrgMembership).not.toHaveBeenCalled()
  })

  it('delegates to fetchOrgMembership for humans', async () => {
    expect(await isOrgMember('octocat', {fetchOrgMembership: async () => true})).toBe(true)
    expect(await isOrgMember('octocat', {fetchOrgMembership: async () => false})).toBe(false)
  })
})
