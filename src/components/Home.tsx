/**
 * Trang chu — dung theo thiet ke "Trang Chu.dc.html" (he Modernist).
 *
 * Moi con so va moi duong dan tren trang deu noi voi du lieu that cua ung dung:
 * so bai lay tu kho bai, cac muc lo trinh dem theo do kho, cac nut mo dung
 * phong luyen / thu vien / lo trinh / hop thoai them bai.
 */

import type { CSSProperties } from 'react'
import { SiteFoot, SiteNav } from './SiteNav'
import { levelGroup, type LevelGroup } from '../catalog'
import type { Route } from '../routes'
import type { Song, SongIndexEntry } from '../types'

const KEY_NAMES = ['Đô', 'Rê', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Đô']
/** Vi tri phim den trong mot quang tam (theo % be ngang), giong ban thiet ke. */
const BLACK_KEYS = [9, 21.5, 46.5, 59, 71.5]
/** Do dai tung not trong hinh minh hoa — dai ngan khac nhau cho ra dang mot cau nhac. */
const NOTE_HEIGHTS = [40, 40, 62, 40, 40, 78, 40, 96]

const LEVELS: { num: string; name: string; meta: string; key: LevelGroup }[] = [
  { num: '01', name: 'Cơ bản', meta: 'Một tay, năm ngón', key: 1 },
  { num: '02', name: 'Trung cấp', meta: 'Hai tay, nốt móc đơn', key: 2 },
  { num: '03', name: 'Nâng cao', meta: 'Chuyển ngón & sắc thái', key: 3 },
]

/** `--i` cho phep CSS tinh do tre cua tung phim / tung not roi. */
function lane(i: number): CSSProperties {
  return { ['--i' as string]: i } as CSSProperties
}

function Keyboard({ className = '' }: { className?: string }) {
  return (
    <div className={`hm-keys ${className}`.trim()}>
      {KEY_NAMES.map((name, i) => (
        <div key={i} className={`hm-key-w${i === KEY_NAMES.length - 1 ? ' is-last' : ''}`} style={lane(i)}>
          <span className="hm-key-name">{name}</span>
        </div>
      ))}
      {BLACK_KEYS.map((left) => (
        <div key={left} className="hm-key-b" style={{ left: `${left}%` }} />
      ))}
    </div>
  )
}

interface HomeProps {
  index: SongIndexEntry[]
  localSongs: Song[]
  go: (route: Route) => void
  onOpenImport: () => void
  onOpenSong: (id: string) => void
}

export function Home({ index, localSongs, go, onOpenImport, onOpenSong }: HomeProps) {
  const ids = new Set<string>()
  const levels: number[] = []
  for (const s of [...index, ...localSongs]) {
    if (ids.has(s.id)) continue
    ids.add(s.id)
    levels.push(s.level ?? 1)
  }
  const songCount = levels.length

  return (
    <div className="site home">
      <SiteNav current="home" go={go} onOpenImport={onOpenImport} />

      {/* ----------------------------------------------------------------- hero */}
      <section className="hm-hero">
        <div className="hm-rise">
          <div className="hm-kicker">TRANG TẬP ĐÀN CHO BÉ · PHÍM TO RÕ RÀNG</div>
          <h1>Học piano bằng cách chơi thật.</h1>
          <p className="hm-lead">
            Nốt nhạc rơi đúng cột của phím đàn, tên nốt Đô Rê Mi ghi to trên từng phím. Bài nhạc đứng chờ tới khi bé
            bấm đúng rồi mới chạy tiếp — nên bé tập một mình cũng không bị bỏ lại.
          </p>
          <div className="hm-hero-actions">
            <button className="hm-btn-lg" onClick={() => go('player')}>
              VÀO PHÒNG LUYỆN
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </button>
            <button className="hm-btn-ghost" onClick={() => go('library')}>
              XEM THƯ VIỆN
            </button>
          </div>
        </div>

        <div className="hm-rise-2">
          <div className="hm-demo">
            <div className="hm-staff">
              <svg viewBox="0 0 480 130" aria-hidden="true">
                {[25, 45, 65, 85, 105].map((y) => (
                  <line key={y} x1="10" y1={y} x2="470" y2={y} />
                ))}
                {KEY_NAMES.map((_, i) => (
                  <circle key={i} cx={50 + i * 56} cy={105 - i * 10} r="8" style={lane(i)} />
                ))}
              </svg>
            </div>
            <Keyboard />
          </div>
          <div className="hm-demo-foot">
            <span>GAM ĐÔ TRƯỞNG · PHÍM SÁNG THEO NỐT</span>
            <button className="hm-more" onClick={() => onOpenSong('thang-am-do-truong')}>
              THỬ NGAY →
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- so lieu */}
      <section className="hm-stats">
        <div className="hm-stat">
          <div className="hm-stat-num">88</div>
          <div className="hm-stat-label">PHÍM ĐÀN ĐẦY ĐỦ</div>
        </div>
        <div className="hm-stat">
          <div className="hm-stat-num">
            {songCount || '—'}
            <i>+</i>
          </div>
          <div className="hm-stat-label">BẢN NHẠC CÓ SẴN, THÊM ĐƯỢC NỮA</div>
        </div>
        <div className="hm-stat">
          <div className="hm-stat-num">3</div>
          <div className="hm-stat-label">CHẾ ĐỘ: CHỜ · NGHE MẪU · THEO NHỊP</div>
        </div>
        <div className="hm-stat">
          <div className="hm-stat-num">
            25–150<i>%</i>
          </div>
          <div className="hm-stat-label">TỐC ĐỘ CHẬM LẠI TUỲ Ý</div>
        </div>
      </section>

      {/* ------------------------------------------------------ cach hoat dong */}
      <section className="hm-how">
        <div className="hm-kicker">CÁCH HOẠT ĐỘNG</div>
        <div className="hm-how-grid">
          <div className="hm-step">
            <div className="hm-step-num">01</div>
            <h3>Chọn bản nhạc</h3>
            <p>
              Dân ca, đồng dao và nhạc cổ điển xếp sẵn theo độ khó. Muốn bài nào khác thì tải bản nhạc từ MuseScore rồi
              thả thẳng vào trang.
            </p>
            <button className="hm-more" onClick={() => go('library')}>
              MỞ THƯ VIỆN →
            </button>
          </div>
          <div className="hm-step">
            <div className="hm-step-num">02</div>
            <h3>Chơi theo phím sáng</h3>
            <p>
              Nốt rơi đúng cột phím, phím cần bấm sáng lên và bài nhạc đứng chờ. Đàn piano điện, chuột hay bàn phím máy
              tính đều chơi được.
            </p>
            <button className="hm-more" onClick={() => go('player')}>
              VÀO PHÒNG LUYỆN →
            </button>
          </div>
          <div className="hm-step">
            <div className="hm-step-num">03</div>
            <h3>Tăng tốc dần</h3>
            <p>
              Bắt đầu ở một nửa tốc độ, lặp riêng đoạn khó cho tới khi thuộc tay, rồi nhanh dần lên đúng nhịp của bài.
            </p>
            <button className="hm-more" onClick={() => go('roadmap')}>
              XEM LỘ TRÌNH →
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ lo trinh */}
      <section className="hm-path" id="lo-trinh">
        <div className="hm-fall" aria-hidden="true">
          <div className="hm-fall-area">
            {KEY_NAMES.map((_, i) => (
              <div key={`l${i}`} className="hm-fall-lane" style={lane(i)} />
            ))}
            {KEY_NAMES.map((_, i) => (
              <div
                key={`n${i}`}
                className={`hm-fall-note${i % 3 === 2 ? ' is-left' : ''}`}
                style={{ ...lane(i), height: NOTE_HEIGHTS[i] }}
              />
            ))}
          </div>
          <div className="hm-fall-line" />
          <Keyboard className="hm-fall-keys" />
        </div>
        <div>
          <div className="hm-kicker">LỘ TRÌNH RÕ RÀNG</div>
          <h2>Từ nốt đầu tiên đến bản nhạc đầu tay.</h2>
          <p>
            {songCount > 0 ? `${songCount} bản nhạc` : 'Cả kho bài'} xếp theo ba mức. Mỗi mức kết thúc bằng một bài thật
            để bé chơi trọn vẹn — lúc nào cũng biết mình đang ở đâu và bước tiếp theo là gì.
          </p>
          <div className="hm-levels">
            {LEVELS.map((lv) => {
              const n = levels.filter((l) => levelGroup(l) === lv.key).length
              return (
                <button key={lv.num} className="hm-level" onClick={() => go('roadmap')}>
                  <span className="hm-level-num">{lv.num}</span>
                  <span className="hm-level-name">{lv.name}</span>
                  <span className="hm-level-meta">
                    {lv.meta} · {n} bài
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- keu goi cuoi */}
      <section className="hm-cta-band">
        <div className="hm-cta-inner">
          <h2>Ngồi vào đàn hôm nay.</h2>
          <p>Không cần đăng nhập, không cần cài gì. Mở trang lên là bấm được — kể cả khi mất mạng.</p>
          <div className="hm-cta-actions">
            <button className="hm-btn-white" onClick={() => go('player')}>
              BẮT ĐẦU TẬP NGAY
            </button>
            <button className="hm-btn-outline" onClick={onOpenImport}>
              THÊM BÀI CỦA BÉ
            </button>
          </div>
        </div>
      </section>

      <SiteFoot go={go} />
    </div>
  )
}
