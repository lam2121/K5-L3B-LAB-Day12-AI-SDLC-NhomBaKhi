# Changelog
## Unreleased

### Phase 4

- Khai Test Contract v1.3 với `bench_cmd` và `soak_cmd`. Giữ kho cá thể và cơ chế độ tươi từ v1.2.
- Nối Gather, Quán và Shop trong campaign thật trên live và headless. Giữ tiến độ xuyên ngày, hỗ trợ pause và áp dụng nâng cấp từ sáng kế tiếp.
- Thêm tương phản cao, cảnh báo có chữ và biểu tượng cho oxy, thủy quái và khách sắp bỏ đi. Hoàn thiện menu và cảnh demo *Mùa Nước Nổi*.
- Thêm phép đo render 30 giây và soak 10 ngày có thể lặp lại. [Bằng chứng Phase 4](docs/verification/phase-4.md)

### Phase 3

- **Breaking change (Test Contract v1.2):**
  - [THAY THẾ] Thay thế kho đếm theo loại bằng kho cá thể `{"items": [{"id": "I1", "kind": "ca_linh", "fresh": 100.0}, ...]}`. Kho rỗng là `{"items": []}`.
  - Contract v1.2 trả mã 2 cho file kho đếm theo đúng tiêu chí DoD.
  - [THAY THẾ] Giữ chỗ nguyên liệu theo ID cá thể tươi nhất thay vì giữ theo số lượng.
  - [THAY THẾ] Giá món chốt theo độ tươi lúc `cook_started`: `base_price = floor(giá niêm yết * avg_fresh / 100)`. Mảng `items` trong `cook_started` sắp theo `kind` rồi `id`.
- Thêm cơ chế hao tươi 0.25/s ở kho quán (`quan_decay_per_s`), phát event `spoiled` khi `fresh < 30` theo ID.
- Tự động nhả và tái giữ chỗ 1 lần khi nguyên liệu trong đơn bị ươn; nếu thiếu hàng chuyển `unfulfillable`.
- Tính boa `floor(base_price * 0.2)` trên giá đã chốt theo độ tươi khi giao món với kiên nhẫn $\ge 50\%$.
- Ca test P1 `test_inv_01_gather_writes_inventory_quan_reads_it` kiểm tra schema kho đếm cũ v1.0 nên được thay thế bởi bộ kiểm thử v1.2 trong `test_quan.py` và `test_qa_phase3.py`.

### Phase 2

- Cập nhật Test Contract v1.1: 2 bếp (`B1`, `B2`), 4 bàn (`T1`–`T4`), 6 món thực đơn, 2 nguyên liệu mới (`ca_keo`, `keo_neo`), kế hoạch ngày 5 ngày `day_plan`, và nâng cấp cửa hàng `shop` (`oxygen`, `hp`).
- Xếp khách vào ghế trống có ID nhỏ nhất.
- Lọc món theo `day_plan` trong chế độ `day`.
- Bếp idle ưu tiên đơn `reserved` cũ nhất theo `(order_tick, table_id, id)`.
- Tiền boa tính theo `floor(giá * 0.2)` khi kiên nhẫn $\ge 50\%$; thu boa dương tăng $0.2$ uy tín.
- Đóng ca: khách đang ăn thanh toán ngay, khách chờ rời không phạt, dọn bếp và tay.

### Phase 1

- Thêm Gather với oxy, ngạt/ngất, hái rau, bắt cá và ghi file kho khi kết thúc.
- Thêm Quán với khách giữ nguyên liệu, nấu, bưng, phục vụ, thanh toán và tổng kết ca.
- Thêm menu, HUD Canvas và luồng Chơi trọn ngày qua live adapter.
- Bổ sung kiểm tra headless cho bàn giao kho, lịch khách, xử lý khách lúc đóng ca và fixture mâu thuẫn.
