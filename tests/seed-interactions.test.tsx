import { afterAll, afterEach, expect, mock, test } from 'bun:test'
import { act, useState } from 'react'
import { Window } from 'happy-dom'
import { CustomWinners } from '../src/CustomWinners'
import type { WinnerSaveResult } from '../src/CustomWinners'
import { SeedSetup } from '../src/SeedSetup'
import App from '../src/App'
import { setCustomWinner, storageKey } from '../src/draw'
import type { DrawState, Participant } from '../src/draw'

const window = new Window()
const globals = { window, document: window.document, navigator: window.navigator, location: window.location, history: window.history, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
Object.entries(globals).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }))
const { createRoot } = await import('react-dom/client')
const container = window.document.createElement('div')
window.document.body.append(container)
let root: ReturnType<typeof createRoot> | undefined

afterEach(async () => { if (root) await act(async () => { root?.unmount() }); root = undefined; container.innerHTML = '' })
afterAll(() => {
  originals.forEach((descriptor, key) => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) })
  void window.happyDOM.close()
})

const person: Participant = { coupon: '00123', name: 'Asha', phone: '9800000000', week: '1', status: 'Activated', activated: 'date', real: true }
const setup = (): DrawState => ({ real: [person, { ...person, coupon: '00234', name: 'Sita' }], fake: [], gifts: [{ id: 'watch', code: 'PRIZE-WATCH', name: 'Smart watch', image: 'data:image/png;base64,AA==' }], rounds: [] })
const input = () => container.querySelector('form input')!
const button = () => container.querySelector('form button')!
async function edit(coupon: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input(), coupon)
    input().dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function mount(element: React.ReactNode) { root = createRoot(container); await act(async () => { root!.render(element) }) }
async function click(element: { click: () => void }) { await act(async () => { element.click() }) }
const noSave = (): WinnerSaveResult => ({ ok: false, error: 'Unexpected save attempt.' })

test('unchanged random winner cannot be saved again', async () => {
  await mount(<CustomWinners state={setup()} disabled={false} onSave={noSave} />)
  expect(button().disabled).toBe(true)
  expect(button().textContent).toBe('Random')
})

test('save feedback survives parent state updates; editing clears it and blank saves random selection', async () => {
  function Harness() {
    const [state, setState] = useState(setup)
    return <CustomWinners state={state} disabled={false} onSave={(code, coupon): WinnerSaveResult => {
      const next = setCustomWinner(state, code, coupon)
      setState(next)
      return { ok: true, coupon: next.gifts[0].customWinnerCoupon || '' }
    }} />
  }
  await mount(<Harness />)
  await edit('00123')
  expect(button().disabled).toBe(false)
  await click(button())
  expect(button().textContent).toBe('Saved')
  expect(button().disabled).toBe(true)
  expect(container.querySelector('[role="status"]')?.textContent).toContain('saved')
  await edit('')
  expect(button().disabled).toBe(false)
  expect(container.querySelector('[role="status"]')?.textContent).not.toContain('Winner saved')
  await click(button())
  expect(button().textContent).toBe('Random')
  expect(container.querySelector('[role="status"]')?.textContent).toContain('Random selection saved')
})

test('failed saves are red field errors and keep the draft editable for retry', async () => {
  const onSave = mock((): WinnerSaveResult => ({ ok: false, error: 'Storage is full. Try again.' }))
  await mount(<CustomWinners state={setup()} disabled={false} onSave={onSave} />)
  await edit('00123')
  await click(button())
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(input().getAttribute('aria-invalid')).toBe('true')
  const error = container.querySelector('[role="alert"]')
  expect(error?.textContent).toContain('Storage is full')
  expect(error?.className).toContain('text-red-')
  expect(input().className).toContain('border-red-')
  expect(input().value).toBe('00123')
  expect(button().disabled).toBe(false)
  await edit('00234')
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(input().getAttribute('aria-invalid')).not.toBe('true')
})

test('unknown coupons are rejected inline without calling persistence', async () => {
  const onSave = mock((): WinnerSaveResult => ({ ok: true, coupon: 'unknown' }))
  await mount(<CustomWinners state={setup()} disabled={false} onSave={onSave} />)
  await edit('unknown')
  await click(button())
  expect(onSave).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('real participant')
  expect(input().getAttribute('aria-invalid')).toBe('true')
})

test('saving disables repeated submits and input until the save finishes', async () => {
  let finish!: (value: { ok: true; coupon: string }) => void
  const onSave = mock(() => new Promise<{ ok: true; coupon: string }>(resolve => { finish = resolve }))
  await mount(<CustomWinners state={setup()} disabled={false} onSave={onSave} />)
  await edit('00123')
  await click(button())
  expect(button().textContent).toBe('Saving…')
  expect(button().disabled).toBe(true)
  expect(input().disabled).toBe(true)
  await click(button())
  expect(onSave).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ ok: true, coupon: '00123' }) })
  expect(button().textContent).toBe('Saved')
  expect(input().disabled).toBe(false)
})

test('closing warns before discarding unsaved edits and keep editing preserves the draft', async () => {
  const onClose = mock(() => {})
  await mount(<SeedSetup state={setup()} disabled={false} busy={false} notice="" storageError="" onSave={noSave} onClose={onClose} />)
  await edit('00123')
  await click(container.querySelector<HTMLButtonElement>('[aria-label="Close custom winners"]')!)
  expect(onClose).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Discard unsaved')
  const keepEditing = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Keep editing')!
  await click(keepEditing)
  expect(input().value).toBe('00123')
  expect(onClose).not.toHaveBeenCalled()
})

