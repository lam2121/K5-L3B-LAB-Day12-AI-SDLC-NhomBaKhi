# Bằng chứng bàn giao Phase 4

Ngày 21/11/2026 · Windows · Python 3.12.10 · Chrome. Mã game được kiểm tại `1c065b47e28e916a2586f0ed7407c107652c84bb`; commit phát hành chỉ thêm tài liệu và artifact. Các lệnh kiểm lại và kết quả cuối được tổng hợp trong [ma trận nghiệm thu](../../verification/phase-4.md).

## Clone sạch và hồi quy

```powershell
$env:PYTHONPATH = 'tests;.'
$env:PYTHONUTF8 = '1'
python -m unittest discover -s tests -v
python tools/check_team.py
python tools/phase1.py smoke
python -m chonoi.headless --mode day --seed 42 --days 5 --ticks 600 --out day.jsonl
```

Kết quả: **69/69 test đạt**, danh sách thành viên **4/4**, smoke bàn giao kho **1/1**, mô phỏng headless đủ 5 ngày chạy thành công. Test live mở HTTP loopback; trên máy sandbox cần cho phép kết nối cục bộ để chạy phần này.

## Benchmark và soak

Benchmark Gather seed 42 đo 30 giây, Chrome headless 1280 × 720, làm nóng 3 giây. Artifact có đủ năm trường theo schema: `avg_fps`, `p1_low_fps`, `frames`, `measured_s`, `load_ms`. Kết quả lần lượt là **33.44**, **3.38**, **1,002**, **29.963**, **1,976 ms**. Tải cảnh đạt mốc 10 giây; hai FPS thấp hơn mốc báo cáo 60/30.

Hai lượt soak seed 7 đều có `days_completed: 10`, `crashes: 0` và 10 kết quả ngày. Dữ liệu gameplay hai file giống nhau sau khi bỏ `duration_s`.

## Demo và phát hành

- Chrome kiểm Bắt đầu hành trình → Chuẩn bị → Gather → Quán → Shop → Ngày 2 bằng mô phỏng thật. `/config` công bố contract v1.3; `/state` sau khi đóng ngày đầu ghi `days_completed: 1`, `error: null`.
- Kiểm chữ và biểu tượng cho cảnh báo oxy, cá sấu và khách sắp bỏ đi ở chế độ tương phản cao. Kiểm riêng luồng ca tối và mua/bắn cá sấu trước khi lặn.
- Release `v1.0.0` và tag `phase-4` gắn cùng commit trên `main`; ZIP nguồn đi kèm chứa mã game, assets, contract, README, CREDITS và LICENSE.
- Phase 1, 2 và 3 giữ nguyên tag và hồ sơ nghiệm thu của từng phase.

Chi tiết kiểm giao diện ở [UI demo](ui-demo.md), [ca tối](quan-live-fix.md), [sprite](sprites-2d.md) và [trang bị lặn](trang-bi-lan.md).
