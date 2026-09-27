import { useEffect, useState } from 'react'
import type { Round } from './draw'

const rowHeight = 72
const previewNames = ['Your next lucky winner', 'A little anticipation', 'A moment to remember', 'Good luck, everyone', 'Something special awaits']

export function Cylinder({ round, spinning }: { round?: Round; spinning: boolean }) {
  const [position, setPosition] = useState(0)
  const count = round?.participants.length || previewNames.length

  useEffect(() => {
    const winnerIndex = round?.participants.findIndex(p => p.coupon === round.winner?.coupon) ?? -1
    if (!spinning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPosition(Math.max(0, winnerIndex))
      return
    }
    const target = count * 6 + Math.max(0, winnerIndex)
    const started = performance.now()
    let frame: number
    function animate(now: number) {
      const progress = Math.min(1, (now - started) / 6000)
      setPosition(target * (1 - (1 - progress) ** 5))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [spinning, round, count])

  const first = Math.floor(position) - 3
  return <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-brand/15 bg-white shadow-[0_20px_65px_-40px_#562d1b50]" aria-label="Rolling name selector">
    <div className="pointer-events-none absolute top-[144px] right-3 left-3 z-10 h-[72px] rounded-2xl border border-brand/25 bg-brand/5 shadow-[0_1px_0_#fff_inset]" />
    <span className="pointer-events-none absolute top-[164px] left-5 z-20 text-2xl text-brand" aria-hidden="true">▸</span>
    <span className="pointer-events-none absolute top-[164px] right-5 z-20 text-2xl text-brand" aria-hidden="true">◂</span>
    <div className="relative h-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]" aria-hidden="true">
      <div style={{ transform: `translateY(${-rowHeight - (position % 1) * rowHeight}px)` }}>
        {Array.from({ length: 7 }, (_, i) => {
          const index = first + i
          const nameIndex = ((index % count) + count) % count
          const name = round ? round.participants[nameIndex].name : previewNames[nameIndex]
          return <div key={i} className={`flex h-[72px] items-center justify-center px-12 text-center font-heading tracking-tight ${index === Math.round(position) ? 'text-[25px] font-bold text-brand sm:text-[30px]' : 'text-xl font-medium text-muted sm:text-2xl'}`}><span className="block max-w-full truncate" title={name}>{name}</span></div>
        })}
      </div>
    </div>
  </div>
}

export function Wheel({ round, spinning, rotation }: { round?: Round; spinning: boolean; rotation: number }) {
  const colors = ['#087d68', '#f3dfb8', '#58a391', '#fff0d9', '#236957', '#d6e8da', '#136957', '#f6e8ce']
  const count = round?.participants.length || 12
  const background = `conic-gradient(${Array.from({ length: count }, (_, i) => `${colors[i % colors.length]} ${i * 360 / count}deg ${(i + 1) * 360 / count}deg`).join(',')})`
  return <div className="relative mx-auto aspect-square w-full max-w-[360px] rounded-full border-[9px] border-cream shadow-[0_0_0_1px_#e8ceb0,0_12px_40px_#9d322c15]">
    <span className="absolute -top-3 left-[calc(50%-14px)] z-10 h-9 w-7 bg-brand [clip-path:polygon(0_0,100%_0,50%_100%)]" />
    <div className={`relative size-full overflow-hidden rounded-full border-4 border-white ${spinning ? 'transition-transform duration-[6000ms] ease-[cubic-bezier(.12,.62,.11,1)] motion-reduce:transition-none' : ''}`} style={{ background, transform: `rotate(${rotation}deg)` }} aria-label={round ? `Spinning wheel with ${count} participants` : 'Preview spinning wheel'}>
      {Array.from({ length: count }, (_, i) => (count <= 48 || i % Math.ceil(count / 32) === 0 || round?.winner?.coupon === round?.participants[i].coupon) && <span className="pointer-events-none absolute inset-0 text-center" key={i} style={{ transform: `rotate(${(i + 0.5) * 360 / count}deg)` }}><span className={`mt-5 inline-block max-h-24 overflow-hidden text-[9px] font-semibold [writing-mode:vertical-rl] ${[0, 4, 6].includes(i % colors.length) ? 'text-white' : 'text-[#653b27]'}`}>{round ? round.participants[i].name.slice(0, 20) : ['GOOD', 'LUCK', 'EVERY', 'ONE'][i % 4]}</span></span>)}
    </div>
    <div className="pointer-events-none absolute top-1/2 left-1/2 flex size-24 -translate-1/2 flex-col items-center justify-center gap-1 rounded-full border-[7px] border-cream bg-white text-brand shadow-md"><span className="text-4xl">✦</span><span className="text-[9px] font-bold tracking-widest">GOOD LUCK</span></div>
  </div>
}
