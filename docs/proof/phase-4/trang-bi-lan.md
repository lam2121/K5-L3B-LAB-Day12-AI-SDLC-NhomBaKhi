# Kiểm tra trang bị lặn

- Chrome headless mở **Bắt đầu hành trình**. Màn chuẩn bị hiển thị bốn ảnh dụng cụ, ví 180k và nút mua theo số dư. Mua súng trừ 150k và nhận hai viên. Giao diện ở chiều rộng 375 px không tràn ngang.
- Chrome dùng `F` và nút **Bắn** để hạ hai cá sấu trong tình huống kiểm tra. Mỗi lần bắn trúng tiêu một viên, cộng 30k và vẽ hiệu ứng bong bóng. Sau phát thứ hai, ví có 90k, hết đạn và nút bắn bị khóa. Không có lỗi JavaScript. Máy chủ trả HTTP 200 cho atlas trang bị.
- Bộ Python chạy qua 69 bài test, gồm mua đồ đúng giai đoạn, khóa mua trùng hoặc vượt sức chứa, giữ tiền và đạn qua đêm, áp dụng bình oxy và áo phao trước khi lặn, và giữ đạn khi chưa có mục tiêu trong tầm.
- Chạy headless `--mode day --seed 42 --days 5 --ticks 600` thành công. JSONL không có trường trang bị hay sự kiện hạ cá sấu của phiên live.
