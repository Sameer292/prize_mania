import { useEffect, useRef, useState } from 'react'
import { assertUnique, headers, parseParticipants, prepareRounds, randomIndex, roundSizes, selectWinner, storageKey, validateState, winnersCsv } from './draw'
import type { DrawState, Gift } from './draw'

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
  { id: 'headphones', name: 'Wireless headphones', image: giftImage('headphones', '#eeeaf7') },
  { id: 'watch', name: 'Smart watch', image: giftImage('watch', '#e9eee6') },
  { id: 'speaker', name: 'Bluetooth speaker', image: giftImage('speaker', '#e9edf6') },
  { id: 'gift', name: 'Surprise gift box', image: giftImage('gift', '#f7eae8') },
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
  const [page, setPage] = useState('studio')
  const [toast, setToast] = useState('')
  const [editor, setEditor] = useState<Gift | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const [storageError, setStorageError] = useState(loadError.current)
  const total = state.real.length + state.fake.length
  const locked = state.rounds.length > 0
  const completed = state.rounds.filter(r => r.winner).length
  const activeIndex = spinning ? Math.max(0, completed - 1) : completed
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
      setToast(error instanceof Error ? error.message : 'Could not save. Your previous draw is unchanged.')
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
      if (commit({ ...state, real: real ? people : state.real, fake })) setToast(removed ? 'Real participants imported. The existing fake CSV overlapped and was removed; upload a non-overlapping fake CSV.' : `${people.length} ${real ? 'real' : 'display-only'} participants imported successfully.`)
    } catch (error) { setToast((error as Error).message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  function startDraw() {
    try {
      const rounds = prepareRounds(state.real, state.fake, state.gifts)
      if (commit({ ...state, rounds })) { setRotation(0); setPage('studio'); setToast('Rounds are ready. Participants are shuffled and assigned once.') }
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
      timer.current = setTimeout(() => { inFlight.current = false; setSpinning(false); setRotation(0) }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 6200)
    } catch (error) { setToast((error as Error).message) }
  }

  function reset() {
    if (spinning || busy) return
    if (!window.confirm('Reset all rounds and winners? Your participant lists and gifts will stay. Download results first if you need them.')) return
    if (commit({ ...state, rounds: [] })) { setRotation(0); setToast('Draw reset. You can edit your setup again.') }
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

  const colors = ['#b8a3ea', '#ede6fa', '#8a69c5', '#d9cef0', '#c9b5ed', '#f4effb', '#a18bd0', '#ded5ed']
  const wheelCount = round?.participants.length || 12
  const wheelBackground = `conic-gradient(${Array.from({ length: wheelCount }, (_, i) => `${colors[i % colors.length]} ${i * 360 / wheelCount}deg ${(i + 1) * 360 / wheelCount}deg`).join(',')})`
  const visiblePeople = [...state.real, ...state.fake].filter(p => `${p.name} ${p.coupon} ${p.phone}`.toLowerCase().includes(search.toLowerCase()))
  const ready = state.gifts.length > 0 && state.real.length >= state.gifts.length && total >= state.gifts.length * 2 && state.gifts.every(g => g.name.trim() && g.image)

  return <div className="min-h-screen md:flex">
    <aside className="border-b border-line bg-white px-5 pt-5 md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-b-0 md:px-5 md:pt-8 md:pb-5">
      <a className="flex items-center gap-2.5 font-heading text-[23px] font-extrabold tracking-tight" href="#" onClick={e => { e.preventDefault(); setPage('studio') }}><span className="grid size-10 place-items-center rounded-xl bg-plum text-white shadow-sm"><Icon name="sparkle" size={25} /></span><span>prize<span className="font-medium [&+small]:mt-1 [&+small]:block [&+small]:text-[6px] [&+small]:font-semibold [&+small]:tracking-[1.2px] [&+small]:text-muted">mania</span><small>A LITTLE LUCK. A LOT OF JOY.</small></span></a>
      <div className="mt-12 mb-4 ml-3 hidden text-[9px] font-bold tracking-[1.5px] text-muted md:block">YOUR WORKSPACE</div>
      <nav className="mt-5 flex justify-between gap-1 md:mt-0 md:grid md:gap-2" aria-label="Main navigation">
        {[['studio', 'grid', 'Draw studio'], ['participants', 'people', 'Participants'], ['gifts', 'gift', 'Gift collection'], ['winners', 'trophy', 'Winners']].map(([id, icon, label]) => <button key={id} className={page === id ? 'flex w-full flex-col items-center justify-center gap-1.5 rounded-t-lg border-0 bg-transparent px-2 py-3 text-[9px] font-medium text-muted md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3.5 md:text-xs [&_b]:ml-auto [&_b]:hidden [&_b]:rounded [&_b]:bg-lilac [&_b]:px-1.5 [&_b]:text-[10px] md:[&_b]:block !bg-soft !text-plum' : 'flex w-full flex-col items-center justify-center gap-1.5 rounded-t-lg border-0 bg-transparent px-2 py-3 text-[9px] font-medium text-muted md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3.5 md:text-xs [&_b]:ml-auto [&_b]:hidden [&_b]:rounded [&_b]:bg-lilac [&_b]:px-1.5 [&_b]:text-[10px] md:[&_b]:block'} onClick={() => setPage(id)}><Icon name={icon} /><span>{label}</span>{id === 'winners' && completed > 0 && <b>{completed}</b>}</button>)}
      </nav>
      <div className="mt-auto hidden rounded-xl border border-line bg-[#f9f7fc] p-4 md:block [&_strong]:text-[11px] [&_strong]:font-semibold [&_p]:mt-2 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><span className="mb-3 block text-plum"><Icon name="shield" /></span><strong>Your draw, your device.</strong><p>Everything stays in this browser. No uploads to a server, no account needed.</p><span className="mt-4 flex items-center gap-1.5 text-[9px] text-muted [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-sage"><i /> Client-side & private</span></div>
      <div className="mt-7 hidden items-center gap-2.5 md:flex [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-semibold [&_small]:mt-1 [&_small]:block [&_small]:text-[9px] [&_small]:text-muted"><span className="grid size-8 place-items-center rounded-full bg-soft text-[10px] font-bold text-plum">PM</span><div><strong>Lucky draw workspace</strong><small>Let’s make someone’s day</small></div></div>
    </aside>

    <main className="min-w-0 flex-1 md:ml-56">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-white/80 px-5 text-[10px] text-muted md:h-[72px] md:px-8 [&_strong]:font-medium [&_strong]:text-ink/70"><span>Workspace <span className="mx-3 text-muted/50">/</span> <strong>{page === 'studio' ? 'Draw studio' : page === 'gifts' ? 'Gift collection' : page === 'winners' ? 'Winners' : 'Participants'}</strong></span><span className="flex items-center gap-1.5 text-[9px] text-muted [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-sage"><i /> {storageError ? 'Storage needs attention' : 'Saved on this device'}</span></header>
      <div className="mx-auto max-w-[1320px] px-4 pt-7 pb-5 md:px-7 md:pt-9 lg:px-9">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4 [&_p]:mt-2 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-muted"><div><div className="mb-2.5 text-[8px] font-bold tracking-[1.8px] text-plum/65">GOOD THINGS ARE ABOUT TO HAPPEN</div><h1>{page === 'studio' ? 'A little spin. A big win.' : page === 'gifts' ? 'Gifts worth a little suspense.' : page === 'participants' ? 'Every name, a possibility.' : 'Meet the lucky ones.'}</h1><p>{page === 'studio' ? 'Bring your participants, pick your gifts, and let the good luck begin.' : page === 'gifts' ? 'One gift. One round. One very happy winner.' : page === 'participants' ? 'Manage your real entrants and display-only participants.' : 'A little luck turned into something special.'}</p></div><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65" onClick={() => download('participants-template.csv', headers.join(',') + '\r\n')}><Icon name="download" size={17} /> CSV template</button></div>
        {storageError && <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#e3c6bc] bg-[#fff4ec] p-4 [&_p]:basis-full [&_p]:text-xs" role="alert"><p>{storageError}</p><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65" onClick={() => { try { const data = localStorage.getItem(storageKey); if (data) download('prize-mania-backup.json', data, 'application/json') } catch { setToast('Storage is unavailable.') } }}>Download backup</button><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65" onClick={() => window.location.reload()}>Reload</button><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65" onClick={() => { if (window.confirm('Clear this browser’s saved draw, including participants, gifts, and winners?')) { try { localStorage.removeItem(storageKey); window.location.reload() } catch { setToast('Storage is unavailable.') } } }}>Clear saved data</button></div>}
        <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4" aria-label="Draw statistics">
          {[['people', total, 'Total participants', `${state.real.length} real · ${state.fake.length} display-only`], ['gift', state.gifts.length, 'Gifts to give', 'A little something special'], ['grid', state.gifts.length, 'Draw rounds', locked ? `${completed} completed · ${state.gifts.length - completed} to go` : 'One winner in every round'], ['trophy', completed, 'Lucky winners', completed ? 'Good luck looks good on them' : 'Your next winner is waiting']].map(([icon, number, title, subtitle]) => <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 xl:p-5 [&_strong]:block [&_strong]:font-heading [&_strong]:text-[27px] [&_strong]:font-bold [&_strong]:leading-none [&_div>span]:mt-2 [&_div>span]:block [&_div>span]:text-[10px] [&_div>span]:text-ink/70 [&_small]:mt-1 [&_small]:block [&_small]:text-[9px] [&_small]:leading-relaxed [&_small]:text-muted" key={title}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-soft text-plum"><Icon name={String(icon)} size={22} /></span><div><strong>{number}</strong><span>{title}</span><small>{subtitle}</small></div></div>)}
        </section>

        {(page === 'studio' || page === 'participants') && <section className="rounded-xl border border-line bg-white mb-6 p-5 lg:p-6"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><div><h2>Start with your participants</h2><p>Two lists, one unforgettable draw.</p></div><span className="hidden items-center gap-2 text-[11px] text-plum/65 sm:flex [&>span]:text-[8px] [&>span]:tracking-wider">01 <span>SET THE STAGE</span></span></div><div className="grid gap-4 xl:grid-cols-2">
          {[true, false].map(real => <label key={String(real)} className={`relative flex min-w-0 cursor-pointer items-center gap-4 rounded-lg border border-dashed border-lilac bg-soft/20 px-4 py-5 transition hover:bg-soft/50 focus-within:outline-2 focus-within:outline-plum [&_input]:absolute [&_input]:size-px [&_input]:opacity-0 [&_p]:mt-2 [&_p]:text-[10px] [&_p]:text-muted [&_small]:mt-1.5 [&_small]:block [&_small]:text-[9px] [&_small]:text-muted ${real ? '!border-sage/35 !bg-[#fcfdfc] [&_.upload-symbol]:!bg-[#edf4ef] [&_.upload-symbol]:!text-sage' : ''} ${locked || busy ? 'disabled' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0], real) }}>
            <span className="upload-symbol grid size-11 shrink-0 place-items-center rounded-xl bg-soft text-plum/70"><Icon name={real ? 'people' : 'upload'} size={23} /></span><div><div className="flex flex-wrap items-center gap-2 [&_strong]:text-[11px] [&_strong]:font-semibold"><strong>{real ? 'Real participants' : 'Display-only participants'}</strong><span className={real ? 'inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[8px] font-medium [&_i]:size-1 [&_i]:rounded-full [&_i]:bg-current bg-[#edf4ee] text-[#6c9279]' : 'inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[8px] font-medium [&_i]:size-1 [&_i]:rounded-full [&_i]:bg-current bg-soft text-plum/70'}>{real ? 'Eligible to win' : 'Never win'}</span></div><p>{locked ? 'Locked for this draw' : 'Drop your CSV here, or'} {!locked && <span className="font-semibold text-plum">browse files</span>}</p><small>{(real ? state.real : state.fake).length ? `${(real ? state.real : state.fake).length} participants loaded · upload to replace` : 'CSV file · up to 3 MB'}</small></div><input type="file" accept=".csv,text/csv" aria-label={`Upload ${real ? 'real' : 'fake'} participants CSV`} disabled={locked || busy || !!storageError} onChange={e => { void upload(e.target.files?.[0], real); e.target.value = '' }} /></label>)}
        </div><div className="mt-4 flex items-center justify-between gap-3 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-[9px] [&>span]:leading-relaxed [&>span]:text-muted"><span><Icon name="shield" size={15} /> Only real participants can win. Overlapping coupon codes or phone numbers are rejected.</span>{!locked && total > 0 && <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-1 text-[10px] text-plum/70" disabled={busy} onClick={() => { if (window.confirm('Remove both participant lists?')) commit({ ...state, real: [], fake: [] }) }}>Clear lists</button>}</div></section>}

        {(page === 'studio' || page === 'gifts') && <section className="rounded-xl border border-line bg-white mb-6 p-5 lg:p-6"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><div><h2>The gift lineup <span className="ml-1.5 inline-block rounded bg-soft px-1.5 py-0.5 font-sans text-[9px] font-medium text-plum/65">{state.gifts.length}</span></h2><p>Your gifts decide the rounds. Arrange them in the order you want to give them.</p></div><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65 px-3 py-2 text-[10px]" disabled={locked || busy || !!storageError} onClick={() => setEditor({ id: crypto.randomUUID(), name: '', image: giftImage('gift', '#eeeaf7') })}><Icon name="plus" size={16} /> Add gift</button></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">{state.gifts.map((gift, i) => <article className="overflow-hidden rounded-lg border border-line" key={gift.id}><div className="relative h-[145px] overflow-hidden bg-soft 2xl:h-[175px] [&_img]:size-full [&_img]:object-cover"><img src={gift.image} alt={gift.name} /><span className="absolute top-2.5 left-2.5 rounded border border-white/50 bg-white/80 px-2 py-1 text-[7px] font-semibold tracking-wider text-ink/55">ROUND {String(i + 1).padStart(2, '0')}</span>{!locked && <button className="absolute right-2 bottom-2 rounded border border-white/60 bg-white/85 px-2 py-1 text-[9px] text-plum" onClick={() => setEditor({ ...gift })}>Edit</button>}</div><div className="p-3 [&>strong]:block [&>strong]:text-[11px] [&>strong]:font-semibold [&>strong]:wrap-anywhere [&>div]:mt-1.5 [&>div]:flex [&>div]:flex-wrap [&>div]:items-center [&>div]:justify-between [&_span]:text-[9px] [&_span]:text-muted"><strong>{gift.name}</strong><div><span>1 gift · 1 winner</span>{!locked && <div className="flex gap-1 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1 [&_button]:text-xs [&_button]:text-plum/60"><button disabled={i === 0 || busy} aria-label={`Move ${gift.name} earlier`} onClick={() => { const gifts = [...state.gifts]; [gifts[i - 1], gifts[i]] = [gifts[i], gifts[i - 1]]; commit({ ...state, gifts }) }}>←</button><button disabled={i === state.gifts.length - 1 || busy} aria-label={`Move ${gift.name} later`} onClick={() => { const gifts = [...state.gifts]; [gifts[i + 1], gifts[i]] = [gifts[i], gifts[i + 1]]; commit({ ...state, gifts }) }}>→</button></div>}</div></div></article>)}{!state.gifts.length && <p className="p-8 text-center text-xs text-muted">Add your first gift to create a round.</p>}</div></section>}

        {page === 'studio' && <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)]"><div className="rounded-xl border border-line bg-white relative overflow-hidden p-5 lg:p-6 [&>.section-title]:mb-1.5"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><div><h2>Let luck take the wheel</h2><p>{allDone ? 'Every gift has found its lucky winner.' : locked ? `Round ${activeIndex + 1} · ${round?.participants.length ?? 0} participants · ${currentGift?.name ?? ''}` : 'The next good story starts with a spin.'}</p></div><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[8px] font-medium [&_i]:size-1 [&_i]:rounded-full [&_i]:bg-current ${locked ? 'bg-[#edf4ee] text-[#6c9279]' : 'bg-soft/60 text-muted'}`}><i /> {allDone ? 'Draw complete' : spinning ? 'Spinning' : locked ? 'Ready to spin' : 'Awaiting setup'}</span></div>
          <div className="relative flex h-[315px] items-center justify-center bg-[radial-gradient(ellipse_at_center,#faf7fd_0%,#fff_66%)]"><span className="absolute size-1.5 rounded-full bg-lilac top-[30%] left-[12%]" /><span className="absolute size-1.5 rounded-full bg-lilac right-[12%] bottom-[23%] !bg-[#e5d9c1]" /><span className="absolute hidden text-lilac sm:block top-[19%] right-[12%] text-xl">✦</span><span className="absolute hidden text-lilac sm:block bottom-[16%] left-[10%] text-2xl">✧</span><div className="relative size-[270px] rounded-full border-[7px] border-soft shadow-[0_0_0_1px_#e4daf0,0_10px_25px_#5d3a9010] sm:size-[285px]"><span className="absolute -top-2.5 left-[calc(50%-11px)] z-3 h-7 w-[22px] bg-plum [clip-path:polygon(0_0,100%_0,50%_100%)]" /><div className={`relative size-full overflow-hidden rounded-full border-4 border-white shadow-[inset_0_0_0_1px_#ffffff7f] ${spinning ? 'transition-transform duration-[6000ms] ease-[cubic-bezier(.12,.62,.11,1)] motion-reduce:transition-none' : ''}`} style={{ background: wheelBackground, transform: `rotate(${rotation}deg)` }} aria-label={round ? `Spinning wheel with ${wheelCount} participants` : 'Preview spinning wheel'}>{Array.from({ length: wheelCount }, (_, i) => (wheelCount <= 48 || i % Math.ceil(wheelCount / 32) === 0) && <span className="pointer-events-none absolute inset-0 block text-center [&>span]:mt-4 [&>span]:inline-block [&>span]:max-h-[70px] [&>span]:overflow-hidden [&>span]:text-[7px] [&>span]:font-semibold [&>span]:tracking-wide [&>span]:text-[#675181] [&>span]:[writing-mode:vertical-rl]" key={i} style={{ transform: `rotate(${(i + 0.5) * 360 / wheelCount}deg)` }}><span>{round ? round.participants[i].name.slice(0, 16) : ['YOUR', 'NEXT', 'LUCKY', 'WINNER'][i % 4]}</span></span>)}</div><div className="pointer-events-none absolute top-1/2 left-1/2 flex size-[81px] -translate-1/2 flex-col items-center justify-center gap-1 rounded-full border-[6px] border-soft bg-white text-plum/80 shadow-md [&_span]:text-[6px] [&_span]:font-bold [&_span]:tracking-wider"><Icon name="sparkle" size={32} /><span>GOOD LUCK</span></div></div></div>
          <div className="py-1 text-center [&_small]:mt-3 [&_small]:block [&_small]:text-[9px] [&_small]:leading-relaxed [&_small]:text-muted">{!locked ? <><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 bg-plum text-white shadow-sm min-w-[210px] px-6 py-3.5 text-xs" disabled={!ready || busy || !!storageError} onClick={startDraw}><Icon name="sparkle" /> Prepare the draw <Icon name="arrow" size={18} /></button><small>{ready ? `${total} participants. ${state.gifts.length} gifts. Let’s make it happen.` : `Add ${state.gifts.length || 'your'} gifts, at least ${state.gifts.length || 1} real entrants, and ${Math.max(2, state.gifts.length * 2)} total participants.`}</small></> : allDone ? <><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 bg-plum text-white shadow-sm min-w-[210px] px-6 py-3.5 text-xs" onClick={() => setPage('winners')}><Icon name="trophy" /> See your winners <Icon name="arrow" size={18} /></button><small>That’s a wrap. Congratulations to all the winners!</small></> : <><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 bg-plum text-white shadow-sm min-w-[210px] px-6 py-3.5 text-xs" disabled={spinning || !!storageError} onClick={spin}><Icon name="sparkle" /> {spinning ? 'A little suspense…' : `Spin round ${activeIndex + 1}`} {!spinning && <Icon name="arrow" size={18} />}</button><small>Winner chosen randomly from this round’s real entrants.</small></>}</div>
          {recentWinner && <div className="mt-5 flex items-center gap-3.5 rounded-xl border border-lilac bg-soft/70 p-4 [&_small]:text-[8px] [&_small]:tracking-wider [&_small]:text-plum/65 [&_strong]:my-1 [&_strong]:block [&_strong]:font-heading [&_strong]:text-lg [&_strong]:font-bold [&_strong]:wrap-anywhere [&_p]:text-[10px] [&_p]:text-muted" role="status"><span className="text-plum/60"><Icon name="trophy" size={26} /></span><div><small>ROUND {completed} WINNER</small><strong>{recentWinner.name}</strong><p>{state.gifts[completed - 1].name} · Coupon {recentWinner.coupon}</p></div><span className="ml-auto text-[28px] text-lilac">✦</span></div>}
        </div><div className="flex flex-col gap-4"><section className="rounded-xl border border-line bg-white px-5 pt-6"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><h2>Your rounds</h2><span className="ml-1.5 inline-block rounded bg-soft px-1.5 py-0.5 font-sans text-[9px] font-medium text-plum/65">{state.gifts.length}</span></div><div className="grid">{state.gifts.map((gift, i) => <div key={gift.id} className={`flex min-w-0 items-center gap-3 border-b border-line/70 py-4 last:border-0 [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-medium [&_strong]:wrap-anywhere [&_small]:mt-1 [&_small]:block [&_small]:text-[9px] [&_small]:text-muted ${locked && activeIndex === i ? '[&_.round-number]:!border-lilac [&_.round-number]:!bg-soft [&_.round-number]:!text-plum [&_.round-status]:!text-plum/70' : ''}`}><span className={`round-number grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-soft/60 text-[10px] text-plum/60 ${state.rounds[i]?.winner ? '!bg-[#edf5ef] !text-sage' : ''}`}>{state.rounds[i]?.winner ? <Icon name="check" size={17} /> : String(i + 1).padStart(2, '0')}</span><div><strong>{gift.name}</strong><small>{state.rounds[i]?.winner && !(spinning && i === activeIndex) ? state.rounds[i].winner?.name : `${locked ? state.rounds[i].participants.length : sizes[i] ?? '—'} participants`}</small></div><span className="round-status text-[8px] text-muted">{state.rounds[i]?.winner && !(spinning && i === activeIndex) ? 'Won' : locked && activeIndex === i ? 'Up next' : 'Waiting'}</span></div>)}</div><div className="-mx-5 mt-2 flex items-center gap-1.5 rounded-b-xl border-t border-line bg-soft/15 px-5 py-3.5 text-[9px] text-muted"><Icon name="people" size={16} /> Random groups. No repeat participants.</div></section><section className="relative rounded-xl border border-lilac/50 bg-soft p-5 [&_h3]:font-heading [&_h3]:text-[13px] [&_h3]:font-bold [&_p]:mt-2 [&_p]:mb-3 [&_p]:max-w-[225px] [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted [&>div]:mt-2 [&>div]:flex [&>div]:items-center [&>div]:gap-1.5 [&>div]:text-[9px] [&>div]:text-ink/55 [&_svg]:text-plum/50"><span className="absolute top-4 right-5 text-[26px] text-lilac">✦</span><h3>A fair bit of magic.</h3><p>One gift per round. One real winner. Everyone appears in just one group.</p><div><Icon name="check" size={15} /> Randomly shuffled participants</div><div><Icon name="check" size={15} /> Real entrants only can win</div><div><Icon name="check" size={15} /> Progress saved in your browser</div></section>{locked && <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-1 text-[10px] text-plum/70 justify-center" disabled={spinning || busy} onClick={reset}><Icon name="reset" size={16} /> Reset draw & edit setup</button>}</div></section>}

        {page === 'participants' && <section className="rounded-xl border border-line bg-white mb-6 p-5 lg:p-6 [&>.section-title]:flex-wrap"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><div><h2>Participant list <span className="ml-1.5 inline-block rounded bg-soft px-1.5 py-0.5 font-sans text-[9px] font-medium text-plum/65">{total}</span></h2><p>All uploaded real participants are eligible, regardless of the CSV status.</p></div><input className="w-full rounded-lg border border-line bg-soft/20 px-3 py-2.5 text-[11px] sm:w-[260px]" aria-label="Search participants" placeholder="Search names, coupons, phones…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="overflow-auto"><table><thead><tr><th>Participant</th><th>Coupon code</th><th>Phone number</th><th>Week</th><th>Status</th><th>Activated at</th><th>Eligibility</th></tr></thead><tbody>{visiblePeople.slice(0, 200).map(p => <tr key={p.coupon}><td><strong>{p.name}</strong></td><td>{p.coupon}</td><td>{p.phone}</td><td>{p.week || '—'}</td><td>{p.status || '—'}</td><td>{p.activated || '—'}</td><td><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[8px] font-medium [&_i]:size-1 [&_i]:rounded-full [&_i]:bg-current ${p.real ? 'bg-[#edf4ee] text-[#6c9279]' : 'bg-soft text-plum/70'}`}>{p.real ? 'Real entrant' : 'Display-only'}</span></td></tr>)}</tbody></table>{!visiblePeople.length && <p className="p-8 text-center text-xs text-muted">{total ? 'No matching participants.' : 'Upload your participant CSVs to see them here.'}</p>}</div>{visiblePeople.length > 200 && <p className="mt-4 text-[10px] text-muted">Showing the first 200 of {visiblePeople.length} matches. Search to find a participant; all entries are included in the draw.</p>}</section>}

        {page === 'winners' && <section className="rounded-xl border border-line bg-white mb-6 p-5 lg:p-6 [&>.section-title]:flex-wrap"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><div><h2>The winner’s circle <span className="ml-1.5 inline-block rounded bg-soft px-1.5 py-0.5 font-sans text-[9px] font-medium text-plum/65">{completed}</span></h2><p>One memorable moment for each gift.</p></div><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 bg-plum text-white shadow-sm px-3 py-2 text-[10px]" disabled={!completed || spinning} onClick={() => download('prize-mania-winners.csv', winnersCsv(state))}><Icon name="download" size={16} /> Export winners</button></div>{completed && !spinning ? <div className="grid gap-4">{state.rounds.flatMap((r, i) => r.winner ? [<article className="flex items-center gap-4 rounded-xl border border-line bg-soft/20 p-4 [&_img]:h-[90px] [&_img]:w-[90px] [&_img]:rounded-lg [&_img]:object-cover [&_h3]:my-2 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:font-bold [&_strong]:text-[11px] [&_strong]:font-medium [&_strong]:text-plum/70 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:text-muted [&>svg]:ml-auto [&>svg]:shrink-0 [&>svg]:text-plum/50" key={r.giftId}><img src={state.gifts[i].image} alt={state.gifts[i].name} /><div><span className="inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[8px] font-medium [&_i]:size-1 [&_i]:rounded-full [&_i]:bg-current bg-soft text-plum/70">ROUND {i + 1}</span><h3>{r.winner.name}</h3><strong>{state.gifts[i].name}</strong><p>Coupon: {r.winner.coupon}</p><p>Phone: {r.winner.phone}</p></div><Icon name="trophy" size={26} /></article>] : [])}</div> : <div className="px-5 py-16 text-center text-plum/45 [&_h3]:mt-5 [&_h3]:mb-2.5 [&_h3]:font-heading [&_h3]:font-bold [&_h3]:text-ink/75 [&_p]:mb-6 [&_p]:text-xs [&_p]:text-muted [&>svg]:mx-auto"><Icon name="trophy" size={42} /><h3>{spinning ? 'The wheel is still spinning…' : 'Good luck is on its way.'}</h3><p>Your winners will appear here after each spin.</p><button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 border-line bg-white text-ink/65" onClick={() => setPage('studio')}>Back to draw studio <Icon name="arrow" size={16} /></button></div>}</section>}
        <footer className="mt-7 flex flex-col items-center justify-between gap-3 text-[9px] text-muted/80 sm:flex-row [&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:gap-1.5"><span>Made for moments worth celebrating.</span><span><Icon name="shield" size={14} /> Private by design. Powered by a little luck.</span></footer>
      </div>
    </main>

    {toast && <div className="fixed bottom-6 left-1/2 z-20 flex w-[90vw] max-w-[650px] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#695279] bg-[#3e314e] px-4 py-3.5 text-xs leading-relaxed text-white shadow-xl [&>svg]:shrink-0 [&>svg]:text-lilac [&_button]:flex [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-1 [&_button]:text-lilac" role="status"><Icon name="sparkle" size={20} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={17} /></button></div>}
    {editor && <div className="fixed inset-0 z-10 bg-[#33243d4d] backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget && !busy) setEditor(null) }}><GiftEditor gift={editor} busy={busy} onClose={() => setEditor(null)} onName={name => setEditor({ ...editor, name })} onImage={file => void setImage(file)} onSave={() => { if (!editor.name.trim()) { setToast('Give this gift a name.'); return } const exists = state.gifts.some(g => g.id === editor.id); if (commit({ ...state, gifts: exists ? state.gifts.map(g => g.id === editor.id ? { ...editor, name: editor.name.trim() } : g) : [...state.gifts, { ...editor, name: editor.name.trim() }] })) setEditor(null) }} onDelete={() => { if (window.confirm('Remove this gift and its planned round?') && commit({ ...state, gifts: state.gifts.filter(g => g.id !== editor.id) })) setEditor(null) }} existing={state.gifts.some(g => g.id === editor.id)} /></div>}
  </div>
}

function GiftEditor({ gift, busy, existing, onClose, onName, onImage, onSave, onDelete }: { gift: Gift; busy: boolean; existing: boolean; onClose: () => void; onName: (name: string) => void; onImage: (file: File | undefined) => void; onSave: () => void; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="m-auto max-h-[90vh] w-[min(430px,90vw)] overflow-auto rounded-2xl border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-[#33243d4d] backdrop:backdrop-blur-sm" ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else onClose() }} aria-labelledby="gift-editor-title"><div className="section-title mb-5 flex items-center justify-between gap-3 [&_p]:mt-1.5 [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted"><h2 id="gift-editor-title">{existing ? 'Edit your gift' : 'Something to look forward to'}</h2><button className="grid place-items-center border-0 bg-transparent p-1 text-muted" aria-label="Close gift editor" disabled={busy} onClick={onClose}><Icon name="close" /></button></div><img className="mb-5 h-[180px] w-full rounded-lg bg-soft/50 object-contain" src={gift.image} alt="Gift preview" /><label className="mb-4 block text-[11px] font-semibold text-ink/70 [&_input]:mt-2 [&_input]:block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-lilac [&_input]:bg-soft/20 [&_input]:p-3 [&_input]:text-xs [&_small]:mt-2 [&_small]:block [&_small]:text-[9px] [&_small]:font-normal [&_small]:text-muted">Gift name<input autoFocus maxLength={80} value={gift.name} placeholder="What will they win?" onChange={e => onName(e.target.value)} /></label><label className="mb-4 block text-[11px] font-semibold text-ink/70 [&_input]:mt-2 [&_input]:block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-lilac [&_input]:bg-soft/20 [&_input]:p-3 [&_input]:text-xs [&_small]:mt-2 [&_small]:block [&_small]:text-[9px] [&_small]:font-normal [&_small]:text-muted">Gift image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => onImage(e.target.files?.[0])} /><small>PNG, JPEG, or WebP · under 800 KB</small></label><div className="mt-6 flex items-center justify-between [&_button:last-child]:ml-auto">{existing && <button className="inline-flex items-center gap-1.5 border-0 bg-transparent p-1 text-[10px] text-plum/70 !text-[#b27e88]" disabled={busy} onClick={onDelete}>Remove gift</button>}<button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-[11px] font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 bg-plum text-white shadow-sm" disabled={busy} onClick={onSave}>{busy ? 'Reading image…' : 'Save gift'} <Icon name="check" size={17} /></button></div></dialog>
}

export default App
