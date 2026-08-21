/** Kieu du lieu dung chung cho toan bo app. */

export type Hand = 'L' | 'R'

/**
 * Mot not nhac.
 * `t` va `d` tinh bang PHACH DEN (quarter note), khong phai giay.
 * Nho vay doi tempo / co tempo thay doi giua bai deu xu ly duoc.
 */
export interface SongNote {
  /** thoi diem bat dau, don vi phach den, tinh tu dau bai */
  t: number
  /** truong do, don vi phach den */
  d: number
  /** cao do MIDI (60 = Do giua = C4) */
  m: number
  /** tay trai / tay phai */
  h: Hand
  /** so ngon tay (1 = ngon cai ... 5 = ngon ut), neu ban nhac co ghi */
  f?: number
}

/** Diem doi tempo. `t` don vi phach den. */
export interface TempoEvent {
  t: number
  bpm: number
}

export interface Song {
  id: string
  title: string
  /** nhac si / nguoi soan */
  artist?: string
  /** nguon (vi du link MuseScore) */
  source?: string
  /** tempo goc, dung khi khong co tempo map */
  bpm: number
  /** so chi nhip, vi du [4, 4] hoac [3, 4] */
  timeSignature: [number, number]
  /** doi tempo giua bai (tuy chon) */
  tempos?: TempoEvent[]
  /** vi tri (phach den) cua vach nhip - phan tu [i] la dau o nhip thu i+1 */
  measures?: number[]
  notes: SongNote[]
  /** 1 = de nhat */
  level?: number
  /** the loai de loc trong thu vien, vi du "DÂN CA", "CỔ ĐIỂN" */
  genre?: string
  tags?: string[]
  /** ghi chu hien thi cho be / phu huynh */
  note?: string
}

/** Mot muc trong danh sach bai hat (public/songs/index.json). */
export interface SongIndexEntry {
  id: string
  title: string
  artist?: string
  level?: number
  genre?: string
  /** do dai bai tinh bang giay - de thu vien hien duoc "DÀI" ma khong phai tai ca bai */
  seconds?: number
  file: string
}

export type PlayMode =
  /** Nghe mau, khong can bam */
  | 'listen'
  /** Cho be bam dung moi chay tiep (mac dinh khi hoc) */
  | 'wait'
  /** Chay deu theo nhip, cham diem */
  | 'follow'

export type HandChoice = 'both' | 'right' | 'left'
export type LabelStyle = 'off' | 'letters' | 'solfege'
/** Hai cach nhin bai: khuong nhac, hoac not roi xuong phim. */
export type StageView = 'sheet' | 'fall'

export interface Settings {
  mode: PlayMode
  /** he so toc do, 1 = dung tempo goc */
  rate: number
  /** be tap tay nao - tay con lai app tu danh */
  hands: HandChoice
  /** co phat tieng cho phan be tu danh khong */
  guideSound: boolean
  metronome: boolean
  countIn: boolean
  labels: LabelStyle
  showFingers: boolean
  /** so phach hien thi tren man not roi */
  lookaheadBeats: number
  /** lap doan: [o nhip bat dau, o nhip ket thuc], 1-based, null = tat */
  loop: [number, number] | null
  /** dich giong, tinh bang nua cung (-12..12). 0 = dung cao do goc */
  transpose: number
  /** dang xem: khuong nhac hay not roi */
  view: StageView
}
