# Kiểm tra giao diện demo Mùa Nước Nổi

Kiểm trên Chrome ở Windows, trong live game chạy từ mô phỏng thật. Hành trình có thể đi qua **Chuẩn bị → Gather → Quán → Shop → Ngày 2**. Sau khi đóng ngày đầu, `/state` ghi `days_completed: 1`, `error: null`; `/config` công bố contract v1.3.

## Kiểm tra màn hình

- Ở 1280 × 720, kiểm menu, HUD, bản đồ sông, ca tối, quầy Shop và tổng kết. Nhãn điều khiển, trạng thái kho, tiền và cảnh báo hiển thị trong game.
- Ở khung 390 px, menu vẫn có nút bắt đầu và ba lựa chọn chế độ chơi.
- Bật **Tương phản cao** và kiểm chữ cùng biểu tượng cho oxy thấp, cá sấu và khách sắp bỏ đi.
- Kiểm sprites đi/bơi và cá, cá sấu có hoạt ảnh; sprite nhân vật đứng trên bến/mặt nước đúng chân đế.
- Kiểm mua súng và đạn trước khi lặn, bắn bằng **F** hoặc **Bắn**, nhận tiền thưởng khi hạ cá sấu và giữ tiền qua Shop ngày tiếp theo.

## Hồi quy

Regression suite hiện đạt **69/69**. Kiểm checker đạt **4/4** thành viên; headless day mode chạy đủ năm ngày; hai lượt soak seed 7 đạt 10/10 ngày, 0 crash và cùng kết quả gameplay. Benchmark và số đo thuộc [bằng chứng riêng](gather-benchmark.md).

Ảnh bìa được tạo bằng ImageGen và lưu tại [river-cover.webp](../../../chonoi/web/river-cover.webp). Atlas, prompt và thông tin import có trong [assets README](../../../chonoi/web/assets/README.md); nguồn bên ngoài và giấy phép được liệt kê ở [CREDITS](../../../CREDITS.md).
