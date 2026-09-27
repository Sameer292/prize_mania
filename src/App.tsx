import { useEffect, useRef, useState } from 'react'
import { assertUnique, headers, parseParticipants, prepareRounds, randomIndex, resetDraw, roundSizes, selectWinner, storageKey, validateState, winnersCsv } from './draw'
import type { DrawState, Gift, ResetPart, Round } from './draw'
import { Cylinder, Wheel, spinDuration } from './Selector'

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    gift: 'M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8z M12 8h4.5A2.5 2.5 0 1 0 14 5.5L12 8z',
    trophy: 'M8 3h8v7a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v5 M8 21h8 M9 19h6',
    upload: 'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    check: 'M5 12l4 4L19 6',
    plus: 'M12 5v14 M5 12h14',
    close: 'M6 6l12 12 M6 18L18 6',
    download: 'M12 3v13 M7 11l5 5 5-5 M3 16v5h18v-5',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
    reset: 'M3 10a9 9 0 1 1 2 9 M3 3v7h7',
    sparkle: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.sparkle} /></svg>
}

function giftImage(kind: string, color: string) {
  const art: Record<string, string> = {
    headphones: '<path d="M64 110V86a46 46 0 0 1 92 0v24" fill="none" stroke="#292637" stroke-width="16"/><path d="M66 102V85a44 44 0 0 1 88 0v17" fill="none" stroke="#686378" stroke-width="5"/><rect x="49" y="94" width="30" height="53" rx="13" fill="#292637"/><rect x="141" y="94" width="30" height="53" rx="13" fill="#292637"/><rect x="57" y="100" width="14" height="40" rx="7" fill="#514b63"/><rect x="149" y="100" width="14" height="40" rx="7" fill="#514b63"/>',
    watch: '<rect x="94" y="22" width="34" height="139" rx="14" fill="#b6afa1"/><rect x="79" y="60" width="65" height="76" rx="19" fill="#d8d4ca"/><rect x="85" y="66" width="53" height="64" rx="14" fill="#252b30"/><circle cx="111" cy="97" r="18" fill="none" stroke="#c7dfb2" stroke-width="4"/><path d="M111 84v14l9 5" fill="none" stroke="white" stroke-width="3"/><rect x="143" y="83" width="5" height="12" rx="2" fill="#9d988d"/>',
    speaker: '<rect x="74" y="35" width="73" height="123" rx="32" fill="#333844"/><rect x="81" y="43" width="59" height="108" rx="26" fill="#4c5260"/><path d="M92 59v73 M101 53v86 M110 51v90 M119 53v86 M128 59v73" stroke="#6c7380" stroke-width="2" stroke-dasharray="2 3"/><path d="M105 93h12 M111 87v12" stroke="#eff0ee" stroke-width="3"/><path d="M89 40q22-24 43 0" fill="none" stroke="#333844" stroke-width="6"/>',
    gift: '<rect x="63" y="83" width="96" height="73" rx="6" fill="#b490cb"/><rect x="57" y="72" width="108" height="25" rx="5" fill="#c9a4dd"/><path d="M110 72v84" stroke="#fff4db" stroke-width="15"/><path d="M110 73C60 69 72 29 94 45c12 8 16 28 16 28z M110 73c50-4 38-44 16-28-12 8-16 28-16 28z" fill="none" stroke="#fff4db" stroke-width="10"/>',
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 180"><rect width="220" height="180" rx="12" fill="${color}"/><ellipse cx="110" cy="160" rx="57" ry="8" fill="#000" opacity=".07"/>${art[kind] || art.gift}</svg>`)
}
const initialGifts: Gift[] = [
  { id: 'headphones', name: 'Wireless headphones', image: giftImage('headphones', '#efe8da') },
  { id: 'watch', name: 'Smart watch', image: giftImage('watch', '#e9eee6') },
  { id: 'speaker', name: 'Bluetooth speaker', image: giftImage('speaker', '#e5eee9') },
  { id: 'gift', name: 'Surprise gift box', image: giftImage('gift', '#f5e8d5') },
]
const emptyState: DrawState = { real: [], fake: [], gifts: initialGifts, rounds: [] }

function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const saved = useRef<string | null>(null)
  const loadError = useRef('')
  const [state, setState] = useState<DrawState>(() => {
    try {
      saved.current = localStorage.getItem(storageKey)
      return saved.current ? validateState(JSON.parse(saved.current)) : emptyState
    } catch {
      loadError.current = 'The saved draw could not be read. Your stored data has not been overwritten. Download a backup or clear it to start again.'
      return emptyState
    }
  })
  const [page, setPage] = useState(location.hash === '#winners' ? 'winners' : 'studio')
  const [privateOpen, setPrivateOpen] = useState(location.hash === '#private')
  const [privateNotice, setPrivateNotice] = useState('')
  const [mode, setMode] = useState<'cylinder' | 'wheel'>('cylinder')
  const [previewGiftId, setPreviewGiftId] = useState('')
  const [toast, setToast] = useState('')
  const [editor, setEditor] = useState<Gift | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stageOpen, setStageOpen] = useState(false)
  const drawing = spinning || countdown !== null
  const [showWinner, setShowWinner] = useState(state.rounds.some(r => r.winner))
  const [rotation, setRotation] = useState(() => {
    const previous = state.rounds.filter(r => r.winner).at(-1)
    return previous ? (360 - (previous.participants.findIndex(p => p.coupon === previous.winner?.coupon) + 0.5) * 360 / previous.participants.length) % 360 : 0
  })
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const [storageError, setStorageError] = useState(loadError.current)
  const total = state.real.length > 0 ? state.real.length + state.fake.length : 0
  const locked = state.rounds.length > 0
  const completed = state.rounds.filter(r => r.winner).length
  const activeIndex = drawing || showWinner ? Math.max(0, completed - 1) : completed
  const round = state.rounds[activeIndex]
  const currentGift = state.gifts[activeIndex]
  const allDone = locked && completed === state.rounds.length && !drawing
  const recentWinner = !drawing ? state.rounds[completed - 1]?.winner : undefined
  let sizes: number[] = []
  try { sizes = roundSizes(total, state.gifts.length) } catch { /* Setup explains missing requirements below. */ }

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 6500)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setStorageError('This draw changed in another tab. Reload this page before continuing.')
    }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('storage', onStorage); if (timer.current) clearTimeout(timer.current) }
  }, [])

  useEffect(() => {
    const onHash = () => {
      setPrivateOpen(location.hash === '#private')
      if (location.hash === '#winners') setPage('winners')
      else if (location.hash !== '#private') setPage('studio')
      setToast('')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function commit(next: DrawState) {
    try {
      if (storageError) throw new Error(storageError)
      if (localStorage.getItem(storageKey) !== saved.current) throw new Error('This draw changed in another tab. Reload before continuing.')
      const json = JSON.stringify(next)
      localStorage.setItem(storageKey, json)
      saved.current = json
      setState(next)
      return true
    } catch (error) {
      setToast(error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'This browser’s storage is full. Use smaller gift images and try again. Your previous draw is unchanged.'
        : error instanceof Error ? error.message : 'Could not save. Your previous draw is unchanged.')
      return false
    }
  }

  async function upload(file: File | undefined, real: boolean) {
    if (!file || locked || inFlight.current) return
    inFlight.current = true; setBusy(true)
    try {
      if (file.size > 3_000_000) throw new Error('Please use a CSV smaller than 3 MB.')
      const people = parseParticipants(await file.text(), real)
      let fake = real ? state.fake : people
      let removed = false
      if (real) {
        try { assertUnique([...people, ...fake]) } catch { fake = []; removed = true }
      } else assertUnique([...state.real, ...people])
      if (commit({ ...state, real: real ? people : state.real, fake })) {
        if (real) setToast(`${people.length} participants added. You’re ready to plan their lucky moment.`)
        else setPrivateNotice(`${people.length} display-only participants imported successfully.`)
        if (removed) setPrivateNotice('The real list was replaced. Overlapping display-only entries were removed; upload a non-overlapping CSV here.')
      }
    } catch (error) { (real ? setToast : setPrivateNotice)((error as Error).message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  function startDraw() {
    try {
      const rounds = prepareRounds(state.real, state.fake, state.gifts)
      if (commit({ ...state, rounds })) { setShowWinner(false); setRotation(0); setPage('studio'); setToast('Rounds are ready. Participants are shuffled and assigned once.') }
    } catch (error) { setToast((error as Error).message) }
  }

  function spin() {
    if (!round || spinning || inFlight.current) return
    try {
      const winner = selectWinner(round)
      const index = round.participants.indexOf(winner)
      const angle = (index + 0.5) * 360 / round.participants.length
      const target = (360 - angle) % 360
      const nextRotation = rotation + 360 * (6 + randomIndex(3)) + ((target - rotation % 360 + 360) % 360)
      const rounds = state.rounds.map((r, i) => i === activeIndex ? { ...r, winner } : r)
      // Commit the outcome before animation so a refresh cannot reroll a winner.
      if (!commit({ ...state, rounds })) return
      inFlight.current = true; setStageOpen(true); setShowWinner(false)
      function reveal() { inFlight.current = false; setShowWinner(true); setSpinning(false); setCountdown(null) }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(); return }
      function count(value: number) {
        setCountdown(value)
        timer.current = setTimeout(() => {
          if (value > 1) count(value - 1)
          else {
            setCountdown(null); setSpinning(true); setRotation(nextRotation)
            timer.current = setTimeout(reveal, spinDuration + 200)
          }
        }, 1000)
      }
      count(3)
    } catch (error) { setToast((error as Error).message) }
  }

  function reset(part: ResetPart = 'winners') {
    if (drawing || busy) return
    const messages = {
      winners: 'Clear all winners and round assignments? Your participants and gifts will stay. Export winners first if you need them.',
      gifts: 'Restore the four starter gifts? All custom gift names and images will be removed. Any rounds and winners will also be cleared. Participants will stay.',
      participants: 'Remove all participants? Any rounds and winners will also be cleared. Gifts will stay.',
      everything: 'Reset everything in this browser? All participants, rounds, winners and custom gifts will be removed. The four starter gifts will be restored.',
    }
    if (!window.confirm(messages[part])) return
    const next = resetDraw(state, part, initialGifts)
    if (commit(next)) { setStageOpen(false); setShowWinner(false); setRotation(0); setPreviewGiftId(''); setToast('Reset complete. You can prepare a fresh draw.') }
  }

  async function setImage(file: File | undefined) {
    if (!file || !editor) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 800_000) { setToast('Use a PNG, JPEG, or WebP image under 800 KB.'); return }
    setBusy(true)
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read image.')); reader.readAsDataURL(file)
      })
      await new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error('This image is damaged or unsupported.')); img.src = image })
      setEditor(previous => previous ? { ...previous, image } : null)
    } catch (error) { setToast((error as Error).message) } finally { setBusy(false) }
  }

  const ready = state.gifts.length > 0 && state.real.length >= state.gifts.length && total >= state.gifts.length + 1 && state.gifts.every(g => g.name.trim() && g.image)
  const previewGift = locked ? currentGift : state.gifts.find(g => g.id === previewGiftId) || state.gifts[0]
  const previewIndex = state.gifts.findIndex(g => g.id === previewGift?.id)

  function closePrivate() {
    if (busy) return
    setToast(''); setPrivateNotice(''); setPrivateOpen(false)
    history.replaceState(null, '', location.pathname + location.search)
  }

  function moveGift(index: number, direction: number) {
    const gifts = [...state.gifts]
    ;[gifts[index], gifts[index + direction]] = [gifts[index + direction], gifts[index]]
    commit({ ...state, gifts })
  }

  function openEditor(gift: Gift) { setToast(''); setEditor({ ...gift }) }

  return <div className="min-h-screen bg-paper">
    <header className="border-b border-line border-t-4 border-t-masala bg-white">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
        <a href="#studio" aria-label="Fresh Masala draw studio" className="flex items-center gap-4">
          <img src="/brand/fresh-masala-logo.png" alt="Fresh Masala" className="h-20 w-36 object-contain sm:h-24 sm:w-44" />
          <span className="hidden border-l border-line pl-5 text-sm font-semibold tracking-[.18em] text-muted lg:block">LUCKY DRAW</span>
        </a>
        <nav className="flex gap-1 rounded-xl bg-paper p-1 sm:gap-2" aria-label="Main navigation">
          <a href="#studio" aria-current={page === 'studio' ? 'page' : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold sm:px-6 sm:text-base ${page === 'studio' ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}><Icon name="grid" /><span>Draw studio</span></a>
          <a href="#winners" aria-current={page === 'winners' ? 'page' : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold sm:px-6 sm:text-base ${page === 'winners' ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}><Icon name="trophy" /><span>Winners</span>{completed > 0 && <span className="rounded-md bg-soft px-2 py-0.5 text-xs text-brand">{completed}</span>}</a>
        </nav>
      </div>
    </header>

    <main className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
      {page === 'studio' ? <>
        <section className="mb-8 grid overflow-hidden rounded-[24px] border border-line bg-cream sm:grid-cols-[1.1fr_1fr]">
          <div className="px-7 py-9 sm:px-10 sm:py-11">
            <span className="mb-4 inline-flex items-center gap-2 text-xs font-bold tracking-[.2em] text-brand"><span className="h-px w-6 bg-brand" /> FRESH MASALA LUCKY DRAW</span>
            <h1 className="font-heading text-[40px] leading-[1.12] tracking-tight sm:text-[48px] xl:text-[58px]">A little spice.<br /><span className="italic text-masala">A lot of luck.</span></h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">A thank-you to the people who make our story special. Let’s make someone’s day.</p>
          </div>
          <div className="relative hidden min-h-[290px] sm:block"><img src="/brand/fresh-masala-banner.jpg" alt="Fresh Masala spice and tea products" className="absolute inset-0 size-full object-cover" /><span className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cream to-transparent" /></div>
        </section>

        <section className="mb-8 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white px-2 py-5 sm:px-6 sm:py-6" aria-label="Draw statistics">
          {[['people', total, 'Participants'], ['gift', state.gifts.length, 'Gifts & rounds'], ['trophy', completed, 'Lucky winners']].map(([icon, number, label]) => <div className="flex items-center justify-center gap-3 px-2 sm:gap-5" key={label}><span className="hidden size-12 items-center justify-center rounded-xl bg-blush text-masala sm:flex"><Icon name={String(icon)} size={25} /></span><div><strong className="block text-center font-sans text-3xl font-semibold tracking-tight sm:text-left sm:text-4xl">{number}</strong><span className="mt-1 block text-center text-xs text-muted sm:text-left sm:text-base">{label}</span></div></div>)}
        </section>

        <section className="mb-8 rounded-2xl border border-brand/25 border-t-4 border-t-masala bg-white p-6 sm:p-8" aria-label="Add participants">
          <div className="flex flex-wrap items-center justify-between gap-5"><div><span className="text-xs font-bold tracking-[.18em] text-masala">THE PEOPLE BEHIND THE MOMENT</span><h2 className="mt-2 font-heading text-3xl">Add your participants.</h2><p className="mt-2 text-base text-muted">{locked ? `${state.real.length} participants registered. The list is locked for this draw.` : `${state.real.length} participants registered. Upload your CSV to get started.`}</p></div><div className="flex flex-wrap items-center gap-3">
            {!locked && <label className={`relative flex items-center gap-2 rounded-xl px-6 py-4 text-base font-semibold focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-brand ${busy || storageError ? 'pointer-events-none bg-[#e0e8e3] text-[#40554a]' : 'btn-primary cursor-pointer'}`}><Icon name="upload" /> {busy ? 'Reading file…' : state.real.length ? 'Replace participant CSV' : 'Upload participants CSV'}<input type="file" accept=".csv,text/csv" aria-label="Upload real participants CSV" className="absolute size-px opacity-0" disabled={locked || busy || !!storageError} onChange={e => { void upload(e.target.files?.[0], true); e.target.value = '' }} /></label>}
            <button className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-base font-semibold text-brand" onClick={() => download('participants-template.csv', headers.join(',') + '\r\n')}><Icon name="download" /> CSV template</button>
            {!locked && state.real.length > 0 && <button className="px-3 py-3 text-sm font-semibold text-masala" disabled={busy || !!storageError} onClick={() => { if (window.confirm('Remove registered participants?')) commit({ ...state, real: [] }) }}>Clear participants</button>}
          </div></div>
          {!locked && <p className="mt-4 text-sm leading-relaxed text-muted">CSV up to 3 MB · Coupon code, Participant name, Phone number, week number, status, Activated at. Each upload replaces the current list.</p>}
        </section>

        {storageError && <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-base text-amber-900">The saved draw needs attention. Please reload this page before continuing.</div>}

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-[24px] border border-line bg-white p-6 sm:p-8" aria-label="Gift lineup">
            <div className="mb-6 flex items-start justify-between gap-3"><div><span className="text-xs font-bold tracking-[.18em] text-masala">THE GIFT LINEUP</span><h2 className="mt-2 font-heading text-[30px]">Something to smile about.</h2></div>{!locked && <button className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-brand hover:bg-soft" aria-label="Add gift" disabled={busy || !!storageError} onClick={() => openEditor({ id: crypto.randomUUID(), name: '', image: giftImage('gift', '#edf5ee') })}><Icon name="plus" size={22} /></button>}</div>

            {previewGift ? <article className="mb-6 overflow-hidden rounded-2xl border border-line">
              <div className="relative flex h-[270px] items-center justify-center bg-cream sm:h-[300px]">
                <img src={previewGift.image} alt={previewGift.name} className="size-full object-contain" />
                <span className="absolute top-4 left-4 rounded-full border border-line bg-white/95 px-4 py-2 text-xs font-semibold tracking-wide text-brand">ROUND {String(previewIndex + 1).padStart(2, '0')}</span>
                {!locked && <button className="absolute right-4 bottom-4 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-brand" disabled={busy} onClick={() => openEditor(previewGift)}>Edit gift</button>}
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-5"><div><h3 className="text-xl font-semibold">{previewGift.name}</h3><p className="mt-1 text-sm text-muted">One gift. One happy winner.</p></div><span className="text-3xl text-brand">✦</span></div>
            </article> : <p className="rounded-xl bg-paper p-8 text-center text-muted">Add a gift to begin.</p>}

            <div className="grid gap-3">{state.gifts.map((gift, i) => <div key={gift.id} className={`flex items-center gap-3 rounded-xl border p-3 ${previewGift?.id === gift.id ? 'border-masala/30 bg-blush/70' : 'border-line'}`}>
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-disabled={locked} onClick={() => { if (!locked) setPreviewGiftId(gift.id) }} aria-label={`Preview ${gift.name}`}><img src={gift.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" /><span className="min-w-0"><small className="block text-[11px] font-semibold tracking-widest text-muted">ROUND {String(i + 1).padStart(2, '0')}</small><strong className="mt-1 block text-sm font-semibold wrap-anywhere sm:text-base">{gift.name}</strong>{state.rounds[i]?.winner && !(drawing && i === activeIndex) && <span className="mt-1 flex items-center gap-1 text-xs text-brand"><Icon name="check" size={14} /> {state.rounds[i].winner?.name}</span>}</span></button>
              {!locked && <div className="flex shrink-0 flex-col"><button className="px-2 py-1 text-brand" disabled={i === 0 || busy} aria-label={`Move ${gift.name} earlier`} onClick={() => moveGift(i, -1)}>↑</button><button className="px-2 py-1 text-brand" disabled={i === state.gifts.length - 1 || busy} aria-label={`Move ${gift.name} later`} onClick={() => moveGift(i, 1)}>↓</button></div>}{state.rounds[i]?.winner && !(drawing && i === activeIndex) && <Icon name="check" />}
            </div>)}</div>
            {!locked && <p className="mt-5 text-sm leading-relaxed text-muted">Arrange the gifts in the order you’d like to give them.</p>}
          </section>

          <section className="rounded-[24px] border border-brand/25 border-t-4 border-t-brand bg-white p-6 sm:p-8" aria-label="Winner selector">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><span className="text-xs font-bold tracking-[.18em] text-brand">{allDone ? 'EVERY GIFT HAS A WINNER' : locked ? `ROUND ${String(activeIndex + 1).padStart(2, '0')} OF ${String(state.gifts.length).padStart(2, '0')}` : 'LET THE GOOD LUCK BEGIN'}</span><h2 className="mt-2 font-heading text-[32px] sm:text-[38px]">{allDone ? 'What a lovely celebration.' : showWinner ? 'We have a winner!' : spinning ? 'A moment of suspense…' : 'Who’s the lucky one?'}</h2></div><div className="flex gap-1 rounded-xl bg-paper p-1" role="group" aria-label="Selector style">{(['cylinder', 'wheel'] as const).map(value => <button key={value} disabled={drawing} aria-pressed={mode === value} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === value ? 'bg-white text-brand shadow-sm' : 'text-muted'}`} onClick={() => setMode(value)}>{value === 'cylinder' ? 'Cylinder' : 'Wheel'}</button>)}</div></div>
            <p className="mb-7 text-base text-muted">{locked && currentGift ? currentGift.name : 'A little anticipation. A moment to remember.'}</p>
            <div className="flex min-h-[390px] items-center justify-center">{mode === 'cylinder' ? <Cylinder key={round?.giftId || 'preview'} round={round} spinning={spinning} /> : <Wheel round={round} spinning={spinning} rotation={rotation} />}</div>
            <div className="mt-7 text-center">
              {!locked ? <button className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold shadow-[0_8px_25px_-10px_#087d6860] btn-primary" disabled={!ready || busy || !!storageError} onClick={startDraw}><Icon name="sparkle" size={24} /> Prepare the draw <Icon name="arrow" size={22} /></button> : allDone ? <a href="#winners" className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold btn-primary"><Icon name="trophy" size={24} /> See your winners <Icon name="arrow" size={22} /></a> : <button className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold shadow-[0_8px_25px_-10px_#c8202f60] btn-celebrate" disabled={drawing || !!storageError} onClick={() => { if (showWinner) { setShowWinner(false); setRotation(0) } else spin() }}><Icon name="sparkle" size={24} /> {spinning ? 'Good luck, everyone…' : showWinner ? 'Next round' : `Spin round ${activeIndex + 1}`} {!spinning && <Icon name="arrow" size={22} />}</button>}
              <p className="mt-4 text-sm text-muted">{allDone ? 'Thank you for being part of our story.' : !ready && !locked ? 'Your next celebration is being prepared.' : spinning ? 'The suspense is part of the fun.' : showWinner ? 'A special gift has found its person.' : locked ? `${round?.participants.length ?? 0} names. One special moment.` : `${state.gifts.length} gifts. ${state.gifts.length} moments to remember.`}</p>
            </div>
            {recentWinner && !stageOpen && <div className="mt-8 flex items-center gap-4 rounded-2xl border border-brand/25 bg-soft p-5 sm:p-6" role="status"><span className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-brand"><Icon name="trophy" size={30} /></span><div className="min-w-0"><span className="text-xs font-bold tracking-widest text-brand">ROUND {completed} WINNER</span><h3 className="mt-2 font-heading text-[30px] leading-tight wrap-anywhere">{recentWinner.name}</h3><p className="mt-2 text-base text-muted">{state.gifts[completed - 1].name}</p><p className="mt-1 text-sm text-muted">Coupon {recentWinner.coupon}</p></div><span className="ml-auto hidden text-4xl text-masala sm:block">✦</span></div>}
          </section>
        </div>
      </> : <section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><span className="text-xs font-bold tracking-[.2em] text-brand">THE WINNER’S CIRCLE</span><h1 className="mt-3 font-heading text-4xl sm:text-5xl">Good luck looks good on them.</h1><p className="mt-4 text-lg text-muted">A little celebration for every lucky winner.</p></div><button className="flex items-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold btn-primary" disabled={!completed || drawing} onClick={() => download('fresh-masala-winners.csv', winnersCsv(state))}><Icon name="download" /> Export winners</button></div>
        {completed && !drawing ? <div className="grid gap-5 md:grid-cols-2">{state.rounds.flatMap((r, i) => r.winner ? [<article className="flex items-center gap-5 rounded-2xl border border-line border-t-4 border-t-masala bg-white p-5 sm:p-7" key={r.giftId}><img src={state.gifts[i].image} alt={state.gifts[i].name} className="size-24 shrink-0 rounded-xl object-cover sm:size-32" /><div className="min-w-0"><span className="text-xs font-bold tracking-wider text-brand">ROUND {String(i + 1).padStart(2, '0')}</span><h2 className="mt-2 font-heading text-2xl wrap-anywhere sm:text-3xl">{r.winner.name}</h2><p className="mt-2 text-base font-semibold">{state.gifts[i].name}</p><p className="mt-3 text-sm text-muted">Coupon: {r.winner.coupon}</p><p className="mt-1 text-sm text-muted">Phone: {r.winner.phone}</p></div></article>] : [])}</div> : <div className="rounded-[24px] border border-line bg-white px-5 py-20 text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-soft text-brand"><Icon name="trophy" size={40} /></span><h2 className="mt-6 font-heading text-3xl">{spinning ? 'A moment of suspense…' : 'Good luck is on its way.'}</h2><p className="mt-4 text-lg text-muted">Your winners will appear here after each round.</p><a href="#studio" className="mt-7 inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-base font-semibold text-brand">Back to draw studio <Icon name="arrow" /></a></div>}
      </section>}
      <details className="mt-8 rounded-2xl border border-masala/20 bg-blush/60 p-5 sm:p-6">
        <summary className="cursor-pointer text-base font-semibold text-masala">Reset & start over</summary>
        <p className="mt-4 text-sm leading-relaxed text-muted">Reset individual parts or prepare a completely fresh celebration. Export winners before clearing them.</p>
        <div className="mt-4 flex flex-wrap gap-3">{(['gifts', 'winners', 'participants', 'everything'] as const).map(part => <button key={part} className={`rounded-xl px-5 py-3 text-base font-semibold ${part === 'everything' ? 'btn-celebrate' : 'border border-masala/25 bg-white text-masala disabled:text-muted'}`} disabled={drawing || busy || !!storageError} onClick={() => reset(part)}>Reset {part}</button>)}</div>
      </details>
      <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted sm:flex-row"><span>Fresh Masala · Made for moments worth celebrating.</span><span>Good taste. Great memories.</span></footer>
    </main>

    {stageOpen && round && currentGift && <RevealStage round={round} gift={currentGift} number={activeIndex + 1} count={state.gifts.length} countdown={countdown} spinning={spinning} mode={mode} rotation={rotation} onClose={() => setStageOpen(false)} onNext={() => { setStageOpen(false); if (allDone) location.hash = 'winners'; else { setShowWinner(false); setRotation(0) } }} />}
    {toast && !editor && !privateOpen && <div role="status" className="fixed bottom-6 left-1/2 z-30 flex w-[90vw] max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-5 py-4 text-base text-white shadow-xl"><Icon name="sparkle" /><span className="flex-1">{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" /></button></div>}
    {privateOpen && <PrivateSetup state={state} sizes={sizes} busy={busy} spinning={drawing} locked={locked} storageError={storageError} notice={privateNotice || toast} onClose={closePrivate} onUpload={(file, real) => void upload(file, real)} onTemplate={() => download('participants-template.csv', headers.join(',') + '\r\n')} onClear={() => { if (window.confirm('Remove display-only participants?')) commit({ ...state, fake: [] }) }} onReset={() => reset()} onBackup={() => { try { const data = localStorage.getItem(storageKey); if (data) download('prize-mania-backup.json', data, 'application/json') } catch { setPrivateNotice('Storage is unavailable.') } }} onClearSaved={() => { if (window.confirm('Clear this browser’s entire saved draw?')) { try { localStorage.removeItem(storageKey); location.reload() } catch { setPrivateNotice('Storage is unavailable.') } } }} />}
    {editor && <GiftEditor gift={editor} notice={toast} busy={busy} existing={state.gifts.some(g => g.id === editor.id)} onClose={() => setEditor(null)} onName={name => setEditor({ ...editor, name })} onImage={file => void setImage(file)} onSave={() => { if (!editor.name.trim()) { setToast('Give this gift a name.'); return } const exists = state.gifts.some(g => g.id === editor.id); if (commit({ ...state, gifts: exists ? state.gifts.map(g => g.id === editor.id ? { ...editor, name: editor.name.trim() } : g) : [...state.gifts, { ...editor, name: editor.name.trim() }] })) setEditor(null) }} onDelete={() => { if (window.confirm('Remove this gift and its planned round?') && commit({ ...state, gifts: state.gifts.filter(g => g.id !== editor.id) })) setEditor(null) }} />}
  </div>
}

function RevealStage({ round, gift, number, count, countdown, spinning, mode, rotation, onClose, onNext }: { round: Round; gift: Gift; number: number; count: number; countdown: number | null; spinning: boolean; mode: 'cylinder' | 'wheel'; rotation: number; onClose: () => void; onNext: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [fullscreenError, setFullscreenError] = useState('')
  const drawing = spinning || countdown !== null
  useEffect(() => { dialog.current?.showModal() }, [])
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await document.documentElement.requestFullscreen()
        // Reopen above the fullscreen element in the browser’s top layer.
        dialog.current?.close(); dialog.current?.showModal()
      }
      setFullscreenError('')
    } catch { setFullscreenError('Fullscreen is unavailable. The reveal still fills your browser window.') }
  }
  function finish(next: boolean) {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    if (next) onNext(); else onClose()
  }
  return <dialog ref={dialog} aria-labelledby="reveal-title" onCancel={e => { e.preventDefault(); if (!drawing) finish(false) }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto overscroll-contain border-0 bg-brand-dark bg-[radial-gradient(ellipse_at_top_right,#c8202f55,transparent_55%),radial-gradient(ellipse_at_bottom_left,#0da48780,transparent_60%)] p-5 text-white backdrop:bg-brand-dark sm:p-8 lg:p-10">
    {!drawing && <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <span key={i} className="absolute -top-6 h-5 w-2 animate-confetti motion-reduce:hidden" style={{ left: `${(i * 37) % 100}%`, backgroundColor: ['#ff5364', '#59e1c1', '#ffe29b', '#ffffff'][i % 4], animationDelay: `${(i % 12) * -.4}s`, animationDuration: `${4 + i % 3}s` }} />)}</div>}
    <div className="relative mx-auto flex min-h-full max-w-[1500px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4"><img src="/brand/fresh-masala-logo.png" alt="Fresh Masala" className="h-20 w-40 rounded-2xl bg-cream object-contain sm:h-24 sm:w-48" /><span className="rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold tracking-[.15em]">ROUND {String(number).padStart(2, '0')} / {String(count).padStart(2, '0')}</span><div className="flex gap-3"><button onClick={() => void fullscreen()} className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold">Fullscreen</button>{!drawing && <button onClick={() => finish(false)} aria-label="Close reveal" className="rounded-xl border border-white/40 bg-white/10 p-3"><Icon name="close" /></button>}</div></header>
      {fullscreenError && <p role="status" className="mt-3 text-sm">{fullscreenError}</p>}
      <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-16 lg:py-12">
        <section className="mx-auto w-full max-w-sm text-center lg:max-w-lg"><span className="inline-flex items-center gap-2 rounded-full bg-masala px-5 py-2 text-sm font-bold tracking-widest"><Icon name="gift" /> UP FOR GRABS</span><div className="mt-5 overflow-hidden rounded-3xl border-4 border-white/20 bg-cream shadow-2xl"><img src={gift.image} alt={gift.name} className="h-40 w-full object-contain sm:h-56 lg:h-[330px]" /></div><h2 className="mt-5 font-heading text-2xl sm:text-3xl lg:text-4xl">{gift.name}</h2><p className="mt-3 text-base text-white/80">A little spice. A whole lot of happiness.</p></section>
        <section className="min-w-0 text-center" aria-live="polite" aria-atomic="true">
          {drawing ? <div className="relative">
            <div className={countdown !== null ? 'invisible' : ''} aria-hidden={countdown !== null}>
              <span className="mb-4 inline-flex rounded-full bg-masala px-5 py-2 text-sm font-bold tracking-[.15em]">THE LUCK IS ROLLING</span><h1 id={countdown === null ? 'reveal-title' : undefined} className="mb-6 font-heading text-3xl sm:text-5xl">Hold your breath…</h1>
              {mode === 'cylinder' ? <Cylinder round={round} spinning={spinning} /> : <Wheel round={round} spinning={spinning} rotation={rotation} />}
              <div className="mx-auto mt-6 h-1.5 max-w-xl overflow-hidden rounded-full bg-white/20" aria-hidden="true">{spinning && <div className="h-full animate-draw-progress rounded-full bg-[#ff5364]" />}</div><p className="mt-5 text-lg text-white/85">One name. One unforgettable moment.</p>
            </div>
            {countdown !== null && <div className="absolute inset-0 flex flex-col items-center justify-center"><p id="reveal-title" className="text-xl font-bold tracking-[.2em] sm:text-2xl">LET’S MAKE SOMEONE’S DAY!</p><div key={countdown} className="animate-countdown font-sans text-[150px] leading-tight font-bold text-cream motion-reduce:animate-none sm:text-[220px]">{countdown}</div><p className="text-xl text-white/85">Are you ready, everyone?</p></div>}
          </div> : <div className="animate-reveal motion-reduce:animate-none"><span className="inline-flex items-center gap-2 rounded-full bg-masala px-6 py-3 text-base font-bold tracking-[.12em]"><Icon name="trophy" size={25} /> WE HAVE A WINNER!</span><p className="mt-7 font-heading text-2xl italic text-[#ffe29b] sm:text-3xl">Congratulations,</p><h1 id="reveal-title" className="mt-4 font-heading text-[clamp(2.75rem,6vw,6.5rem)] leading-[1.08] font-bold wrap-anywhere text-cream">{round.winner?.name}</h1><p className="mt-6 inline-block rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-lg font-semibold wrap-anywhere">Coupon {round.winner?.coupon}</p><p className="mt-6 text-xl text-white/90 sm:text-2xl">Your lucky moment is here! <span aria-hidden="true">🎉</span></p><div className="mt-8 flex flex-wrap justify-center gap-4"><button onClick={() => finish(true)} className="flex items-center justify-center gap-3 rounded-xl px-8 py-4 text-lg font-bold btn-celebrate">{number === count ? 'See all winners' : 'Next round'} <Icon name="arrow" /></button><button onClick={() => finish(false)} className="rounded-xl border border-white/40 bg-white/10 px-6 py-4 text-lg font-semibold">Back to studio</button></div></div>}
        </section>
      </div>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-white/20 pt-5 text-sm font-semibold tracking-wide text-white/80"><span>FRESH MASALA · A CELEBRATION OF YOU</span><span>Good taste. Great memories. <span className="text-[#ff5364]">♥</span></span></footer>
    </div>
  </dialog>
}

function PrivateSetup({ state, sizes, busy, spinning, locked, storageError, notice, onClose, onUpload, onTemplate, onClear, onReset, onBackup, onClearSaved }: { state: DrawState; sizes: number[]; busy: boolean; spinning: boolean; locked: boolean; storageError: string; notice: string; onClose: () => void; onUpload: (file: File | undefined, real: boolean) => void; onTemplate: () => void; onClear: () => void; onReset: () => void; onBackup: () => void; onClearSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} aria-labelledby="setup-title" onCancel={e => { e.preventDefault(); onClose() }} className="m-auto max-h-[90vh] w-[min(780px,94vw)] overflow-auto rounded-3xl border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><div><span className="text-xs font-bold tracking-widest text-brand">OPERATOR SETUP</span><h2 id="setup-title" className="mt-2 font-heading text-3xl">Display-only participant setup.</h2></div><button aria-label="Close setup" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-muted"><Icon name="close" size={25} /></button></div>
    <p className="mb-6 text-base leading-relaxed text-muted">Upload real participants on the Draw studio page. This panel is only for display-only entries. They appear in the selector but can never win. Every round includes a real entrant.</p>
    {storageError && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{storageError}</p><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={onBackup}>Download backup</button><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={() => location.reload()}>Reload</button><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={onClearSaved}>Clear saved data</button></div></div>}
    <label className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand/30 bg-soft/30 p-6 text-center focus-within:outline-2 focus-within:outline-brand ${locked || busy ? 'cursor-default opacity-60' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files[0], false) }}><span className="mb-3 text-brand"><Icon name="upload" size={30} /></span><strong className="text-lg">Display-only participants</strong><p className="mt-2 text-sm text-muted">{locked ? 'Locked for this draw' : 'Drop CSV here or browse files'}</p><span className="mt-3 text-sm font-semibold text-brand">{state.fake.length} loaded</span><input type="file" className="absolute size-px opacity-0" accept=".csv,text/csv" aria-label="Upload fake participants CSV" disabled={locked || busy || !!storageError} onChange={e => { onUpload(e.target.files?.[0], false); e.target.value = '' }} /></label>
    <p className="mt-4 text-sm leading-relaxed text-muted">CSV up to 3 MB. Matching coupon codes or phone numbers are rejected. All real rows are eligible, regardless of CSV status or week.</p>
    {sizes.length > 0 && <p className="mt-4 rounded-xl bg-paper p-4 text-sm">Round sizes: <strong>{sizes.join(' · ')}</strong></p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-brand/25 bg-soft p-4 text-base leading-relaxed text-brand">{notice}</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={onTemplate} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold"><Icon name="download" size={18} /> CSV template</button>{locked ? <button onClick={onReset} disabled={spinning || busy || !!storageError} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold"><Icon name="reset" size={18} /> Reset draw & edit setup</button> : state.fake.length > 0 && <button onClick={onClear} disabled={busy || !!storageError} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold">Clear display-only list</button>}<button disabled={busy} onClick={onClose} className="rounded-xl px-6 py-3 text-base font-semibold btn-primary">Done</button></div>
  </dialog>
}

function GiftEditor({ gift, notice, busy, existing, onClose, onName, onImage, onSave, onDelete }: { gift: Gift; notice: string; busy: boolean; existing: boolean; onClose: () => void; onName: (name: string) => void; onImage: (file: File | undefined) => void; onSave: () => void; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} aria-labelledby="gift-title" onCancel={e => { e.preventDefault(); if (!busy) onClose() }} className="m-auto max-h-[90vh] w-[min(500px,94vw)] overflow-auto rounded-3xl border border-line bg-white p-7 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm">
    <div className="mb-6 flex items-center justify-between"><h2 id="gift-title" className="font-heading text-3xl">{existing ? 'Edit your gift' : 'Something special.'}</h2><button aria-label="Close gift editor" disabled={busy} onClick={onClose} className="p-2 text-muted"><Icon name="close" size={24} /></button></div>
    <img className="mb-6 h-56 w-full rounded-2xl bg-cream object-contain" src={gift.image} alt="Gift preview" />
    <label className="mb-5 block text-base font-semibold">Gift name<input autoFocus maxLength={80} value={gift.name} placeholder="What will they win?" onChange={e => onName(e.target.value)} className="mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3.5 text-base font-normal" /></label>
    <label className="mb-5 block text-base font-semibold">Gift image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => onImage(e.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm font-normal" /><small className="mt-2 block text-sm font-normal text-muted">PNG, JPEG, or WebP · under 800 KB</small></label>
    {notice && <p role="status" className="mb-5 rounded-xl border border-brand/20 bg-soft p-4 text-base text-brand">{notice}</p>}
    <div className="mt-6 flex items-center justify-between gap-3">{existing && <button disabled={busy} onClick={onDelete} className="text-base text-red-700">Remove gift</button>}<button disabled={busy} onClick={onSave} className="ml-auto flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold btn-primary">{busy ? 'Reading image…' : 'Save gift'} <Icon name="check" /></button></div>
  </dialog>
}

export default App
