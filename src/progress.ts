/**
 * Tien do hoc that su cua be, luu ngay tren may.
 *
 * Chi ghi khi be choi HET mot bai (Player goi `onFinish`). Khong doan, khong
 * khoa bai nao lai: trang Lo trinh chi to mau nhung bai da choi xong that.
 */

const KEY = 'hoc-piano.progress.v1'

export interface Progress {
  /** ma cac bai da choi het it nhat mot lan */
  done: string[]
  /** bai mo gan nhat — hien la "DANG HOC" tren lo trinh */
  lastId: string | null
}

const EMPTY: Progress = { done: [], lastId: null }

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const p = JSON.parse(raw) as Partial<Progress>
    return {
      done: Array.isArray(p.done) ? p.done.filter((v): v is string => typeof v === 'string') : [],
      lastId: typeof p.lastId === 'string' ? p.lastId : null,
    }
  } catch {
    return EMPTY
  }
}

function save(p: Progress): Progress {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* het cho luu thi thoi, khong lam hong buoi tap */
  }
  return p
}

export function markDone(id: string): Progress {
  const p = loadProgress()
  if (p.done.includes(id)) return p
  return save({ ...p, done: [...p.done, id] })
}

export function markOpened(id: string): Progress {
  const p = loadProgress()
  if (p.lastId === id) return p
  return save({ ...p, lastId: id })
}

export function clearProgress(): Progress {
  return save({ ...EMPTY })
}
