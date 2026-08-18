# Học Piano 🎹

Trang tập đàn piano **đơn giản cho bé**, chỉ tập trung vào một việc: đánh đàn.

Nốt nhạc rơi từ trên xuống đúng cột của phím đàn, phím **to rõ** có ghi tên nốt
tiếng Việt (Đô Rê Mi), và ở chế độ mặc định bài nhạc **đứng chờ tới khi bé bấm
đúng phím** rồi mới chạy tiếp — nên bé tập được một mình mà không bị bỏ lại phía sau.

Không cần cài gì, không cần đăng nhập, chạy được cả khi mất mạng.

---

## Bắt đầu

```bash
npm install
npm run dev        # mở http://localhost:5173
```

Các lệnh khác:

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | chạy thử ở máy |
| `npm run build` | dựng bản chạy thật vào `dist/` |
| `npm run preview` | xem thử bản đã dựng |
| `npm test` | chạy toàn bộ 158 bài kiểm thử |
| `npm run typecheck` | kiểm tra kiểu TypeScript |
| `npm run songs` | sinh lại các bài có sẵn trong `public/songs/` |
| `npm run import -- <tệp>` | nạp một bản nhạc mới vào kho bài |

---

## Cách chơi

### Ba chế độ

| Chế độ | Nghĩa là |
| --- | --- |
| **Chờ bé bấm** *(mặc định)* | Nhạc dừng ở mỗi nốt và chờ. Bấm đúng thì đi tiếp. Không bao giờ bị "trượt". |
| **Nghe mẫu** | Máy tự đánh cả bài để bé nghe trước. |
| **Theo nhịp** | Nhạc chạy đều, bé bấm theo. Có chấm điểm đúng/sai. |

Chọn **Tay phải / Tay trái / Hai tay** — tay còn lại máy sẽ tự đánh đệm.

### Bé bấm bằng gì cũng được

1. **Đàn piano điện / keyboard MIDI** — cắm cáp USB vào máy tính rồi bấm
   "Kết nối đàn" (dùng Chrome hoặc Edge). Đây là cách tốt nhất: bé tập trên
   phím đàn thật, màn hình chỉ để nhìn theo.
2. **Chuột / màn hình cảm ứng** — bấm thẳng lên phím trên màn hình (bấm được nhiều phím cùng lúc).
3. **Bàn phím máy tính** — hàng `z x c v b n m` là quãng tám dưới,
   hàng `q w e r t y u i` là quãng tám trên, phím đen ở hàng `s d g h j` và `2 3 5 6 7`.

### Phím tắt

- `Space` — chơi / dừng
- `Esc` — đóng hộp thoại

### Màu sắc

- 🟠 cam = **tay phải**, 🔵 xanh dương = **tay trái**
- 🟢 viền xanh lá = nốt **đang chờ bé bấm**
- 🔴 đỏ = bấm nhầm phím

### Trong ⚙ Cài đặt

Tốc độ chậm lại (25%–150%), tên nốt (Đô Rê Mi / C D E / ẩn), số ngón tay,
gõ nhịp, đếm vào, độ "nhìn trước", **lặp một đoạn** (chọn từ ô nhịp mấy đến ô nhịp mấy)
để tập đi tập lại chỗ khó, và bàn phím rộng 5 quãng tám.

---

## Thêm bài mới từ MuseScore

> **Lưu ý quan trọng:** MuseScore chặn việc tải bản nhạc tự động từ đường
> link (máy chủ trả về lỗi 403 cho mọi truy cập không phải trình duyệt), nên
> **không thể dán URL vào đây là ra bài**. Cách làm dưới đây chỉ mất thêm một
> bước tải tệp, nhưng đổi lại giữ được **đúng tay trái/tay phải và số ngón tay**
> mà tác giả bản nhạc đã soạn.

### Bước 1 — Lấy tệp bản nhạc

Mở bản nhạc trên musescore.com → nút **Download** → chọn **MusicXML** (`.mxl`).
Nếu không tải được (bản nhạc yêu cầu tài khoản Pro), mở bản nhạc bằng phần mềm
**MuseScore Studio** (miễn phí) rồi vào **Tệp → Xuất → MusicXML**.

Trang này đọc được: `.mxl`, `.musicxml`, `.xml`, `.mid`, `.midi`, `.json`.
Nên ưu tiên **MusicXML** vì tệp MIDI không ghi tay nào chơi nốt nào.

### Bước 2 — Cách A: kéo thả ngay trên trang (nhanh nhất)

⚙ **Cài đặt → ＋ Thêm bài từ MuseScore** → kéo tệp vào → xem thử → **Thêm vào
danh sách và chơi**. Bài được lưu trong trình duyệt của máy đó.

### Bước 2 — Cách B: nạp thẳng vào kho bài của trang

Dùng cách này nếu muốn bài xuất hiện sẵn cho mọi người vào trang:

```bash
npm run import -- ~/Downloads/ban-nhac.mxl \
  --title "Tên bài" \
  --level 2 \
  --source "https://musescore.com/user/71271952/scores/13820440"
```

Lệnh này ghi `public/songs/<mã-bài>.json` và cập nhật `public/songs/index.json`.
Các tuỳ chọn khác:

