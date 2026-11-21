# Kiểm tra sprite 2D

Kiểm Chrome headless ở hai cảnh live. Máy chủ phục vụ atlas WebP từ `chonoi/web/assets/`; yêu cầu hợp lệ trả HTTP 200 với MIME `image/webp`, đường dẫn thiếu hoặc ngoài thư mục trả 404.

- Út Sen đứng đúng trên bến và mặt nước, không vẽ chân lơ lửng trên sông. Khi lặn, Canvas cắt sprite ở đường nước và vẽ gợn nước; khi bơi/ngoi lên, đổi đúng tư thế.
- Giữ hướng di chuyển để kiểm hoạt ảnh đi và bơi. Cá đổi tư thế đuôi, cá sấu có các khung tuần tra và đuổi theo người chơi.
- Cảnh thể hiện trời, núi, nhà sàn, lục bình, lau, xuồng, đèn lồng, giỏ, chum và vật dụng quán. Cảnh ca tối tải atlas, hoạt ảnh khách và tương phản cao hoạt động.
- Các cảnh được kiểm tại chiều rộng 390 px; không có lỗi JavaScript.
- Regression suite hiện đạt **69/69**. Nguồn prompt và danh mục ảnh nằm trong [README assets](../../../chonoi/web/assets/README.md); ghi công ở [CREDITS](../../../CREDITS.md).
