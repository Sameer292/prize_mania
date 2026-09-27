export const headers = ['Coupon code', 'Participant name', 'Phone number', 'week number', 'status', 'Activated at']
export type Participant = { coupon: string; name: string; phone: string; week: string; status: string; activated: string; real: boolean }
export type Gift = { id: string; name: string; image: string }
export type Round = { giftId: string; participants: Participant[]; winner?: Participant }
export type DrawState = { real: Participant[]; fake: Participant[]; gifts: Gift[]; rounds: Round[] }
export const storageKey = 'prize-mania-v1'
export type ResetPart = 'winners' | 'gifts' | 'participants' | 'everything'

export function resetDraw(state: DrawState, part: ResetPart, starterGifts: Gift[]): DrawState {
  const clearPeople = part === 'participants' || part === 'everything'
  return { real: clearPeople ? [] : state.real, fake: clearPeople ? [] : state.fake, gifts: part === 'gifts' || part === 'everything' ? starterGifts : state.gifts, rounds: [] }
}

export function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else field += c
    } else if (c === '"') {
      if (field || closed) throw new Error('Invalid CSV quotation. Use double quotes around a whole field.')
      quoted = true
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field.trim()); field = ''; closed = false
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row)
        row = []
        if (c === '\r' && input[i + 1] === '\n') i++
      }
    } else {
      if (closed && c.trim()) throw new Error('Unexpected text after a quoted CSV field.')
      if (!closed) field += c
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quote.')
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const couponKey = (p: Participant) => p.coupon.trim().toLowerCase()
const phoneKey = (p: Participant) => p.phone.replace(/\D/g, '').replace(/^00/, '')
export function assertUnique(people: Participant[]) {
  const coupons = new Set<string>(); const phones = new Set<string>()
  for (const p of people) {
    if (!p.coupon.trim() || !p.name.trim() || !phoneKey(p)) throw new Error('Every participant needs a coupon code, name, and phone number.')
    if (coupons.has(couponKey(p)) || phones.has(phoneKey(p))) throw new Error(`Duplicate or overlapping coupon / phone number: ${p.coupon}. No data was accepted.`)
    coupons.add(couponKey(p)); phones.add(phoneKey(p))
  }
}

export function parseParticipants(text: string, real: boolean): Participant[] {
  const [head, ...rows] = csvRows(text)
  const normalized = head?.map(h => h.trim().toLowerCase()) ?? []
  const indexes = headers.map(h => normalized.indexOf(h.toLowerCase()))
  if (indexes.includes(-1) || new Set(normalized).size !== normalized.length) throw new Error(`CSV must contain these unique headers: ${headers.join(', ')}.`)
  if (!rows.length) throw new Error('This CSV has no participants.')
  const people = rows.map((row, i) => {
    if (row.length !== head.length) throw new Error(`CSV row ${i + 2} has ${row.length} columns; expected ${head.length}.`)
    const [coupon, name, phone, week, status, activated] = indexes.map(index => row[index])
    return { coupon, name, phone, week, status, activated, real }
  })
  assertUnique(people)
  return people
}

export function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 2 ** 32) throw new Error('Invalid random selection size.')
  const limit = 2 ** 32 - (2 ** 32 % length)
  const buffer = new Uint32Array(1)
  do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
  return buffer[0] % length
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function roundSizes(total: number, count: number): number[] {
  if (count < 1 || total < count + 1) throw new Error('Add more participants: each gift needs a round and the last round needs at least two people.')
  const target = Math.max(Math.min(2, Math.floor(total / count)), Math.round(total / count / 10) * 10)
  if (total - target * (count - 1) >= 2) return [...Array(count - 1).fill(target), total - target * (count - 1)]
  const base = Math.floor(total / count)
  return Array.from({ length: count }, (_, i) => base + (i >= count - total % count ? 1 : 0))
}

export function prepareRounds(real: Participant[], fake: Participant[], gifts: Gift[]): Round[] {
  if (real.length < gifts.length) throw new Error('You need at least one real participant for every gift.')
  if (gifts.some(g => !g.name.trim() || !g.image)) throw new Error('Give every gift a name and an image.')
  assertUnique([...real, ...fake])
  const sizes = roundSizes(real.length + fake.length, gifts.length)
  const eligible = shuffle(real)
  const pool = shuffle([...eligible.slice(gifts.length), ...fake])
  let offset = 0
  return gifts.map((gift, i) => {
    const participants = shuffle([eligible[i], ...pool.slice(offset, offset + sizes[i] - 1)])
    offset += sizes[i] - 1
    return { giftId: gift.id, participants }
  })
}

export function selectWinner(round: Round): Participant {
  if (round.winner) throw new Error('This round already has a winner.')
  const eligible = round.participants.filter(p => p.real)
  return eligible[randomIndex(eligible.length)]
}

export function validateState(value: unknown): DrawState {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved draw.')
  const state = value as DrawState
  if (![state.real, state.fake, state.gifts, state.rounds].every(Array.isArray)) throw new Error('Invalid saved draw.')
  const people = [...state.real, ...state.fake]
  for (const p of people) {
    if (!p || !['coupon', 'name', 'phone', 'week', 'status', 'activated'].every(k => typeof p[k as keyof Participant] === 'string')) throw new Error('Invalid saved participant.')
  }
  if (state.real.some(p => p.real !== true) || state.fake.some(p => p.real !== false)) throw new Error('Invalid participant eligibility.')
  assertUnique(people)
  if (new Set(state.gifts.map(g => g.id)).size !== state.gifts.length || state.gifts.some(g => !g || typeof g.id !== 'string' || typeof g.name !== 'string' || typeof g.image !== 'string' || !g.image.startsWith('data:image/'))) throw new Error('Invalid saved gifts.')
  if (state.rounds.length) {
    if (state.rounds.length !== state.gifts.length) throw new Error('Invalid saved rounds.')
    const assigned: Participant[] = []
    const originals = new Map(people.map(p => [couponKey(p), JSON.stringify(p)]))
    let unfinished = false
    state.rounds.forEach((r, i) => {
      if (r.giftId !== state.gifts[i].id || !Array.isArray(r.participants) || r.participants.length < (i === state.rounds.length - 1 ? 2 : 1) || !r.participants.some(p => p.real)) throw new Error('Invalid saved round.')
      for (const p of r.participants) {
        if (originals.get(couponKey(p)) !== JSON.stringify(p)) throw new Error('Unknown saved participant.')
        assigned.push(p)
      }
      if (r.winner && (unfinished || !r.winner.real || !r.participants.some(p => p.real && JSON.stringify(p) === JSON.stringify(r.winner)))) throw new Error('Invalid saved winner.')
      if (!r.winner) unfinished = true
    })
    assertUnique(assigned)
    if (assigned.length !== people.length) throw new Error('Saved draw is missing participants.')
  }
  return state
}

export function winnersCsv(state: DrawState) {
  const escape = (s: string) => `"${(/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`
  return '\uFEFF' + [['Round', 'Gift', ...headers], ...state.rounds.flatMap((r, i) => r.winner ? [[String(i + 1), state.gifts[i].name, r.winner.coupon, r.winner.name, r.winner.phone, r.winner.week, r.winner.status, r.winner.activated]] : [])].map(row => row.map(escape).join(',')).join('\r\n')
}
