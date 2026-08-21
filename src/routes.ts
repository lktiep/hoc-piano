/**
 * Bon trang cua ung dung. Dinh tuyen bang dau `#` de chay duoc tren moi may
 * chu tinh (GitHub Pages, Cloudflare Pages, ca khi mo bang file://).
 */

export type Route = 'home' | 'library' | 'roadmap' | 'player'

export const ROUTE_HASH: Record<Route, string> = {
  home: '#/',
  library: '#/thu-vien',
  roadmap: '#/lo-trinh',
  player: '#/luyen-tap',
}

/** Ten hien tren trang. Doi o day la doi ca bon trang. */
export const BRAND = 'PHÍM'

export function routeFromHash(hash?: string): Route {
  const raw = hash ?? (typeof window === 'undefined' ? '' : window.location.hash)
  const path = raw.replace(/^#\/?/, '')
  if (path.startsWith('luyen-tap')) return 'player'
  if (path.startsWith('thu-vien')) return 'library'
  if (path.startsWith('lo-trinh')) return 'roadmap'
  return 'home'
}
