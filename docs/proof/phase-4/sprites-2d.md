# Kiểm tra sprite 2D

- `PYTHONPATH=tests:. python3 -m unittest discover -s tests -v` chạy qua 66 bài test. Trên Windows, `PYTHONPATH` dùng `tests;.`.
- `node --check chonoi/web/art.js`, `node --check chonoi/web/assets/sprites.js` và `git diff --check` đều qua.
- Chrome headless mở bản game cục bộ với seed 42. Canvas vẽ được đủ 15 vùng sprite trong hai cảnh. Cảnh lặn chuyển tư thế Út Sen khi bấm `W` lên mặt nước. Cảnh mở quán hiển thị ba mẫu khách và bật được chế độ tương phản cao. Không có lỗi JavaScript, hai atlas trả HTTP 200 với MIME `image/webp`.
- Kiểm tra lại lỗi đứng giữa sông bằng Chrome headless. Bấm `W` ngoi lên, Canvas cắt sprite tại đường nước và vẽ gợn nước. Bấm `S` lặn lại, Canvas vẽ sprite bơi. Khi bắt đầu trên bến, Canvas vẽ đủ tư thế đứng. Cảnh mở quán tiếp tục tải sprite và không có lỗi JavaScript. Chạy lại 66 bài test đều qua.
- Chrome headless giữ `D` trong hai cảnh với seed 42 và ghi nhận đủ ba khung bơi, ba khung đi bộ, đuôi cá đổi độ nghiêng và xuồng đổi vị trí theo thời gian. Canvas vẽ đủ ba mẫu nhà, nền trời và núi, lục bình, lau, đèn lồng, giỏ và chum đất. Cả năm atlas trả HTTP 200. Cảnh mở quán kiểm lại tùy chọn tương phản cao và chiều rộng 390 px. Không có lỗi JavaScript. Chạy lại 66 bài test đều qua.
- Các phiên live khởi động trước khi thêm atlas cảnh nền trả 404 tại `/assets/landscape.webp`. Phiên live mới phục vụ các tệp WebP trong `chonoi/web/assets/`. Kiểm tra HTTP xác nhận hai atlas cảnh nền và cá sấu tải đúng MIME, đường dẫn thiếu hoặc ra ngoài thư mục trả 404.
- Chrome headless vẽ bầu trời, núi, ba mẫu nhà sàn và đủ sáu khung cá sấu. Kiểm tra chuyển hướng trái/phải khi tuần tra, hướng bơi khi truy đuổi, cảnh xuất phát ở bến và cảnh mở quán. Không có lỗi JavaScript. Bộ Python chạy qua 67 bài test.
