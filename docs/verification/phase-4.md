# Báo cáo nghiệm thu Phase 4

**Nhóm Ba Khi · Test Contract v1.3 · 21/11/2026.** Bản làm việc trên `lam` tại `150ff4c`, gồm các bản sửa cục bộ, đạt **69/69 bài kiểm thử**. Hai lượt soak đều hoàn thành **10/10 ngày, 0 lỗi** và cho cùng kết quả gameplay. Benchmark đạt định dạng và mốc thời gian tải. Hai chỉ số FPS còn dưới mốc báo cáo.

`origin/main` vẫn ở `2a78c9f` (PR #23). Kết quả clone sạch của commit đó là **64/64 bài kiểm thử**. Các sửa đổi và kết quả mới dưới đây thuộc bản làm việc, đang chờ vào commit bàn giao. [Bằng chứng clone sạch](../proof/phase-4/ban-giao.md)

## Thay đổi sau bản tích hợp

- **Ca tối.** Sửa lỗi tạo khách làm ca Quán dừng khi kho có nguyên liệu. Snapshot nối khách đúng bàn bằng `customer_id`. Khi khách rời, món trên bếp hoặc trên tay của đơn đó được dọn. Chrome đã kiểm luồng khách tự đến → nấu → bưng → phục vụ → thanh toán trong cả ca tối riêng và Hành trình. Lượt kiểm thu 70k, gồm 59k tiền món và 11k tiền boa. [Kiểm chứng ca tối](../proof/phase-4/quan-live-fix.md)
- **Cảnh sông và quán.** Tích hợp sprite WebP cho nhân vật, cá, dụng cụ, nhà sàn, trời, núi và vật dụng quán. Út Sen nổi đến vai giữa sông, đứng ở bến, có khung đi và bơi. Cá quẫy đuôi, cá sấu có sáu khung cho tuần tra và truy đuổi. Máy chủ live phục vụ atlas từ `chonoi/web/assets/`. Chrome xác nhận cảnh nền và các khung chuyển động. [Kiểm chứng đồ họa](../proof/phase-4/sprites-2d.md), [tệp ảnh và prompt](../../chonoi/web/assets/README.md)
- **Trang bị trước khi lặn.** Hành trình trên trình duyệt mở quầy mua súng lặn, đạn bong bóng, bình oxy và áo phao trước mỗi buổi sáng. Ví khởi đầu 180k. Súng giá 150k kèm hai viên. Dưới nước, **F** hoặc **Bắn** hạ cá sấu gần nhất trong tầm 12 m và cộng 30k. Tiền bán món, tiền thưởng và đạn còn lại chuyển sang ngày sau. Cơ chế này chỉ bật trong Hành trình live. [Kiểm chứng trang bị](../proof/phase-4/trang-bi-lan.md), [dữ liệu cân bằng](../../chonoi/data/dive_gear.json)

## Ma trận truy vết

| **AC** | **Yêu cầu** | **Kết quả và bằng chứng** |
|---|---|---|
| AC-P4-01 | Manifest v1.3 khai `bench_cmd` và `soak_cmd` | **Đạt.** Hai lệnh chạy được. Tuning, kho cá thể và JSONL giữ theo v1.2. [Manifest](../../game.contract.json) |
| AC-P4-02 | Benchmark Gather, seed 42, cửa sổ đo 30 giây | **Đạt lệnh, schema và mốc tải.** Bản làm việc đạt 43,64 FPS trung bình và 11,68 FPS 1% low, dưới hai mốc 60 và 30 FPS. Tải 2.583 ms, dưới mốc 10 giây. [JSON trên `2a78c9f`](../proof/phase-4/bench-2a78c9f.json) |
| AC-P4-03 | Soak 10 ngày, không crash và chạy lặp | **Đạt.** Hai lượt seed 7 hoàn tất đủ 10 ngày và có 10 kết quả ngày. Hai JSON khớp khi bỏ `duration_s`. [Lượt đầu trên `main`](../proof/phase-4/soak-2a78c9f.json), [lượt lặp trên `main`](../proof/phase-4/soak-repeat-2a78c9f.json) |
| AC-P4-04 | Hồi quy P1–P3 | **Đạt 69/69 trên bản làm việc**, gồm kho cá thể, giá theo độ tươi, khách đến và thanh toán, nút bắn và tiền qua ngày. Lượt headless 600 tick không chứa trường trang bị hay sự kiện hạ cá sấu của live. [Kiểm chứng ca tối](../proof/phase-4/quan-live-fix.md), [kiểm chứng trang bị](../proof/phase-4/trang-bi-lan.md) |
| AC-P4-05 | Ba cảnh báo ở tương phản cao | **Đạt 3/3 trên bản làm việc.** Chrome bật tương phản cao và kiểm cả chữ lẫn biểu tượng cho oxy thấp, thủy quái và khách sắp bỏ đi. Ca tối dùng khách `C1` tại `T1` với 700 tick kiên nhẫn ban đầu. [Kiểm chứng ca tối đã sửa](../proof/phase-4/quan-live-fix.md) |
| AC-P4-06 | Chạy từ clone sạch trong tối đa ba lệnh | **Đã thử trên Windows** ở `2a78c9f`. README có môi trường, cách chạy, điều khiển, test, headless và benchmark. Chưa có lượt kiểm trực tiếp trên macOS hoặc Linux cho bản bàn giao này. [README](../../README.md#bắt-đầu-nhanh) |
| AC-P4-07 | Phát hành từ cùng commit trên `main` | **Chưa hoàn thành.** GitHub chưa có tag `phase-4` hoặc `v1.0.0`. Trang Release `v1.0.0` trả 404. Chưa thấy gói chạy đính kèm. Release notes đang ở nhánh `lam` và cần cập nhật trước khi phát hành. [Release notes nháp](../release/v1.0.0.md), [GitHub Releases](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/releases) |
| AC-P4-08 | Demo một ngày bằng mô phỏng thật | **Đạt smoke live trên bản làm việc.** Chrome đi qua Chuẩn bị → Gather → Quán → Shop → Ngày 2 với fixture rút ngắn buổi sáng và ca tối. `/state` ghi `days_completed: 1` và `error: null`. [Demo trên commit tích hợp](../proof/phase-4/ban-giao.md#demo-và-phát-hành), [demo trang bị](../proof/phase-4/trang-bi-lan.md) |
| AC-P4-09 | Hồ sơ nhóm và phản tư cá nhân | **Đủ tên tệp.** Kiểm danh sách thành viên đạt 4/4. Retro có rà hành động Phase 2 và ví dụ lỗi AI. Nhật ký và một số phản tư cần cập nhật nội dung theo mục rà hồ sơ bên dưới. [Clarify](../clarify.md), [nhật ký AI](../ai-usage-log.md), [retro](../retro.md#phase-4) |

### Số đo trên bản làm việc

Windows, Python 3.12.10 và Chrome headless. Benchmark đo cảnh Gather ở bến với seed 42, khung 1280 × 720, làm nóng 3 giây. Số đo một lượt được ghi lại trong báo cáo. Hai artifact baseline đã lưu trong repo. Artifact của commit phát hành sẽ cần chạy và lưu theo SHA bàn giao.

```json
{"avg_fps":43.64,"p1_low_fps":11.68,"frames":1308,"measured_s":29.974,"load_ms":2583}
```

Hai lượt soak lần lượt mất 2,920 và 1,501 giây. Suite chạy trong 14,605 giây. Các lệnh tái lập trên PowerShell:

```powershell
$env:PYTHONPATH = 'tests;.'
$env:PYTHONUTF8 = '1'
python3 -m unittest discover -s tests -v
python3 tools/check_team.py
python3 -m chonoi.bench --seed 42 --duration 30 --out bench.json
python3 -m chonoi.soak --seed 7 --days 10 --out soak.json
python3 -m chonoi.soak --seed 7 --days 10 --out soak-repeat.json
```

## Rà hồ sơ bàn giao

**Hồ sơ nhóm.** Có `TEAM.md`, `AGENTS.md`, báo cáo nghiệm thu, `docs/clarify.md`, `docs/ai-usage-log.md`, `docs/retro.md`, `CHANGELOG.md` và `CREDITS.md`. `LICENSE` có trong bản làm việc và chưa được Git theo dõi. `docs/release/v1.0.0.md` có trên `lam` nhưng chưa có trên `origin/main`. Release notes và changelog Phase 4 cần phản ánh bản sửa ca tối, đồ họa và trang bị. Mục P4-04 ở Clarify còn mô tả lỗi trước khi sửa. Nhật ký AI Phase 4 có mục tích hợp và demo UI, phần sửa ca tối, sprite và trang bị đã có bằng chứng riêng nhưng chưa ghi vào nhật ký chung. [Hồ sơ nhóm](../../TEAM.md), [changelog](../../CHANGELOG.md), [ghi chép làm rõ](../clarify.md)

**Hồ sơ cá nhân.** Đối chiếu bốn handle trong `TEAM.md` với `docs/members/`. Cả bốn file đã có trên `origin/main`. Số từ ước tính theo phần thân hiển thị, bỏ tiêu đề chính, ký hiệu Markdown và URL trong liên kết.

| **Thành viên** | **Phản tư cá nhân** | **Bằng chứng Phase 4** |
|---|---|---|
| Nguyễn Trung Dũng (`bomgoa1102`) | [File cá nhân](../members/bomgoa1102.md), khoảng 158 từ. Có phần Gather, lỗi AI và bài học. Cần bổ sung dẫn chứng Phase 4 và ghi rõ đã hỗ trợ ai. | Gather, độ tươi và công thức 1% low. [PR #20](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/20), [kiểm chứng](../proof/phase-4/gather-benchmark.md) |
| Nguyễn Văn Lâm (`lam2121`) | [File cá nhân](../members/lam2121.md), khoảng 141 từ ở `lam`. Có phần việc P4, phần hỗ trợ, lỗi AI và bài học. Bản có nội dung P4 chưa lên `origin/main`. | Tích hợp Gather → Quán → Shop, manifest v1.3, soak và nghiệm thu. [PR #23](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/23) |
| Nguyễn Duy Hưng (`Hungnd1208`) | [File cá nhân](../members/Hungnd1208.md), khoảng 84 từ. Còn là bản nháp Phase 1 và còn chỗ chờ tự phản tư. Cần nội dung và dẫn chứng P4. | Benchmark render, tương phản cao và demo. [PR #22](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/22), [kiểm chứng](../proof/phase-4/ui-demo.md) |
| Đặng Nguyễn Nhật Minh (`MN-HD`) | [File cá nhân](../members/MN-HD.md), khoảng 228 từ. Còn hai phần trùng chủ đề QA Phase 1. Cần rút xuống ≤ 200 từ và thêm đóng góp P4. | Ma trận, kiểm cảnh báo trên preview và đo lại baseline v1.2. [PR #21](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/21), [JSON benchmark](../proof/phase-4/bench-qa-af4ca65.json) |

Để chốt Phase 4, nhóm cần đưa bản sửa và hồ sơ cập nhật lên `main`, chạy lại từ clone sạch của SHA bàn giao, lưu artifact tương ứng, rồi công bố `phase-4` và Release `v1.0.0` kèm gói chạy từ cùng SHA.
