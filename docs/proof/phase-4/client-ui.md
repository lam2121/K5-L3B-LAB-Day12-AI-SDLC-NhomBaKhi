# Bằng chứng UI và TICKET-04

Kiểm trên Windows, Python 3.12.10 và Chrome. Chrome kiểm menu, Canvas ở 1280 × 720, menu hẹp 390 px, trạng thái tương phản cao và cảnh báo oxy/cá sấu/khách. Cảnh live được kiểm cùng mô phỏng; bản xem fixture được tách riêng trong README.

## Phương pháp benchmark render

```powershell
python -m chonoi.bench --seed 42 --duration 30 --out docs/proof/phase-4/bench.json
```

Entrypoint chạy sim Gather và Chromium ở 1280 × 720 trên loopback. `load_ms` tính đến tín hiệu khung đầu tiên. Sau 3 giây làm nóng, lấy các khoảng giữa khung hình trong cửa sổ đo. `avg_fps = frames / sum(dt)`. `p1_low_fps` là nghịch đảo thời gian trung bình của `max(1, ceil(0.01 × frames))` khung chậm nhất. JSON có đủ năm trường theo contract v1.3.

| Seed | FPS trung bình | 1% low FPS | Khung đo | Thời gian đo | Tải cảnh |
|---|---:|---:|---:|---:|---:|
| 42 | 33.44 | 3.38 | 1,002 | 29.963 s | 1,976 ms |

Tải cảnh thấp hơn mốc tham khảo 10 giây. Hai chỉ số FPS thấp hơn mốc 60/30 trên máy đo này; xem [artifact JSON](bench.json) và [báo cáo nghiệm thu](../../verification/phase-4.md).
