/**
 * Thanh dieu huong va chan trang dung chung cho ca bon trang.
 *
 * Ban thiet ke ve o day mot cap nut "DANG NHAP / MO KHOA PRO". Trang nay
 * khong co tai khoan va khong ban gi ca, nen cho do dat hai viec that su
 * dung duoc: them bai cua be, va vao thang phong luyen.
 */

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { BRAND, ROUTE_HASH, type Route } from '../routes'

const LINKS: { route: Route; label: string }[] = [
  { route: 'home', label: 'TRANG CHỦ' },
  { route: 'player', label: 'LUYỆN TẬP' },
  { route: 'library', label: 'THƯ VIỆN' },
  { route: 'roadmap', label: 'LỘ TRÌNH' },
]

interface SiteNavProps {
  current: Route
  go: (route: Route) => void
  onOpenImport?: () => void
  /** Thay cho cum nut ben phai, khi trang can thu khac (vi du phong luyen). */
  right?: ReactNode
}

/** Bam vao lien ket trong trang: tu xu ly, khong de trinh duyet nhay lung tung. */
function useGo(go: (route: Route) => void) {
  return (route: Route) => (e: ReactMouseEvent) => {
    e.preventDefault()
    go(route)
  }
}

export function Brand({ go }: { go: (route: Route) => void }) {
  const nav = useGo(go)
  return (
    <a className="hm-brand" href={ROUTE_HASH.home} onClick={nav('home')}>
      <span className="hm-brand-mark" />
      <span>
        {BRAND}
        <span className="hm-dot">.</span>
      </span>
    </a>
  )
}

export function SiteNav({ current, go, onOpenImport, right }: SiteNavProps) {
  const nav = useGo(go)
  return (
    <header className="hm-nav">
      <Brand go={go} />
      <nav className="hm-nav-links">
        {LINKS.map((l) => (
          <a
            key={l.route}
            className={l.route === current ? 'is-current' : undefined}
            href={ROUTE_HASH[l.route]}
            onClick={nav(l.route)}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="hm-nav-right">
        {right ?? (
          <>
            {onOpenImport && (
              <button className="hm-link-btn" onClick={onOpenImport}>
                ＋ THÊM BÀI
              </button>
            )}
            <button className="hm-btn" onClick={() => go('player')}>
              VÀO PHÒNG LUYỆN
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export function SiteFoot({ go }: { go: (route: Route) => void }) {
  const nav = useGo(go)
  return (
    <footer className="hm-foot">
      <span className="hm-foot-brand">
        <span className="hm-brand-mark" />
        <span>
          {BRAND}
          <span className="hm-dot">.</span>
        </span>
      </span>
      <a href={ROUTE_HASH.library} onClick={nav('library')}>
        THƯ VIỆN
      </a>
      <a href={ROUTE_HASH.roadmap} onClick={nav('roadmap')}>
        LỘ TRÌNH
      </a>
      <a href={ROUTE_HASH.player} onClick={nav('player')}>
        LUYỆN TẬP
      </a>
      <span className="hm-foot-note">© 2026 {BRAND} — Học piano tương tác</span>
    </footer>
  )
}
