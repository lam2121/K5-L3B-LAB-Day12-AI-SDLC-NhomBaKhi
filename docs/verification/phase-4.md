# Báo cáo nghiệm thu Phase 4

**Nhóm Ba Khi · Test Contract v1.3 · 21/11/2026.** Bản phát hành được chốt từ `main` sau khi bổ sung hồ sơ và bằng chứng còn thiếu. Phần game đã đo tại commit `1c065b47e28e916a2586f0ed7407c107652c84bb`; các thay đổi tiếp theo trong đợt bàn giao chỉ cập nhật tài liệu và artifact. Regression suite trên Windows/Python 3.12 đạt **69/69**, kiểm danh sách thành viên đạt **4/4**. Hai lượt soak seed 7 hoàn thành **10/10 ngày, 0 crash** và trùng kết quả gameplay.

## Kết quả Phase 4

| **AC** | **Yêu cầu** | **Kết quả** |
|---|---|---|
| AC-P4-01 | Manifest v1.3 khai benchmark và soak | **Đạt.** `game.contract.json` có `bench_cmd` và `soak_cmd`; tuning và schema kho đọc từ contract/dữ liệu. |
| AC-P4-02 | Benchmark Gather, seed 42, đo 30 giây | **Đạt lệnh, schema và tải cảnh.** Đo được 33.44 FPS trung bình, 3.38 FPS 1% low, 1,002 khung hình, 29.963 giây đo, 1,976 ms tải cảnh. Hai số FPS thấp hơn mốc tham khảo 60/30; báo trung thực theo máy Windows/Chrome đã đo. [Artifact](../proof/phase-4/bench.json) |
| AC-P4-03 | Soak 10 ngày, không crash và chạy lặp | **Đạt.** Cả hai lượt seed 7 ghi `days_completed: 10`, `crashes: 0`, có đủ 10 kết quả. Gameplay giống nhau khi bỏ `duration_s`. [Lượt 1](../proof/phase-4/soak.json) · [Lượt 2](../proof/phase-4/soak-repeat.json) |
| AC-P4-04 | Hồi quy Phase 1–3 và campaign | **Đạt 69/69.** Bao gồm bàn giao kho cá thể, độ tươi, pause/resume, Shop, khách tự đến và thanh toán ca tối, trang bị và bắn cá sấu. Lệnh headless ngày 5 ngày chạy xong; cơ chế súng chỉ bật ở live. |
| AC-P4-05 | Ba cảnh báo đọc được ở tương phản cao | **Đạt 3/3.** Đã kiểm chữ và biểu tượng cho cảnh báo oxy thấp, cá sấu và khách sắp bỏ đi trên Chrome. [Kiểm chứng cảnh báo](../proof/phase-4/ui-demo.md) |
| AC-P4-06 | Clone sạch, hướng dẫn ngắn và build tái lập | **Đạt.** README cho phép clone, vào thư mục và chạy live trong ba lệnh. Suite chạy trên Windows; CI dùng Ubuntu/Python 3.12. Không ghi nhận kết quả thử trên macOS. [README](../../README.md#bắt-đầu-nhanh) |
| AC-P4-07 | Tag Phase 4 và Release v1.0.0 cùng commit trên main | **Đạt.** Commit bàn giao trên `main` được gắn `phase-4` và Release `v1.0.0` cùng SHA; GitHub Release đính kèm ZIP nguồn có README, contract, mã game, assets và LICENSE. Ba tag Phase 1–3 giữ nguyên. [GitHub Release](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/releases/tag/v1.0.0) |
| AC-P4-08 | Demo một ngày bằng mô phỏng thật | **Đạt.** Chrome đi qua Chuẩn bị → Gather → Quán → Shop → Ngày 2; `/state` ghi `days_completed: 1`, `error: null`. [Kiểm chứng demo](../proof/phase-4/ui-demo.md) |
| AC-P4-09 | Hồ sơ nhóm, cá nhân và phản tư | **Đạt.** Có đủ bốn hồ sơ cá nhân, mỗi hồ sơ dưới 200 từ; đủ TEAM, AGENTS, clarify, AI usage log, retro, changelog, credits và license. `tools/check_team.py` nhận đủ bốn handle. |

## Thay đổi đã bàn giao

- **Ca tối.** Sửa liên kết khách với bàn trong snapshot live và dọn món của đơn đã rời. Chrome kiểm luồng khách đến → nấu → bưng → phục vụ → thanh toán; mẫu thu 70k, gồm 59k tiền món và 11k tiền boa. [Bằng chứng](../proof/phase-4/quan-live-fix.md)
- **Đồ họa.** Tích hợp atlas WebP cho nhân vật và vật thể, nhà sàn, trời, núi, cá, cá sấu, dụng cụ và vật dụng quán. Nhân vật đi/bơi, cá quẫy và cá sấu có khung tuần tra/truy đuổi. [Bằng chứng và prompt](../proof/phase-4/sprites-2d.md) · [Assets](../../chonoi/web/assets/README.md)
- **Trang bị lặn.** Trước mỗi buổi sáng của Hành trình, mua súng, đạn bong bóng, bình oxy hoặc áo phao. Bấm **F** hoặc **Bắn** để hạ cá sấu gần nhất trong tầm 12 m; tiền thưởng và doanh thu chuyển qua ngày. Mô phỏng headless không bật tính năng sáng tạo này. [Bằng chứng](../proof/phase-4/trang-bi-lan.md) · [Dữ liệu cân bằng](../../chonoi/data/dive_gear.json)

## Tái lập kết quả

Windows, Python 3.12.10; benchmark dùng Chrome headless ở 1280 × 720, seed 42, làm nóng 3 giây và đo 30 giây. Soak dùng seed 7. Các JSON soak khớp sau khi loại trường thời lượng. Test suite yêu cầu quyền loopback cục bộ để mở HTTP server trong các test live.

```powershell
$env:PYTHONPATH = 'tests;.'
$env:PYTHONUTF8 = '1'
python -m unittest discover -s tests -v
python tools/check_team.py
python tools/phase1.py smoke
python -m chonoi.headless --mode day --seed 42 --days 5 --ticks 600 --out day.jsonl
python -m chonoi.bench --seed 42 --duration 30 --out bench.json
python -m chonoi.soak --seed 7 --days 10 --out soak.json
python -m chonoi.soak --seed 7 --days 10 --out soak-repeat.json
```

Các thay đổi tài liệu và artifact trong commit bàn giao không sửa luật game, contract hay test. Phần lịch sử và tag Phase 1–3 được giữ nguyên.