| Tuỳ chọn | Việc |
| --- | --- |
| `--title` / `--artist` | đặt tên bài / tác giả |
| `--id` | tự đặt mã bài (mặc định sinh từ tên) |
| `--source` | lưu link gốc để bấm "Xem bản gốc" |
| `--level 1..5` | độ khó hiện trong danh sách |
| `--no-repeats` | **không** trải dấu nhắc lại |
| `--dry` | chỉ in kết quả, không ghi tệp |

Trình đọc MusicXML xử lý: nhịp lấy đà, hợp âm, dấu nối, dấu nhắc lại + khung 1/khung 2,
`backup`/`forward` nhiều bè, đổi tempo giữa bài, số ngón tay, và tách tay theo khuông nhạc.

---

## Tự viết bài bằng ký pháp gọn

Các bài có sẵn được viết trong `scripts/make-starter-songs.mjs` bằng một ký pháp rất ngắn:

```js
{
  id: 'mary-co-con-cuu-nho',
  title: 'Mary có con cừu nhỏ',
  bpm: 96,
  timeSignature: [4, 4],
  rh: `E4 D4 C4 D4  E4 E4 E4:2  D4 D4 D4:2  E4 G4 G4:2`,
  lh: `C3:4  C3:4  G2:4  C3:4`,
}
```

`C4` = nốt đen Đô quãng tám 4 · `:2` = dài 2 phách · `r` = lặng ·
`[C4 E4 G4]` = hợp âm · `@3` = ngón 3. Sửa xong chạy `npm run songs`.
Bộ sinh sẽ **báo lỗi nếu một ô nhịp thiếu hoặc thừa phách**, nên không sợ viết sai.

---

## Kiểm thử

```bash
npm test
```

- `scripts/selftest.ts` — 117 phép thử phần lõi: hình học phím đàn, đổi phách↔giây,
  cả ba chế độ chơi, lặp đoạn, gõ nhịp, đổi tốc độ, đọc MusicXML (kể cả dấu nhắc lại
  và dấu nối), đọc tệp MIDI, và kiểm tra mọi bài trong `public/songs/`.
- `scripts/uitest.ts` — 41 phép thử **cả giao diện thật** trong DOM giả (jsdom):
  mount app, vẽ canvas, bấm nút, gõ phím, bấm chuột lên phím đàn, mở/đóng hộp thoại,
  chạy 600 khung hình liên tục và bắt mọi lỗi lúc chạy.

Cả hai chạy tự động trên GitHub Actions ở mỗi lần push.

---

## Xuất bản

Trang đang chạy ở hai nơi:

| Nơi | Link | Cách cập nhật |
| --- | --- | --- |
| **Cloudflare Pages** | https://hoc-piano.pages.dev | `npm run deploy` |
| **GitHub Pages** | https://lktiep.github.io/hoc-piano/ | tự động mỗi lần `git push` |

**Cloudflare Pages** — cấu hình trong `wrangler.toml`, tiêu đề cache trong `public/_headers`.
Lần đầu trên máy mới cần `npx wrangler login` một lần, sau đó chỉ cần:

```bash
npm run deploy     # dựng lại rồi đẩy lên
```

**GitHub Pages** — `.github/workflows/deploy.yml` tự chạy typecheck → test → build →
xuất bản mỗi lần push lên `main`. Trong repo cần đặt **Settings → Pages → Source:
GitHub Actions** một lần duy nhất (đã đặt rồi).

Vì `vite.config.ts` đặt `base: './'` nên bản dựng chạy được ở bất kỳ thư mục con nào —
kể cả mở thẳng `dist/index.html` bằng trình duyệt, hoặc đặt lên bất kỳ máy chủ tĩnh nào.

---

## Cấu trúc mã nguồn

```
src/
  App.tsx              gắn mọi thứ lại với nhau, phím tắt, lưu cài đặt
  types.ts             mô hình dữ liệu bài hát (thời gian tính bằng PHÁCH, không phải giây)
  engine/
    timeline.ts        đổi phách ↔ giây, có bản đồ tempo và vạch nhịp
    player.ts          bộ chơi: cổng nốt, chờ bấm đúng, chấm điểm, lặp đoạn
  audio/
    piano.ts           tiếng piano tổng hợp bằng Web Audio (không cần tệp mẫu)
    metronome.ts       tiếng gõ nhịp
  music/
    notes.ts           tên nốt, phím đen/trắng
    layout.ts          hình học bàn phím — dùng chung cho vẽ và cho việc bấm
    musicxml.ts        đọc MusicXML
    midiFile.ts        đọc tệp MIDI chuẩn
    importSong.ts      gộp đầu vào, giải nén .mxl, kiểm tra hợp lệ
  input/
    webmidi.ts         đàn piano điện qua Web MIDI
    keymap.ts          bàn phím máy tính
  components/
    Stage.tsx          MỘT canvas vẽ cả nốt rơi lẫn bàn phím (khớp cột tuyệt đối, 60fps)
    Controls.tsx       thanh điều khiển + bảng cài đặt
    SongPicker.tsx     chọn bài
    ImportDialog.tsx   thêm bài từ MuseScore
    HelpDialog.tsx     hướng dẫn
public/songs/          kho bài (JSON) + index.json
scripts/               sinh bài mẫu, nạp bản nhạc, kiểm thử
```

Các bài có sẵn đều là dân ca / nhạc cổ điển thuộc phạm vi công cộng.