test('the real app displays failed local-storage saves as red errors, not green notices', async () => {
  window.happyDOM.setURL('http://localhost/#seed')
  const json = JSON.stringify(setup())
  const originalStorage = globalThis.localStorage
  const setItem = mock(() => { throw new DOMException('Storage full', 'QuotaExceededError') })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === storageKey ? json : null, setItem } })
  try {
    await mount(<App />)
    await edit('00123')
    await click(button())
    expect(setItem).toHaveBeenCalledTimes(1)
    const error = container.querySelector('form [role="alert"]')
    expect(error?.textContent).toContain('storage is full')
    expect(error?.className).toContain('text-red-')
    expect(input().value).toBe('00123')
    expect(button().disabled).toBe(false)
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: originalStorage }) }
})

test('duplicate coupons name the conflicting prize and do not change other rows', async () => {
  const state = setup()
  state.gifts.push({ ...state.gifts[0], id: 'speaker', code: 'PRIZE-SPEAKER', name: 'Speaker', customWinnerCoupon: '00123' })
  const onSave = mock(noSave)
  await mount(<CustomWinners state={state} disabled={false} onSave={onSave} />)
  await edit('00123')
  await click(button())
  expect(onSave).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Speaker (PRIZE-SPEAKER)')
  expect(container.querySelectorAll('form input')[1].getAttribute('value')).toBe('00123')
  expect(container.querySelectorAll('form button')[1].textContent).toBe('Saved')
})

test('a failed save can be retried without losing the draft', async () => {
  const onSave = mock((): WinnerSaveResult => onSave.mock.calls.length === 1 ? { ok: false, error: 'Please retry.' } : { ok: true, coupon: '00123' })
  await mount(<CustomWinners state={setup()} disabled={false} onSave={onSave} />)
  await edit('00123')
  await click(button())
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Please retry.')
  expect(button().disabled).toBe(false)
  await click(button())
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(button().textContent).toBe('Saved')
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Winner saved.')
})

test('discard closes without saving, while Escape also protects dirty edits', async () => {
  const onClose = mock(() => {})
  const onSave = mock(noSave)
  await mount(<SeedSetup state={setup()} disabled={false} busy={false} notice="" storageError="" onSave={onSave} onClose={onClose} />)
  await edit('00123')
  await act(async () => { container.querySelector('dialog')!.dispatchEvent(new window.Event('cancel', { cancelable: true })) })
  expect(onClose).not.toHaveBeenCalled()
  const discard = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Discard changes')!
  await click(discard)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onSave).not.toHaveBeenCalled()
})

test('closing and other rows are blocked while a save is pending', async () => {
  const state = setup()
  state.gifts.push({ ...state.gifts[0], id: 'speaker', code: 'PRIZE-SPEAKER', name: 'Speaker' })
  let finish!: (value: WinnerSaveResult) => void
  const onSave = () => new Promise<WinnerSaveResult>(resolve => { finish = resolve })
  const onClose = mock(() => {})
  await mount(<SeedSetup state={state} disabled={false} busy={false} notice="" storageError="" onSave={onSave} onClose={onClose} />)
  await edit('00123')
  await click(button())
  const close = container.querySelector<HTMLButtonElement>('[aria-label="Close custom winners"]')!
  expect(close.disabled).toBe(true)
  expect(container.querySelectorAll('form input')[1].hasAttribute('disabled')).toBe(true)
  await click(close)
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => { finish({ ok: true, coupon: '00123' }) })
  expect(close.disabled).toBe(false)
  await click(close)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('the real app persists a winner, marks it saved, and closes without a discard warning', async () => {
  window.happyDOM.setURL('http://localhost/#seed')
  let json = JSON.stringify(setup())
  const originalStorage = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => key === storageKey ? json : null,
    setItem: (_key: string, value: string) => { json = value },
  } })
  try {
    await mount(<App />)
    await edit('00123')
    await click(button())
    expect(JSON.parse(json).gifts[0].customWinnerCoupon).toBe('00123')
    expect(button().textContent).toBe('Saved')
    expect(container.querySelector('form [role="status"]')?.textContent).toBe('Winner saved.')
    await click(container.querySelector<HTMLButtonElement>('[aria-label="Close custom winners"]')!)
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.textContent).not.toContain('Discard unsaved')
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: originalStorage }) }
})

test('another-tab storage changes are shown as a red field error and never overwrite saved data', async () => {
  window.happyDOM.setURL('http://localhost/#seed')
  let json = JSON.stringify(setup())
  const originalStorage = globalThis.localStorage
  const setItem = mock(() => {})
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => key === storageKey ? json : null,
    setItem,
  } })
  try {
    await mount(<App />)
    json = JSON.stringify({ ...setup(), real: [] })
    await edit('00123')
    await click(button())
    expect(setItem).not.toHaveBeenCalled()
    expect(container.querySelector('form [role="alert"]')?.textContent).toContain('another tab')
    expect(container.querySelector('form [role="alert"]')?.className).toContain('text-red-')
    expect(input().value).toBe('00123')
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: originalStorage }) }
})
