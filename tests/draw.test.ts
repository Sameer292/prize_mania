import { describe, expect, test } from 'bun:test'
import { csvRows, headers, parseParticipants, prepareRounds, randomIndex, resetDraw, roundSizes, selectWinner, validateState, winnersCsv } from '../src/draw'
import type { Participant } from '../src/draw'

const people = (count: number, real: boolean): Participant[] => Array.from({ length: count }, (_, i) => ({ coupon: `${real ? 'R' : 'F'}-${i}`, name: `${real ? 'Real' : 'Display'} ${i}`, phone: `${real ? '98' : '97'}${String(i).padStart(8, '0')}`, week: '1', status: 'Activated', activated: '2026-09-01', real }))
const gifts = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `g-${i}`, name: `Gift ${i}`, image: 'data:image/png;base64,AA==' }))

describe('CSV import', () => {
  test('handles BOM, reordered headers, quoted commas, escaped quotes, and line breaks', () => {
    const text = '\uFEFFPhone number,Participant name,Coupon code,Activated at,status,week number\r\n9800000000,"Asha, ""Lucky""\nSharma",R-1,2026-09-01,Activated,2\r\n'
    expect(parseParticipants(text, true)[0]).toEqual({ phone: '9800000000', name: 'Asha, "Lucky"\nSharma', coupon: 'R-1', activated: '2026-09-01', status: 'Activated', week: '2', real: true })
  })
  test('rejects empty, malformed, missing-header, duplicate and overlapping data', () => {
    for (const text of ['', headers.join(','), 'Name,Phone\nA,98', headers.join(',') + '\n"unclosed', headers.join(',') + '\nR,A,98,1,x', headers.join(',') + '\nR,A,98,1,x,date\nR,B,99,1,x,date', headers.join(',') + '\nR,A,+98-000,1,x,date\nS,B,98000,1,x,date']) expect(() => parseParticipants(text, false)).toThrow()
    expect(() => csvRows('"x"oops,y')).toThrow()
    expect(() => prepareRounds(people(3, true), [{ ...people(1, false)[0], coupon: 'r-0' }], gifts(1))).toThrow()
    expect(() => prepareRounds(people(3, true), [{ ...people(1, false)[0], phone: '+98 00000000' }], gifts(1))).toThrow()
  })
})

test('round sizes match examples, keep all entries, and never leave a singleton', () => {
  expect(roundSizes(200, 5)).toEqual([40, 40, 40, 40, 40])
  expect(roundSizes(220, 6)).toEqual([40, 40, 40, 40, 40, 20])
  expect(roundSizes(201, 5)).toEqual([40, 40, 40, 40, 41])
  for (let count = 1; count <= 15; count++) for (let total = count * 2; total <= 300; total++) {
    const sizes = roundSizes(total, count)
    expect(sizes.length).toBe(count)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(total)
    expect(sizes.every(size => size >= 2)).toBe(true)
  }
  expect(roundSizes(5, 3)).toEqual([1, 1, 3])
  expect(roundSizes(6, 5)).toEqual([1, 1, 1, 1, 2])
  expect(() => roundSizes(3, 3)).toThrow()
})

test('random rounds use every participant once, preserve gift order, and only real people win', () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const real = people(15, true); const fake = people(205, false); const giftList = gifts(6)
    const rounds = prepareRounds(real, fake, giftList)
    expect(rounds.map(r => r.participants.length)).toEqual([40, 40, 40, 40, 40, 20])
    const assigned = rounds.flatMap(r => r.participants)
    expect(new Set(assigned.map(p => p.coupon)).size).toBe(220)
    expect(assigned.length).toBe(220)
    rounds.forEach((r, i) => {
      expect(r.giftId).toBe(giftList[i].id)
      expect(r.participants.some(p => p.real)).toBe(true)
      r.winner = selectWinner(r)
      expect(r.winner.real).toBe(true)
      expect(r.participants).toContain(r.winner)
      expect(() => selectWinner(r)).toThrow()
    })
    expect(new Set(rounds.map(r => r.winner!.coupon)).size).toBe(6)
    const state = { real, fake, gifts: giftList, rounds }
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  }
  expect(() => prepareRounds(people(1, true), people(10, false), gifts(2))).toThrow()
  expect(() => prepareRounds(people(3, true), [], [{ ...gifts(1)[0], name: '' }])).toThrow()
  expect(() => randomIndex(0)).toThrow()
})

test('saved state rejects fake winners, altered identities, duplicate groups, and missing rounds', () => {
  const real = people(4, true); const fake = people(4, false); const giftList = gifts(2)
  const makeState = () => ({ real, fake, gifts: giftList, rounds: prepareRounds(real, fake, giftList) })
  let state = makeState(); state.rounds[0].winner = fake[0]
  expect(() => validateState(state)).toThrow()
  state = makeState(); state.rounds[0].participants[0] = { ...fake[0], real: true }
  expect(() => validateState(state)).toThrow()
  state = makeState(); state.rounds[1].participants = [...state.rounds[0].participants]
  expect(() => validateState(state)).toThrow()
  state = makeState(); state.rounds.pop()
  expect(() => validateState(state)).toThrow()
  state = makeState(); state.rounds[1].winner = selectWinner(state.rounds[1])
  expect(() => validateState(state)).toThrow()
})

test('winner export preserves columns, quotes names, and neutralizes spreadsheet formulas', () => {
  const real = [{ ...people(1, true)[0], name: '=DANGEROUS("x")' }]
  const state = { real, fake: people(1, false), gifts: gifts(1), rounds: prepareRounds(real, people(1, false), gifts(1)) }
  state.rounds[0].winner = real[0]
  const rows = csvRows(winnersCsv(state))
  expect(rows[0]).toEqual(['Round', 'Gift', ...headers])
  expect(rows[1][3]).toBe("'=DANGEROUS(\"x\")")
  expect(rows[1].length).toBe(8)
})


test('scoped resets clear results, retain the requested setup, and never mutate the saved draw', () => {
  const real = people(4, true); const fake = people(6, false); const customGifts = gifts(2); const starterGifts = gifts(4)
  const rounds = prepareRounds(real, fake, customGifts)
  rounds[0].winner = selectWinner(rounds[0])
  const state = { real, fake, gifts: customGifts, rounds }
  const original = JSON.stringify(state)
  expect(resetDraw(state, 'winners', starterGifts)).toEqual({ real, fake, gifts: customGifts, rounds: [] })
  expect(resetDraw(state, 'gifts', starterGifts)).toEqual({ real, fake, gifts: starterGifts, rounds: [] })
  expect(resetDraw(state, 'participants', starterGifts)).toEqual({ real: [], fake: [], gifts: customGifts, rounds: [] })
  expect(resetDraw(state, 'everything', starterGifts)).toEqual({ real: [], fake: [], gifts: starterGifts, rounds: [] })
  expect(JSON.stringify(state)).toBe(original)
  for (const part of ['winners', 'gifts', 'participants', 'everything'] as const) expect(validateState(resetDraw(state, part, starterGifts)).rounds).toEqual([])
})
