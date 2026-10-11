import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomWinners } from '../src/CustomWinners'
import type { WinnerSaveResult } from '../src/CustomWinners'
import { SeedSetup } from '../src/SeedSetup'
import type { DrawState, Participant } from '../src/draw'

const participant: Participant = { coupon: '00123', name: 'Asha', phone: '9800000000', week: '1', status: 'Activated', activated: '2026-09-01', real: true }
const setup = (): DrawState => ({ real: [participant], fake: [{ ...participant, coupon: 'DISPLAY-ONLY', real: false }], gifts: [{ id: 'gift-id', code: 'PRIZE-AB123456', name: 'Smart watch', image: 'data:image/png;base64,AA==' }], rounds: [] })
const onSave = (): WinnerSaveResult => ({ ok: true, coupon: '' })

test('seed rows show prize name, permanent code, coupon field and just one save button', () => {
  const html = renderToStaticMarkup(<CustomWinners state={setup()} disabled={false} onSave={onSave} />)
  expect(html).toContain('Smart watch')
  expect(html).toContain('PRIZE-AB123456')
  expect(html).toContain('placeholder="Random winner"')
  expect(html).toContain('value="00123"')
  expect(html).not.toContain('DISPLAY-ONLY')
  expect(html.match(/<input /g)).toHaveLength(1)
  expect(html.match(/<button /g)).toHaveLength(1)
  expect(html).not.toContain('ROUND')
  expect(html).not.toContain('Use random winner')
})

test('seed assignments cannot be entered until gifts and real participants exist', () => {
  const state = setup()
  state.gifts = []
  let html = renderToStaticMarkup(<CustomWinners state={state} disabled={false} onSave={onSave} />)
  expect(html).toContain('Add gifts in the Draw studio before assigning winners.')
  expect(html).not.toContain('<input')
  expect(html).not.toContain('<button')
  state.gifts = setup().gifts
  state.real = []
  html = renderToStaticMarkup(<CustomWinners state={state} disabled={false} onSave={onSave} />)
  expect(html).toContain('Upload real participants')
  expect(html.match(/disabled=""/g)).toHaveLength(2)
})

test('seed restores the saved coupon and shows lock and save notices', () => {
  const state = setup()
  state.gifts[0].customWinnerCoupon = '00123'
  state.rounds = [{ giftId: 'gift-id', participants: [participant], customWinnerCoupon: '00123' }]
  const html = renderToStaticMarkup(<SeedSetup state={state} disabled={true} busy={false} notice="Saved assignment" storageError="" onClose={() => {}} onSave={onSave} />)
  expect(html).toContain('value="00123"')
  expect(html).toContain('Reset winners in the Draw studio')
  expect(html).toContain('Saved assignment')
  expect(html).toContain('role="status"')
  expect(html).not.toContain('Display-only participant setup')
})
