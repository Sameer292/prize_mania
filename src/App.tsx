import { useEffect, useRef, useState } from 'react'
import { assertUnique, headers, parseParticipants, prepareRounds, randomIndex, roundSizes, selectWinner, storageKey, validateState, winnersCsv } from './draw'
import type { DrawState, Gift } from './draw'
import { Cylinder, Wheel } from './Selector'

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
  const [showWinner, setShowWinner] = useState(state.rounds.some(r => r.winner))
  const [rotation, setRotation] = useState(() => {
    const previous = state.rounds.filter(r => r.winner).at(-1)
    return previous ? (360 - (previous.participants.findIndex(p => p.coupon === previous.winner?.coupon) + 0.5) * 360 / previous.participants.length) % 360 : 0
  })
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const [storageError, setStorageError] = useState(loadError.current)
  const total = state.real.length + state.fake.length
  const locked = state.rounds.length > 0
  const completed = state.rounds.filter(r => r.winner).length
  const activeIndex = spinning || showWinner ? Math.max(0, completed - 1) : completed
  const round = state.rounds[activeIndex]
  const currentGift = state.gifts[activeIndex]
  const allDone = locked && completed === state.rounds.length && !spinning
  const recentWinner = !spinning ? state.rounds[completed - 1]?.winner : undefined
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
      if (commit({ ...state, real: real ? people : state.real, fake })) setPrivateNotice(removed ? 'Real participants imported. The existing fake CSV overlapped and was removed; upload a non-overlapping fake CSV.' : `${people.length} ${real ? 'real' : 'display-only'} participants imported successfully.`)
    } catch (error) { setPrivateNotice((error as Error).message) }
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
      inFlight.current = true; setSpinning(true); setRotation(nextRotation)
      timer.current = setTimeout(() => { inFlight.current = false; setShowWinner(true); setSpinning(false) }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 6200)
    } catch (error) { setToast((error as Error).message) }
  }

  function reset() {
    if (spinning || busy) return
    if (!window.confirm('Reset all rounds and winners? Your participant lists and gifts will stay. Download results first if you need them.')) return
    if (commit({ ...state, rounds: [] })) { setShowWinner(false); setRotation(0); setToast('Draw reset. You can edit your setup again.') }
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
    <header className="border-b border-line bg-white">
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
            <h1 className="font-heading text-[40px] leading-[1.12] tracking-tight sm:text-[48px] xl:text-[58px]">A little spice.<br /><span className="italic text-brand">A lot of luck.</span></h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">A thank-you to the people who make our story special. Let’s make someone’s day.</p>
          </div>
          <div className="relative hidden min-h-[290px] sm:block"><img src="/brand/fresh-masala-banner.jpg" alt="Fresh Masala spice and tea products" className="absolute inset-0 size-full object-cover" /><span className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cream to-transparent" /></div>
        </section>

        <section className="mb-8 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white px-2 py-5 sm:px-6 sm:py-6" aria-label="Draw statistics">
          {[['people', total, 'Participants'], ['gift', state.gifts.length, 'Gifts & rounds'], ['trophy', completed, 'Lucky winners']].map(([icon, number, label]) => <div className="flex items-center justify-center gap-3 px-2 sm:gap-5" key={label}><span className="hidden size-12 items-center justify-center rounded-xl bg-soft text-brand sm:flex"><Icon name={String(icon)} size={25} /></span><div><strong className="block text-center font-sans text-3xl font-semibold tracking-tight sm:text-left sm:text-4xl">{number}</strong><span className="mt-1 block text-center text-xs text-muted sm:text-left sm:text-base">{label}</span></div></div>)}
        </section>

        {storageError && <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-base text-amber-900">The saved draw needs attention. Please reload this page before continuing.</div>}

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-[24px] border border-line bg-white p-6 sm:p-8" aria-label="Gift lineup">
            <div className="mb-6 flex items-start justify-between gap-3"><div><span className="text-xs font-bold tracking-[.18em] text-brand">THE GIFT LINEUP</span><h2 className="mt-2 font-heading text-[30px]">Something to smile about.</h2></div>{!locked && <button className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-brand hover:bg-soft" aria-label="Add gift" disabled={busy || !!storageError} onClick={() => openEditor({ id: crypto.randomUUID(), name: '', image: giftImage('gift', '#edf5ee') })}><Icon name="plus" size={22} /></button>}</div>

            {previewGift ? <article className="mb-6 overflow-hidden rounded-2xl border border-line">
              <div className="relative flex h-[270px] items-center justify-center bg-cream sm:h-[300px]">
                <img src={previewGift.image} alt={previewGift.name} className="size-full object-contain" />
                <span className="absolute top-4 left-4 rounded-full border border-line bg-white/95 px-4 py-2 text-xs font-semibold tracking-wide text-brand">ROUND {String(previewIndex + 1).padStart(2, '0')}</span>
                {!locked && <button className="absolute right-4 bottom-4 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-brand" disabled={busy} onClick={() => openEditor(previewGift)}>Edit gift</button>}
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-5"><div><h3 className="text-xl font-semibold">{previewGift.name}</h3><p className="mt-1 text-sm text-muted">One gift. One happy winner.</p></div><span className="text-3xl text-brand">✦</span></div>
            </article> : <p className="rounded-xl bg-paper p-8 text-center text-muted">Add a gift to begin.</p>}

            <div className="grid gap-3">{state.gifts.map((gift, i) => <div key={gift.id} className={`flex items-center gap-3 rounded-xl border p-3 ${previewGift?.id === gift.id ? 'border-brand/35 bg-soft/50' : 'border-line'}`}>
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={locked} onClick={() => setPreviewGiftId(gift.id)} aria-label={`Preview ${gift.name}`}><img src={gift.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" /><span className="min-w-0"><small className="block text-[11px] font-semibold tracking-widest text-muted">ROUND {String(i + 1).padStart(2, '0')}</small><strong className="mt-1 block text-sm font-semibold wrap-anywhere sm:text-base">{gift.name}</strong>{state.rounds[i]?.winner && !(spinning && i === activeIndex) && <span className="mt-1 flex items-center gap-1 text-xs text-brand"><Icon name="check" size={14} /> {state.rounds[i].winner?.name}</span>}</span></button>
              {!locked && <div className="flex shrink-0 flex-col"><button className="px-2 py-1 text-brand" disabled={i === 0 || busy} aria-label={`Move ${gift.name} earlier`} onClick={() => moveGift(i, -1)}>↑</button><button className="px-2 py-1 text-brand" disabled={i === state.gifts.length - 1 || busy} aria-label={`Move ${gift.name} later`} onClick={() => moveGift(i, 1)}>↓</button></div>}{state.rounds[i]?.winner && !(spinning && i === activeIndex) && <Icon name="check" />}
            </div>)}</div>
            {!locked && <p className="mt-5 text-sm leading-relaxed text-muted">Arrange the gifts in the order you’d like to give them.</p>}
          </section>

          <section className="rounded-[24px] border border-line bg-white p-6 sm:p-8" aria-label="Winner selector">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><span className="text-xs font-bold tracking-[.18em] text-brand">{allDone ? 'EVERY GIFT HAS A WINNER' : locked ? `ROUND ${String(activeIndex + 1).padStart(2, '0')} OF ${String(state.gifts.length).padStart(2, '0')}` : 'LET THE GOOD LUCK BEGIN'}</span><h2 className="mt-2 font-heading text-[32px] sm:text-[38px]">{allDone ? 'What a lovely celebration.' : showWinner ? 'We have a winner!' : spinning ? 'A moment of suspense…' : 'Who’s the lucky one?'}</h2></div><div className="flex gap-1 rounded-xl bg-paper p-1" role="group" aria-label="Selector style">{(['cylinder', 'wheel'] as const).map(value => <button key={value} disabled={spinning} aria-pressed={mode === value} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === value ? 'bg-white text-brand shadow-sm' : 'text-muted'}`} onClick={() => setMode(value)}>{value === 'cylinder' ? 'Cylinder' : 'Wheel'}</button>)}</div></div>
            <p className="mb-7 text-base text-muted">{locked && currentGift ? currentGift.name : 'A little anticipation. A moment to remember.'}</p>
            <div className="flex min-h-[390px] items-center justify-center">{mode === 'cylinder' ? <Cylinder key={round?.giftId || 'preview'} round={round} spinning={spinning} /> : <Wheel round={round} spinning={spinning} rotation={rotation} />}</div>
            <div className="mt-7 text-center">
              {!locked ? <button className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-[0_8px_25px_-10px_#087d6860] hover:bg-brand-dark disabled:opacity-50" disabled={!ready || busy || !!storageError} onClick={startDraw}><Icon name="sparkle" size={24} /> Prepare the draw <Icon name="arrow" size={22} /></button> : allDone ? <a href="#winners" className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white"><Icon name="trophy" size={24} /> See your winners <Icon name="arrow" size={22} /></a> : <button className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-[0_8px_25px_-10px_#087d6860] hover:bg-brand-dark disabled:opacity-50" disabled={spinning || !!storageError} onClick={() => { if (showWinner) { setShowWinner(false); setRotation(0) } else spin() }}><Icon name="sparkle" size={24} /> {spinning ? 'Good luck, everyone…' : showWinner ? 'Next round' : `Spin round ${activeIndex + 1}`} {!spinning && <Icon name="arrow" size={22} />}</button>}
              <p className="mt-4 text-sm text-muted">{allDone ? 'Thank you for being part of our story.' : !ready && !locked ? 'Your next celebration is being prepared.' : spinning ? 'The suspense is part of the fun.' : showWinner ? 'A special gift has found its person.' : locked ? `${round?.participants.length ?? 0} names. One special moment.` : `${state.gifts.length} gifts. ${state.gifts.length} moments to remember.`}</p>
            </div>
            {recentWinner && <div className="mt-8 flex items-center gap-4 rounded-2xl border border-brand/25 bg-soft p-5 sm:p-6" role="status"><span className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-brand"><Icon name="trophy" size={30} /></span><div className="min-w-0"><span className="text-xs font-bold tracking-widest text-brand">ROUND {completed} WINNER</span><h3 className="mt-2 font-heading text-[30px] leading-tight wrap-anywhere">{recentWinner.name}</h3><p className="mt-2 text-base text-muted">{state.gifts[completed - 1].name}</p><p className="mt-1 text-sm text-muted">Coupon {recentWinner.coupon}</p></div><span className="ml-auto hidden text-4xl text-accent sm:block">✦</span></div>}
          </section>
        </div>
      </> : <section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><span className="text-xs font-bold tracking-[.2em] text-brand">THE WINNER’S CIRCLE</span><h1 className="mt-3 font-heading text-4xl sm:text-5xl">Good luck looks good on them.</h1><p className="mt-4 text-lg text-muted">A little celebration for every lucky winner.</p></div><button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white" disabled={!completed || spinning} onClick={() => download('fresh-masala-winners.csv', winnersCsv(state))}><Icon name="download" /> Export winners</button></div>
        {completed && !spinning ? <div className="grid gap-5 md:grid-cols-2">{state.rounds.flatMap((r, i) => r.winner ? [<article className="flex items-center gap-5 rounded-2xl border border-line bg-white p-5 sm:p-7" key={r.giftId}><img src={state.gifts[i].image} alt={state.gifts[i].name} className="size-24 shrink-0 rounded-xl object-cover sm:size-32" /><div className="min-w-0"><span className="text-xs font-bold tracking-wider text-brand">ROUND {String(i + 1).padStart(2, '0')}</span><h2 className="mt-2 font-heading text-2xl wrap-anywhere sm:text-3xl">{r.winner.name}</h2><p className="mt-2 text-base font-semibold">{state.gifts[i].name}</p><p className="mt-3 text-sm text-muted">Coupon: {r.winner.coupon}</p><p className="mt-1 text-sm text-muted">Phone: {r.winner.phone}</p></div></article>] : [])}</div> : <div className="rounded-[24px] border border-line bg-white px-5 py-20 text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-soft text-brand"><Icon name="trophy" size={40} /></span><h2 className="mt-6 font-heading text-3xl">{spinning ? 'A moment of suspense…' : 'Good luck is on its way.'}</h2><p className="mt-4 text-lg text-muted">Your winners will appear here after each round.</p><a href="#studio" className="mt-7 inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-base font-semibold text-brand">Back to draw studio <Icon name="arrow" /></a></div>}
      </section>}
      <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted sm:flex-row"><span>Fresh Masala · Made for moments worth celebrating.</span><span>Good taste. Great memories.</span></footer>
    </main>

    {toast && !editor && !privateOpen && <div role="status" className="fixed bottom-6 left-1/2 z-30 flex w-[90vw] max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-5 py-4 text-base text-white shadow-xl"><Icon name="sparkle" /><span className="flex-1">{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" /></button></div>}
    {privateOpen && <PrivateSetup state={state} sizes={sizes} busy={busy} spinning={spinning} locked={locked} storageError={storageError} notice={privateNotice || toast} onClose={closePrivate} onUpload={(file, real) => void upload(file, real)} onTemplate={() => download('participants-template.csv', headers.join(',') + '\r\n')} onClear={() => { if (window.confirm('Remove both participant lists?')) commit({ ...state, real: [], fake: [] }) }} onReset={reset} onBackup={() => { try { const data = localStorage.getItem(storageKey); if (data) download('prize-mania-backup.json', data, 'application/json') } catch { setPrivateNotice('Storage is unavailable.') } }} onClearSaved={() => { if (window.confirm('Clear this browser’s entire saved draw?')) { try { localStorage.removeItem(storageKey); location.reload() } catch { setPrivateNotice('Storage is unavailable.') } } }} />}
    {editor && <GiftEditor gift={editor} notice={toast} busy={busy} existing={state.gifts.some(g => g.id === editor.id)} onClose={() => setEditor(null)} onName={name => setEditor({ ...editor, name })} onImage={file => void setImage(file)} onSave={() => { if (!editor.name.trim()) { setToast('Give this gift a name.'); return } const exists = state.gifts.some(g => g.id === editor.id); if (commit({ ...state, gifts: exists ? state.gifts.map(g => g.id === editor.id ? { ...editor, name: editor.name.trim() } : g) : [...state.gifts, { ...editor, name: editor.name.trim() }] })) setEditor(null) }} onDelete={() => { if (window.confirm('Remove this gift and its planned round?') && commit({ ...state, gifts: state.gifts.filter(g => g.id !== editor.id) })) setEditor(null) }} />}
  </div>
}

function PrivateSetup({ state, sizes, busy, spinning, locked, storageError, notice, onClose, onUpload, onTemplate, onClear, onReset, onBackup, onClearSaved }: { state: DrawState; sizes: number[]; busy: boolean; spinning: boolean; locked: boolean; storageError: string; notice: string; onClose: () => void; onUpload: (file: File | undefined, real: boolean) => void; onTemplate: () => void; onClear: () => void; onReset: () => void; onBackup: () => void; onClearSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} aria-labelledby="setup-title" onCancel={e => { e.preventDefault(); onClose() }} className="m-auto max-h-[90vh] w-[min(780px,94vw)] overflow-auto rounded-3xl border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><div><span className="text-xs font-bold tracking-widest text-brand">OPERATOR SETUP</span><h2 id="setup-title" className="mt-2 font-heading text-3xl">Prepare your participant lists.</h2></div><button aria-label="Close setup" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-muted"><Icon name="close" size={25} /></button></div>
    <p className="mb-6 text-base leading-relaxed text-muted">Only real entrants can win. Each round contains at least one real entrant; display-only entries never win. Every person is assigned once.</p>
    {storageError && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{storageError}</p><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={onBackup}>Download backup</button><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={() => location.reload()}>Reload</button><button className="rounded-lg border border-line bg-white px-4 py-2" onClick={onClearSaved}>Clear saved data</button></div></div>}
    <div className="grid gap-4 sm:grid-cols-2">{[true, false].map(real => <label key={String(real)} className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand/30 bg-soft/30 p-6 text-center focus-within:outline-2 focus-within:outline-brand ${locked || busy ? 'cursor-default opacity-60' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files[0], real) }}><span className="mb-3 text-brand"><Icon name={real ? 'people' : 'upload'} size={30} /></span><strong className="text-lg">{real ? 'Real participants' : 'Display-only participants'}</strong><p className="mt-2 text-sm text-muted">{locked ? 'Locked for this draw' : 'Drop CSV here or browse files'}</p><span className="mt-3 text-sm font-semibold text-brand">{(real ? state.real : state.fake).length} loaded</span><input type="file" className="absolute size-px opacity-0" accept=".csv,text/csv" aria-label={`Upload ${real ? 'real' : 'fake'} participants CSV`} disabled={locked || busy || !!storageError} onChange={e => { onUpload(e.target.files?.[0], real); e.target.value = '' }} /></label>)}</div>
    <p className="mt-4 text-sm leading-relaxed text-muted">CSV up to 3 MB. Matching coupon codes or phone numbers are rejected. All real rows are eligible, regardless of CSV status or week.</p>
    {sizes.length > 0 && <p className="mt-4 rounded-xl bg-paper p-4 text-sm">Round sizes: <strong>{sizes.join(' · ')}</strong></p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-brand/25 bg-soft p-4 text-base leading-relaxed text-brand">{notice}</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={onTemplate} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold"><Icon name="download" size={18} /> CSV template</button>{locked ? <button onClick={onReset} disabled={spinning || busy || !!storageError} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold"><Icon name="reset" size={18} /> Reset draw & edit setup</button> : state.real.length + state.fake.length > 0 && <button onClick={onClear} disabled={busy || !!storageError} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold">Clear lists</button>}<button disabled={busy} onClick={onClose} className="rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white">Done</button></div>
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
    <div className="mt-6 flex items-center justify-between gap-3">{existing && <button disabled={busy} onClick={onDelete} className="text-base text-red-700">Remove gift</button>}<button disabled={busy} onClick={onSave} className="ml-auto flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-white">{busy ? 'Reading image…' : 'Save gift'} <Icon name="check" /></button></div>
  </dialog>
}

export default App
