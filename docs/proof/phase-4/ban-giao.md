# Kiểm chứng tích hợp Phase 4

Ngày 2026-11-21. Kiểm từ hai clone sạch trên Windows PowerShell, Python 3.12.10 và Chrome headless. `main` tại `2a78c9f33ae6591b577831e3a7a18f07b86ca06c` gộp `a76673b065dceef4af3e6419beaa2537877caf52` qua PR #23. Hai SHA có cùng Git tree `e1b123cdadab45cc9bcbf071184f95383f7cd88f`. [PR #23](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/23)

## Lệnh trên clone sạch

```powershell
$env:PYTHONPATH = 'tests;.'
$env:PYTHONUTF8 = '1'
python3 -m unittest discover -s tests -v
python3 -m chonoi.bench --seed 42 --duration 30 --out bench.json
python3 -m chonoi.soak --seed 7 --days 10 --out soak.json
python3 -m chonoi.soak --seed 7 --days 10 --out soak-repeat.json
```

Manifest khai `contract_version: "1.3"`, `bench_cmd: "python3 -m chonoi.bench"` và `soak_cmd: "python3 -m chonoi.soak"`. Suite đạt **64/64** trên cả `a76673b` và `2a78c9f`. Lần chạy `main` mất 12,630 giây. Các ca hồi quy mua oxy, pause/resume, Cá Sấu, LIFO, kho cá thể, hàng ươn và chốt giá đều đạt.

## Benchmark

Cả hai lượt đo dùng seed 42, cảnh Gather ở bến, Chrome 1280 × 720, làm nóng 3 giây và cửa sổ đo 30 giây. Entrypoint xuất đủ `avg_fps`, `p1_low_fps`, `frames`, `measured_s` và `load_ms`. `p1_low_fps` lấy nghịch đảo trung bình thời lượng của 1% khung chậm nhất, lấy ít nhất một khung.

| **Commit và artifact** | **FPS trung bình** | **1% low FPS** | **Số khung** | **Đo (s)** | **Tải cảnh (ms)** |
|---|---:|---:|---:|---:|---:|
| `a76673b` · [JSON](bench-a76673b.json) | 26,43 | 3,49 | 792 | 29,969 | 1.499 |
| `2a78c9f` (`main`) · [JSON](bench-2a78c9f.json) | 34,65 | 5,77 | 1.037 | 29,927 | 3.558 |
| Mốc báo cáo | ≥ 60 | ≥ 30 | | | ≤ 10.000 |

Lệnh và cấu trúc artifact đạt. Trên máy đo, cả hai lượt đạt mốc tải cảnh và chưa đạt hai mốc FPS. [Baseline trên v1.2](bench-qa-af4ca65.json) lưu số đo của checkout trước.

## Soak

Seed 7 trả `days: 10`, `days_completed: 10`, `crashes: 0` và 10 kết quả có `day`, `earned`, `reputation`, `score`. Hai lần chạy trên `2a78c9f` có kết quả gameplay giống hệt sau khi bỏ `duration_s`. Lượt đầu mất 1,848 giây, lượt lặp mất 1,058 giây. [Lượt đầu](soak-2a78c9f.json), [lượt lặp](soak-repeat-2a78c9f.json)

## Tương phản cao

- Chrome 1280 × 720 trên clone `2a78c9f`. Bật **Tương phản cao**, khởi động Gather với Út Sen ở `[60,24]`, còn 400 tick oxy và đang trong vùng Cá Sấu. Cả `#oxygen-alert` và `#monster-alert` hiện chữ cảnh báo cùng phần tử biểu tượng `.warning-icon`.
- Kiểm riêng Quán với `C1` đang `waiting` ở `T1`, món cá lóc giữ `I1` và kiên nhẫn ban đầu 700 tick. Snapshot đo có 693 tick còn lại, dưới ngưỡng 900. `tables[].customer_id` vắng nên màn hình vẽ bàn trống. Chrome xác nhận 6 thẻ bếp/bàn và chưa có biểu tượng cảnh báo khách. Cảnh báo này từng đạt trên snapshot mẫu của QA. [Bằng chứng kiểm trên preview](ui-demo.md)

## Demo và phát hành

- Chrome kiểm luồng **Bắt đầu hành trình → Gather → Quán → Shop → Ngày 2** trên `a76673b`. Ca tối được rút ngắn bằng fixture cho lần kiểm. `/config` công bố v1.3 và `campaign_v12`; `/state` trả `mode: "day"`, `day: 2`, `days_completed: 1`, `error: null`.
- GitHub `main` tại `2a78c9f`. Khi kiểm, truy vấn refs chưa có `phase-4` hay `v1.0.0` và endpoint GitHub Release `v1.0.0` trả HTTP 404. Clone sạch chưa có `LICENSE`. [Release notes soạn sẵn](../../release/v1.0.0.md)
