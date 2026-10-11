import { useEffect, useId, useRef, useState } from 'react'
import type { DrawState, Gift } from './draw'

export type WinnerSaveResult = { ok: true; coupon: string } | { ok: false; error: string }
export type SaveWinner = (prizeCode: string, coupon: string) => WinnerSaveResult | Promise<WinnerSaveResult>
export type WinnerDraftStatus = { dirty: boolean; saving: boolean }
type DraftChange = (prizeCode: string, status: WinnerDraftStatus) => void
type Feedback = { kind: 'success' | 'error'; message: string }
const normalize = (coupon: string) => coupon.trim().toLowerCase()

export function CustomWinners({ state, disabled, onSave, onDraftChange }: { state: DrawState; disabled: boolean; onSave: SaveWinner; onDraftChange?: DraftChange }) {
  const couponListId = useId()
  return <section aria-label="Prize winner assignments">
    {!state.gifts.length ? <p className="rounded-xl bg-paper p-5 text-sm text-muted">Add gifts in the Draw studio before assigning winners.</p> : <>
      {!state.real.length && <p className="mb-4 text-sm text-muted">Upload real participants in the Draw studio to select coupon codes.</p>}
      <datalist id={couponListId}>{state.real.map(p => <option key={p.coupon} value={p.coupon}>{p.name}</option>)}</datalist>
      <div className="grid gap-2">{state.gifts.map(gift => <WinnerAssignment key={gift.id} gift={gift} state={state} couponListId={couponListId} disabled={disabled || !state.real.length} onSave={onSave} onDraftChange={onDraftChange} />)}</div>
    </>}
  </section>
}

function WinnerAssignment({ gift, state, couponListId, disabled, onSave, onDraftChange }: { gift: Gift; state: DrawState; couponListId: string; disabled: boolean; onSave: SaveWinner; onDraftChange?: DraftChange }) {
  const [coupon, setCoupon] = useState(gift.customWinnerCoupon || '')
  const [savedCoupon, setSavedCoupon] = useState(gift.customWinnerCoupon || '')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const messageId = useId()
  const dirty = normalize(coupon) !== normalize(savedCoupon)
  const entrant = state.real.find(p => p.real && normalize(p.coupon) === normalize(coupon))
  const otherPrize = state.gifts.find(g => g.id !== gift.id && g.customWinnerCoupon && normalize(g.customWinnerCoupon) === normalize(coupon))
  const validationError = !coupon.trim() ? '' : !entrant ? 'No real participant has this coupon code.' : otherPrize ? `This coupon is already assigned to ${otherPrize.name} (${otherPrize.code}).` : ''
  const error = feedback?.kind === 'error' ? feedback.message : touched ? validationError : ''
  const blocked = disabled || saving
  const message = error || (feedback?.kind === 'success' ? feedback.message : dirty ? coupon.trim() ? 'Unsaved changes.' : 'Save to use a random winner.' : '')

  useEffect(() => {
    setCoupon(gift.customWinnerCoupon || '')
    setSavedCoupon(gift.customWinnerCoupon || '')
  }, [gift.customWinnerCoupon])
  useEffect(() => { onDraftChange?.(gift.code, { dirty, saving }) }, [gift.code, dirty, saving, onDraftChange])
  useEffect(() => () => { onDraftChange?.(gift.code, { dirty: false, saving: false }) }, [gift.code, onDraftChange])

  async function save() {
    if (disabled || inFlight.current || !dirty) return
    setTouched(true)
    setFeedback(null)
    if (validationError) return
    inFlight.current = true; setSaving(true)
    try {
      const result = await onSave(gift.code, coupon.trim())
      if (!result.ok) { setFeedback({ kind: 'error', message: result.error }); return }
      setCoupon(result.coupon); setSavedCoupon(result.coupon); setTouched(false)
      setFeedback({ kind: 'success', message: result.coupon ? 'Winner saved.' : 'Random selection saved.' })
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save. Please try again.' })
    } finally { inFlight.current = false; setSaving(false) }
  }

  return <form aria-busy={saving} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] ${error ? 'border-red-200 bg-red-50/40' : 'border-line bg-paper/50'}`} onSubmit={e => { e.preventDefault(); void save() }}>
    <h3 className="text-sm font-semibold wrap-anywhere">{gift.name}</h3>
    <code className="text-xs text-muted">{gift.code}</code>
    <input type="text" list={couponListId} value={coupon} disabled={blocked} onChange={e => { setCoupon(e.target.value); setFeedback(null); setTouched(false) }} onBlur={() => setTouched(true)} placeholder="Random winner" aria-label={`Winner coupon for ${gift.name} (${gift.code})`} aria-invalid={!!error} aria-describedby={message ? messageId : undefined} autoComplete="off" spellCheck={false} className={`min-w-0 w-full rounded-lg border bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-red-500 focus-visible:outline-red-600' : 'border-line'}`} />
    <button type="submit" disabled={blocked || !dirty} className="min-w-20 rounded-lg px-4 py-2.5 text-sm font-semibold btn-primary" aria-label={`${saving ? 'Saving winner' : dirty ? 'Save winner' : savedCoupon ? 'Winner saved' : 'Random winner'} for ${gift.code}`}>{saving ? 'Saving…' : dirty ? 'Save' : savedCoupon ? 'Saved' : 'Random'}</button>
    {message && <p id={messageId} role={error ? 'alert' : 'status'} className={`col-span-2 text-xs leading-relaxed wrap-anywhere sm:col-start-3 ${error ? 'text-red-700' : feedback?.kind === 'success' ? 'text-brand' : 'text-muted'}`}>{message}</p>}
  </form>
}
