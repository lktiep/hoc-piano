/**
 * Tien ich DOM toi thieu - chi dung nhung API co ca tren trinh duyet (DOMParser)
 * lan tren Node (@xmldom/xmldom), de bo parse dung chung duoc cho ca 2 noi.
 */

export interface XEl {
  nodeType: number
  nodeName: string
  childNodes: ArrayLike<XEl>
  textContent: string | null
  getAttribute(name: string): string | null
  getElementsByTagName(name: string): ArrayLike<XEl>
}

export function elements(el: XEl): XEl[] {
  const out: XEl[] = []
  const kids = el.childNodes
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]
    if (n && n.nodeType === 1) out.push(n)
  }
  return out
}

/** Con truc tiep dau tien co ten `name`. */
export function child(el: XEl | null, name: string): XEl | null {
  if (!el) return null
  const kids = el.childNodes
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]
    if (n && n.nodeType === 1 && n.nodeName === name) return n
  }
  return null
}

/** Tat ca con truc tiep co ten `name`. */
export function children(el: XEl | null, name: string): XEl[] {
  if (!el) return []
  const out: XEl[] = []
  const kids = el.childNodes
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]
    if (n && n.nodeType === 1 && n.nodeName === name) out.push(n)
  }
  return out
}

export function text(el: XEl | null): string {
  return el?.textContent?.trim() ?? ''
}

export function childText(el: XEl | null, name: string): string {
  return text(child(el, name))
}

export function childNum(el: XEl | null, name: string, fallback: number): number {
  const v = parseFloat(childText(el, name))
  return Number.isFinite(v) ? v : fallback
}

export function attrNum(el: XEl | null, name: string, fallback: number): number {
  if (!el) return fallback
  const v = parseFloat(el.getAttribute(name) ?? '')
  return Number.isFinite(v) ? v : fallback
}

/** Tim phan tu dau tien (o bat ky do sau nao) co ten `name`. */
export function findFirst(root: XEl, name: string): XEl | null {
  const list = root.getElementsByTagName(name)
  return list.length > 0 ? list[0] : null
}
