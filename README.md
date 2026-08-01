# 🦆 Đua Vịt Proton — Gala Duck Race

Trò chơi **đua vịt cao cấp** cho gala doanh nghiệp, tối ưu để chiếu trên **màn hình LED lớn**. Bản nâng cấp từ ý tưởng "đua vịt" cổ điển với giao diện hiện đại, hiệu ứng kịch tính và **chế độ loại dần nhiều vòng**.

## ✨ Tính năng

- **Chế độ loại dần (nhiều vòng / 1 game):** mỗi vòng có 1 người về đích → popup chúc mừng → nút **"Loại & Đua tiếp"** để tiếp tục với những người còn lại. Bảng vàng ghi lại thứ hạng đã trao.
- **Người thắng ngẫu nhiên công bằng:** mỗi người có xác suất thắng bằng nhau; animation được dàn dựng để gay cấn (đổi hạng, lội ngược dòng, về đích nghẹt thở).
- **Giao diện gala cao cấp:** theme navy tối + xanh Proton (#1158F2) + accent vàng, hiệu ứng nước, đếm ngược, **camera zoom cận cảnh vạch đích** (photo-finish), pháo giấy.
- **Bảng xếp hạng trực tiếp (Top 6):** đổi hạng real-time — tâm điểm để khán giả theo dõi khi có nhiều người đua (đã tối ưu tới ~60+ người/vòng).
- **Âm thanh:** nhạc nền hồi hộp + hiệu ứng (đếm ngược, còi xuất phát, về đích, pháo tay) tạo bằng Web Audio API — **không cần file ngoài, không vướng bản quyền**, có nút bật/tắt.
- **Tối ưu desktop / màn LED:** nút Toàn màn hình, chữ lớn, canh cho tỉ lệ 16:9.
- **Lưu tự động:** danh sách & tiến trình lưu trong trình duyệt (localStorage) — lỡ F5 giữa sự kiện vẫn không mất.

## 🎮 Cách dùng

1. Mở trang → nhập danh sách người chơi (mỗi dòng 1 tên) → **Vào sân đua**.
2. Chọn thời lượng mỗi vòng (giây).
3. Nhấn **🚀 Bắt đầu cuộc đua** (hoặc phím **Space**).
4. Khi có người về đích → popup hiện lên → **Loại & Đua tiếp**, hoặc **Đua lại vòng này**.

**Phím tắt:** `Space` = bắt đầu · `F` = toàn màn hình. Nút `☰` mở lại danh sách, `🔊` bật/tắt âm thanh, `⛶` toàn màn hình.

## 🖥️ Chạy thử tại máy

Chỉ là web tĩnh, không cần build. Mở bằng một static server bất kỳ, ví dụ:

```bash
npx serve .
```

Rồi mở `http://localhost:3000` (hoặc cổng được in ra).

## 🚀 Deploy lên GitHub Pages

1. Đẩy code lên một repo GitHub (public).
2. Vào **Settings → Pages → Build and deployment**, chọn **Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Sau ~1 phút, game chạy tại `https://<tài-khoản>.github.io/<tên-repo>/`.

## 🎨 Tuỳ biến

- **Logo / màu:** logo đặt tại `assets/proton-logo.jpg`; bảng màu nằm trong `:root` của `css/style.css` (`--blue`, `--gold`, ...).
- **Âm thanh:** toàn bộ nhạc/SFX sinh bằng code trong `js/audio.js` (chỉnh tempo, âm lượng, giai điệu tại đây).
- **Danh sách mẫu:** biến `SAMPLE` trong `js/game.js`.

## 📁 Cấu trúc

```
index.html          # Bố cục + sân khấu đua
css/style.css       # Theme gala, hiệu ứng
js/audio.js         # Nhạc nền + SFX (Web Audio API)
js/confetti.js      # Pháo giấy
js/game.js          # Logic đua, mô phỏng, render canvas, chế độ loại dần
assets/             # Logo
```
