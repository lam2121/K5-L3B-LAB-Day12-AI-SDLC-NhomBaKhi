# Kiểm chứng sửa lỗi ca tối

Kiểm luồng live trên mã game tại `1c065b47e28e916a2586f0ed7407c107652c84bb`, Windows và Chrome headless.

- Sửa lỗi dừng ca khi khách đến lúc có đơn đang chờ nguyên liệu: dùng stream `customer` qua `Streams.get("customer")` và cấp ID bằng `IdAllocator`.
- Snapshot live gắn đúng `tables[].customer_id` để UI tìm khách, hiển thị kiên nhẫn và cảnh báo. Khi khách rời, dọn món trên bếp hoặc trên tay thuộc đơn đó.
- Chrome kiểm khách tự đến → B1 nấu xong → bưng món → phục vụ T1 → thanh toán. Ca kiểm ghi 70k gồm 59k giá món và 11k boa; T1 được giải phóng sau thanh toán. Đã chạy cả ca tối độc lập và Hành trình Gather → Quán.
- Ba cảnh báo có chữ và biểu tượng khi bật tương phản cao. Không có lỗi JavaScript trong hai luồng.
- Regression suite đạt **69/69**, bao gồm khách tự đến và dọn món khi khách rời đúng tick đóng ca.

Chi tiết luồng demo nằm trong [UI demo](ui-demo.md); kết quả toàn suite nằm trong [ma trận Phase 4](../../verification/phase-4.md).
