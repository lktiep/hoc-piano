import { Modal } from './Modal'
import { fullVietnameseName } from '../music/notes'

export function HelpDialog({ onClose, baseC }: { onClose: () => void; baseC: number }) {
  return (
    <Modal title="Hướng dẫn" onClose={onClose} wide>
      <h3 className="list-head">Cách chơi</h3>
      <ul className="help">
        <li>
          <b>Chờ bé bấm</b> — nốt rơi xuống vạch sáng rồi <i>dừng lại</i>. Phím cần bấm sáng xanh lá. Bấm đúng thì nhạc chạy tiếp. Đây là
          chế độ để tập.
        </li>
        <li>
          <b>Nghe mẫu</b> — máy đánh cả bài cho bé nghe trước.
        </li>
        <li>
          <b>Theo nhịp</b> — nhạc chạy đều không chờ, cuối bài có phần trăm đúng.
        </li>
        <li>
          Chọn <b>Tay phải / Tay trái / Hai tay</b>: tay bé không chọn thì máy tự đàn phần đó.
        </li>
        <li>
          Giảm <b>tốc độ</b> xuống 50–70% khi mới tập, quen rồi tăng dần.
        </li>
      </ul>

      <h3 className="list-head">Cách bấm</h3>
      <ul className="help">
        <li>
          <b>Đàn piano điện</b> — cắm cáp USB vào máy tính rồi bấm “Kết nối đàn”. Cần dùng Chrome hoặc Edge.
        </li>
        <li>
          <b>Chuột / màn hình cảm ứng</b> — bấm thẳng vào phím đàn trên màn hình.
        </li>
        <li>
          <b>Bàn phím máy tính</b> — hàng <code>Z X C V B N M</code> là {fullVietnameseName(baseC)} trở lên, hàng{' '}
          <code>Q W E R T Y U</code> cao hơn một quãng tám. Phím <code>Space</code> để chơi / dừng.
        </li>
      </ul>

      <h3 className="list-head">Thêm bài mới</h3>
      <ul className="help">
        <li>
          Tải bản nhạc dạng <b>MusicXML</b> (.mxl / .musicxml) hoặc <b>MIDI</b> (.mid) rồi kéo thả vào mục “Thêm bài từ MuseScore”. Bản
          MusicXML tốt hơn vì giữ được tay trái / tay phải và số ngón tay.
        </li>
        <li>Bài thêm vào được lưu ngay trong trình duyệt máy này. Bấm ⭳ để tải file JSON nếu muốn đưa vào kho bài chung của trang.</li>
      </ul>

      <h3 className="list-head">Màu sắc</h3>
      <ul className="help">
        <li>
          <span className="swatch swatch-r" /> nốt tay phải · <span className="swatch swatch-l" /> nốt tay trái
        </li>
        <li>
          <span className="swatch swatch-hint" /> phím đang cần bấm · <span className="swatch swatch-bad" /> bấm sai
        </li>
        <li>Nốt mờ là phần máy tự đàn giúp bé.</li>
      </ul>
    </Modal>
  )
}
