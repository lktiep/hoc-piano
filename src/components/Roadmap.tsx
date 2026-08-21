/**
 * Lo trinh hoc — theo ban thiet ke "Lo Trinh.dc.html".
 *
 * Ba chang xep theo do kho cua chinh kho bai. Con so "x / y bai hoan thanh"
 * la tien do THAT: mot bai chi duoc tick khi be choi het bai do it nhat mot
 * lan (Player bao `onFinish`).
 *
 * Ban thiet ke ve o khoa cho cac bai chua toi luot. Trang nay khong khoa gi:
 * be muon mo bai nao cung duoc, lo trinh chi de biet nen tap gi truoc.
 */

import { useMemo } from 'react'
import { SiteFoot, SiteNav } from './SiteNav'
import { buildCatalog, formatDuration, LEVEL_NAMES, levelGroup, type LevelGroup } from '../catalog'
import type { Route } from '../routes'
import type { Song, SongIndexEntry } from '../types'

const STAGES: { key: LevelGroup; num: string; name: string; sub: string }[] = [
  { key: 1, num: '01', name: 'Cơ bản', sub: 'Một tay, năm ngón, nốt tròn và nốt đen' },
  { key: 2, num: '02', name: 'Trung cấp', sub: 'Hai tay cùng lúc, nốt móc đơn, nhịp 3/4' },
  { key: 3, num: '03', name: 'Nâng cao', sub: 'Chuyển ngón, dấu thăng giáng và sắc thái' },
]

interface RoadmapProps {
  index: SongIndexEntry[]
  localSongs: Song[]
  done: string[]
  /** bai mo gan nhat — hien la "DANG HOC" */
  currentId: string | null
  go: (route: Route) => void
  onPick: (entry: SongIndexEntry | Song) => void
  onOpenImport: () => void
  onResetProgress: () => void
}

export function Roadmap({ index, localSongs, done, currentId, go, onPick, onOpenImport, onResetProgress }: RoadmapProps) {
  const all = useMemo(() => buildCatalog(index, localSongs), [index, localSongs])

  const byStage = useMemo(() => {
    const m = new Map<LevelGroup, ReturnType<typeof buildCatalog>>()
    for (const s of STAGES) m.set(s.key, [])
    for (const it of all) m.get(levelGroup(it.level))!.push(it)
    for (const list of m.values()) list.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, 'vi'))
    return m
  }, [all])

  const doneCount = all.filter((it) => done.includes(it.id)).length
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0

  const open = (entry: SongIndexEntry | Song) => {
    onPick(entry)
    go('player')
  }

  return (
    <div className="site roadmap">
      <SiteNav current="roadmap" go={go} onOpenImport={onOpenImport} />

      <div className="hm-head">
        <div>
          <span className="hm-kicker">LỘ TRÌNH HỌC</span>
          <h1>Từng bài, từng cấp độ</h1>
        </div>
        <div className="hm-head-side">
          {doneCount} / {all.length} BÀI HOÀN THÀNH
          <div className="rm-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="rm-body">
        {STAGES.map((stage) => {
          const list = byStage.get(stage.key) ?? []
          const n = list.filter((it) => done.includes(it.id)).length
          return (
            <section className="rm-stage" key={stage.key}>
              <div className="rm-stage-head">
                <span className="rm-stage-num">{stage.num}</span>
                <div>
                  <h2>{stage.name}</h2>
                  <div className="rm-stage-sub">{stage.sub}</div>
                </div>
                <span className="rm-stage-count">
                  {list.length ? `${n} / ${list.length} BÀI` : 'CHƯA CÓ BÀI'}
                </span>
              </div>

              <div className="rm-grid">
                {list.map((it, i) => {
                  const isDone = done.includes(it.id)
                  const isCurrent = it.id === currentId
                  return (
                    <button
                      key={it.id}
                      className={`rm-card${isCurrent ? ' is-current' : ''}`}
                      onClick={() => open(it.source)}
                    >
                      <div className="rm-card-top">
                        <span className="rm-card-label">BÀI {String(i + 1).padStart(2, '0')}</span>
                        {isDone ? (
                          <span className="rm-check" title="Đã chơi xong">
                            ✓
                          </span>
                        ) : isCurrent ? (
                          <span className="rm-badge">ĐANG HỌC</span>
                        ) : null}
                      </div>
                      <h3>{it.title}</h3>
                      <div className="rm-card-meta">
                        {[it.artist, it.genre ?? LEVEL_NAMES[stage.key], formatDuration(it.seconds)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </button>
                  )
                })}
                {list.length === 0 && (
                  <div className="rm-empty">
                    Chưa có bài nào ở mức này. Thêm bản nhạc từ MuseScore là nó hiện ra ngay.
                  </div>
                )}
              </div>
            </section>
          )
        })}

        <div className="rm-outro">
          <p>
            Tick chỉ hiện khi bé chơi hết một bài. Tiến độ lưu ngay trên máy này, không gửi đi đâu cả.
          </p>
          {doneCount > 0 && (
            <button className="hm-btn-ghost rm-reset" onClick={onResetProgress}>
              XOÁ TIẾN ĐỘ
            </button>
          )}
        </div>
      </div>

      <SiteFoot go={go} />
    </div>
  )
}
