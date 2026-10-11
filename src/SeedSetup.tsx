import { useCallback, useEffect, useRef, useState } from 'react'
import { CustomWinners } from './CustomWinners'
import type { SaveWinner, WinnerDraftStatus } from './CustomWinners'
import type { DrawState } from './draw'

export function SeedSetup({ state, disabled, busy, notice, storageError, onClose, onSave }: { state: DrawState; disabled: boolean; busy: boolean; notice: string; storageError: string; onClose: () => void; onSave: SaveWinner }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [drafts, setDrafts] = useState<Record<string, WinnerDraftStatus>>({})
  const [confirmClose, setConfirmClose] = useState(false)
  const saving = Object.values(drafts).some(d => d.saving)
  const dirty = Object.values(drafts).some(d => d.dirty)
  const onDraftChange = useCallback((code: string, status: WinnerDraftStatus) => {
    setDrafts(previous => previous[code]?.dirty === status.dirty && previous[code]?.saving === status.saving ? previous : { ...previous, [code]: status })
  }, [])
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => { if (!dirty) setConfirmClose(false) }, [dirty])
  function requestClose() {
    if (busy || saving) return
    if (dirty) { setConfirmClose(true); return }
    onClose()
  }
  return <dialog ref={dialog} aria-labelledby="seed-title" onCancel={e => { e.preventDefault(); requestClose() }} className="m-auto max-h-[90vh] w-[min(900px,94vw)] overflow-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id="seed-title" className="text-xl font-semibold">Custom winners</h2>
      <button aria-label="Close custom winners" disabled={busy || saving} onClick={requestClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted disabled:opacity-50">Close</button>
    </div>
    <p className="mb-4 text-sm text-muted">Blank coupon = random winner. Save before preparing the draw.</p>
    {state.rounds.length > 0 && <p className="mb-4 rounded-lg bg-paper p-3 text-sm text-muted">Settings are locked. Reset winners in the Draw studio to edit them.</p>}
    {storageError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{storageError}</p>}
    <CustomWinners state={state} disabled={disabled || saving} onSave={onSave} onDraftChange={onDraftChange} />
    {notice && <p role="status" className="mt-4 rounded-lg bg-paper p-3 text-sm text-muted">{notice}</p>}
    {confirmClose && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p>Discard unsaved coupon edits? Saved assignments will stay.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || saving} onClick={() => setConfirmClose(false)} className="rounded-lg px-3 py-2 text-sm font-semibold btn-primary">Keep editing</button>
        <button disabled={busy || saving} onClick={onClose} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Discard changes</button>
      </div>
    </div>}
  </dialog>
}
