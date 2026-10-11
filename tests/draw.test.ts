import { describe, expect, test } from 'bun:test'
import { createGiftCode, csvRows, headers, parseParticipants, prepareRounds, randomIndex, reconcileCustomWinners, resetDraw, roundSizes, selectWinner, setCustomWinner, validateState, winnersCsv } from '../src/draw'
import type { DrawState, Participant } from '../src/draw'

const people = (count: number, real: boolean): Participant[] => Array.from({ length: count }, (_, i) => ({ coupon: `${real ? 'R' : 'F'}-${i}`, name: `${real ? 'Real' : 'Display'} ${i}`, phone: `${real ? '98' : '97'}${String(i).padStart(8, '0')}`, week: '1', status: 'Activated', activated: '2026-09-01', real }))
const gifts = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `g-${i}`, code: `PRIZE-${String(i + 1).padStart(4, '0')}`, name: `Gift ${i}`, image: 'data:image/png;base64,AA==' }))

describe('CSV import', () => {
  test('handles BOM, reordered headers, quoted commas, escaped quotes, and line breaks', () => {
    const text = '\uFEFFPhone number,Participant name,Coupon code,Activated at,status,week number\r\n9800000000,"Asha, ""Lucky""\nSharma",R-1,2026-09-01,Activated,2\r\n'
    expect(parseParticipants(text, true)[0]).toEqual({ phone: '9800000000', name: 'Asha, "Lucky"\nSharma', coupon: 'R-1', activated: '2026-09-01', status: 'Activated', week: '2', real: true })
  })
  test('rejects empty, malformed, missing-header, duplicate and overlapping data', () => {
    for (const text of ['', headers.join(','), 'Name,Phone\nA,98', headers.join(',') + '\n"unclosed', headers.join(',') + '\nR,A,98,1,x', headers.join(',') + '\nR,A,98,1,x,date\nR,B,99,1,x,date', headers.join(',') + '\nR,A,+98-000,1,x,date\n r ,B,99000,1,x,date']) expect(() => parseParticipants(text, false)).toThrow()
    expect(() => csvRows('"x"oops,y')).toThrow()
    expect(() => prepareRounds(people(3, true), [{ ...people(1, false)[0], coupon: 'r-0' }], gifts(1))).toThrow()
    expect(() => prepareRounds(people(3, true), [{ ...people(1, false)[0], phone: '+98 00000000' }], gifts(1))).not.toThrow()
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


test('repeated phones are accepted within and across lists, saved rounds, and real-only winners', () => {
  const real = parseParticipants(headers.join(',') + '\nR-1,Asha,9800000000,1,Activated,date\nR-2,Sita,9800000000,1,Activated,date', true)
  const fake = parseParticipants(headers.join(',') + '\nF-1,Anita,+98 00000000,1,Activated,date\nF-2,Kiran,009800000000,1,Activated,date', false)
  const giftList = gifts(2)
  const rounds = prepareRounds(real, fake, giftList)
  rounds.forEach(round => { round.winner = selectWinner(round); expect(round.winner.real).toBe(true) })
  expect(new Set(rounds.flatMap(round => round.participants.map(person => person.coupon))).size).toBe(4)
  const state = { real, fake, gifts: giftList, rounds }
  expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  expect(() => prepareRounds(real, [{ ...fake[0], coupon: ' r-1 ' }], giftList)).toThrow('coupon code')
})

describe('custom prize winners', () => {
  const setup = (): DrawState => ({ real: people(8, true), fake: people(12, false), gifts: gifts(4), rounds: [] })

  test('saves canonical coupons, accepts leading zeroes, clears assignments, and does not mutate setup', () => {
    const state = setup()
    state.real[0].coupon = '00123'
    const original = JSON.stringify(state)
    let next = setCustomWinner(state, ' prize-0001 ', ' 00123 ')
    expect(next.gifts[0].customWinnerCoupon).toBe('00123')
    next = setCustomWinner(next, 'PRIZE-0002', ' r-1 ')
    expect(next.gifts[1].customWinnerCoupon).toBe('R-1')
    expect(validateState(JSON.parse(JSON.stringify(next)))).toEqual(next)
    next = setCustomWinner(next, 'PRIZE-0001', '')
    expect(next.gifts[0].customWinnerCoupon).toBeUndefined()
    expect(JSON.stringify(state)).toBe(original)
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  test('rejects unknown, display-only, duplicate coupons and edits after preparing', () => {
    const state = setCustomWinner(setup(), 'PRIZE-0001', 'R-1')
    expect(() => setCustomWinner(state, 'PRIZE-0002', 'r-1')).toThrow('already assigned')
    expect(() => setCustomWinner(state, 'PRIZE-0002', 'F-1')).toThrow('real participant list')
    expect(() => setCustomWinner(state, 'PRIZE-0002', 'missing')).toThrow('real participant list')
    expect(() => setCustomWinner(state, 'missing-gift', 'R-2')).toThrow('no longer exists')
    state.rounds = prepareRounds(state.real, state.fake, state.gifts)
    expect(() => setCustomWinner(state, 'PRIZE-0001', '')).toThrow('Reset the draw')
  })

  test('reserves coupons for their prizes, keeps sizes and unique participants, and exports actual winners', () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      let state = setCustomWinner(setup(), 'PRIZE-0001', 'R-7')
      state = setCustomWinner(state, 'PRIZE-0003', 'R-0')
      // Assignments follow gift IDs when the prize order changes.
      state.gifts.reverse()
      state.rounds = prepareRounds(state.real, state.fake, state.gifts)
      expect(state.rounds.map(r => r.participants.length)).toEqual(roundSizes(20, 4))
      const assigned = state.rounds.flatMap(r => r.participants)
      expect(assigned.length).toBe(20)
      expect(new Set(assigned.map(p => p.coupon)).size).toBe(20)
      state.rounds.forEach((round, i) => {
        expect(round.participants.some(p => p.real)).toBe(true)
        round.winner = selectWinner(round)
        expect(round.winner.real).toBe(true)
        if (state.gifts[i].customWinnerCoupon) expect(round.winner.coupon).toBe(state.gifts[i].customWinnerCoupon)
        expect(() => selectWinner(round)).toThrow('already has a winner')
      })
      expect(new Set(state.rounds.map(r => r.winner!.coupon)).size).toBe(4)
      const restored = validateState(JSON.parse(JSON.stringify(state)))
      expect(restored).toEqual(state)
      expect(csvRows(winnersCsv(restored)).slice(1).map(row => row[2])).toEqual(state.rounds.map(r => r.winner!.coupon))
    }
  })

  test('works with every prize assigned and the minimum number of real participants', () => {
    let state: DrawState = { real: people(4, true), fake: people(1, false), gifts: gifts(4), rounds: [] }
    for (let i = 0; i < 4; i++) state = setCustomWinner(state, state.gifts[i].code, `R-${3 - i}`)
    state.rounds = prepareRounds(state.real, state.fake, state.gifts)
    expect(state.rounds.map(r => r.participants.length)).toEqual([1, 1, 1, 2])
    state.rounds.forEach((r, i) => { r.winner = selectWinner(r); expect(r.winner.coupon).toBe(`R-${3 - i}`) })
    expect(() => validateState(JSON.parse(JSON.stringify(state)))).not.toThrow()
  })

  test('unfinished assignments survive a refresh and mixed prizes work with minimum real entrants', () => {
    let state: DrawState = { real: people(4, true), fake: people(1, false), gifts: gifts(4), rounds: [] }
    state = setCustomWinner(state, 'PRIZE-0004', 'R-0')
    state.rounds = prepareRounds(state.real, state.fake, state.gifts)
    const restored = validateState(JSON.parse(JSON.stringify(state)))
    expect(restored.rounds.every(r => !r.winner)).toBe(true)
    restored.rounds.forEach(r => { r.winner = selectWinner(r) })
    expect(restored.rounds[3].winner?.coupon).toBe('R-0')
    expect(new Set(restored.rounds.map(r => r.winner?.coupon)).size).toBe(4)
    expect(() => validateState(JSON.parse(JSON.stringify(restored)))).not.toThrow()
  })

  test('rejects invalid saved assignments and mismatched rounds or winners', () => {
    const makeState = () => {
      const state = setCustomWinner(setup(), 'PRIZE-0001', 'R-0')
      state.rounds = prepareRounds(state.real, state.fake, state.gifts)
      return state
    }
    for (const coupon of ['missing', 'F-0', '', 123]) {
      const state = { ...setup(), gifts: [{ ...gifts(1)[0], customWinnerCoupon: coupon }] }
      expect(() => validateState(state)).toThrow()
      expect(() => prepareRounds(state.real, state.fake, state.gifts as DrawState['gifts'])).toThrow()
    }
    let state = makeState()
    state.gifts[1].customWinnerCoupon = 'r-0'
    expect(() => validateState(state)).toThrow('already assigned')
    state = makeState()
    state.rounds[0].customWinnerCoupon = undefined
    expect(() => validateState(state)).toThrow('assignment')
    state = makeState()
    state.rounds[0].winner = { ...state.real[1] }
    expect(() => validateState(state)).toThrow()
    state = makeState()
    state.rounds[0].participants = state.rounds[0].participants.filter(p => p.coupon !== 'R-0')
    expect(() => selectWinner(state.rounds[0])).toThrow('custom winner')
    expect(() => validateState(state)).toThrow()
    expect(() => selectWinner({ giftId: 'g-0', customWinnerCoupon: 'F-0', participants: [...people(1, true), ...people(1, false)] })).toThrow('real participant')
  })

  test('reset winners retains settings; participant replacement and other resets remove stale settings', () => {
    const state = setCustomWinner(setup(), 'PRIZE-0001', 'R-0')
    const original = JSON.stringify(state)
    const winnersReset = resetDraw(state, 'winners', gifts(4))
    expect(winnersReset.gifts[0].customWinnerCoupon).toBe('R-0')
    for (const part of ['participants', 'gifts', 'everything'] as const) {
      const next = resetDraw(state, part, gifts(4))
      expect(next.gifts.every(g => g.customWinnerCoupon === undefined)).toBe(true)
      expect(() => validateState(JSON.parse(JSON.stringify(next)))).not.toThrow()
    }
    expect(reconcileCustomWinners(state.gifts, [{ ...state.real[0], coupon: 'r-0' }])[0].customWinnerCoupon).toBe('R-0')
    expect(reconcileCustomWinners(state.gifts, state.real.slice(1))[0].customWinnerCoupon).toBeUndefined()
    expect(JSON.stringify(state)).toBe(original)
  })
})

describe('prize codes', () => {
  test('generates compact unique codes for new prizes', () => {
    const giftList = gifts(4)
    for (let i = 0; i < 100; i++) {
      const code = createGiftCode(giftList)
      expect(code).toMatch(/^PRIZE-[A-F0-9]{8}$/)
      expect(giftList.some(g => g.code === code)).toBe(false)
      giftList.push({ ...gifts(1)[0], id: `new-${i}`, code })
    }
  })

  test('requires an existing prize code, not a round number or internal ID', () => {
    const state: DrawState = { real: people(2, true), fake: [], gifts: [], rounds: [] }
    expect(() => setCustomWinner(state, 'PRIZE-0001', 'R-0')).toThrow('Add gifts')
    state.gifts = gifts(1)
    expect(() => setCustomWinner(state, 'g-0', 'R-0')).toThrow('no longer exists')
    expect(() => setCustomWinner(state, '1', 'R-0')).toThrow('no longer exists')
    expect(setCustomWinner(state, state.gifts[0].code, 'R-0').gifts[0].customWinnerCoupon).toBe('R-0')
  })

  test('migrates old saved prizes repeatably without losing assignments or completed winners', () => {
    let state: DrawState = { real: people(4, true), fake: [], gifts: gifts(2), rounds: [] }
    state = setCustomWinner(state, state.gifts[0].code, 'R-0')
    state.rounds = prepareRounds(state.real, state.fake, state.gifts)
    state.rounds[0].winner = selectWinner(state.rounds[0])
    const legacy = JSON.parse(JSON.stringify(state))
    legacy.gifts.forEach((gift: { code?: string }) => { delete gift.code })
    const original = JSON.stringify(legacy)
    const restored = validateState(legacy)
    expect(restored.gifts.map(g => g.code)).toEqual(['PRIZE-0001', 'PRIZE-0002'])
    expect(restored.rounds).toEqual(state.rounds)
    expect(restored.gifts[0].customWinnerCoupon).toBe('R-0')
    expect(validateState(JSON.parse(original))).toEqual(restored)
    expect(validateState(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
    expect(JSON.stringify(legacy)).toBe(original)
  })

  test('rejects invalid or duplicate saved codes and avoids existing codes when migrating', () => {
    const state: DrawState = { real: [], fake: [], gifts: gifts(2), rounds: [] }
    for (const code of ['', '  ', ' PRIZE-0001 ', 'prize-0001', 123]) {
      const invalid = { ...state, gifts: [state.gifts[0], { ...state.gifts[1], code }] }
      expect(() => validateState(invalid)).toThrow('prize code')
    }
    const mixed = JSON.parse(JSON.stringify(state))
    delete mixed.gifts[1].code
    expect(validateState(mixed).gifts.map(g => g.code)).toEqual(['PRIZE-0001', 'PRIZE-0002'])
  })

  test('codes and assignments survive prize renaming, any turn order, and reloads', () => {
    let state: DrawState = { real: people(4, true), fake: people(2, false), gifts: gifts(3), rounds: [] }
    const code = state.gifts[1].code
    state = setCustomWinner(state, code, 'R-2')
    state.gifts[1] = { ...state.gifts[1], name: 'Renamed prize' }
    for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
      const giftList = order.map(i => state.gifts[i])
      const restored = validateState(JSON.parse(JSON.stringify({ ...state, gifts: giftList, rounds: prepareRounds(state.real, state.fake, giftList) })))
      restored.rounds.forEach(r => { r.winner = selectWinner(r) })
      const index = restored.gifts.findIndex(g => g.code === code)
      expect(restored.gifts[index].name).toBe('Renamed prize')
      expect(restored.rounds[index].winner?.coupon).toBe('R-2')
      expect(() => validateState(restored)).not.toThrow()
    }
    const random = setCustomWinner(state, code, '   ')
    expect(random.gifts.find(g => g.code === code)?.customWinnerCoupon).toBeUndefined()
    expect(prepareRounds(random.real, random.fake, random.gifts).every(r => r.customWinnerCoupon === undefined)).toBe(true)
  })
})
