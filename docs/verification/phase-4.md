# Báo cáo nghiệm thu Phase 4

**Nhóm Ba Khi · Test Contract v1.3 · 2026-11-21.** Kiểm trên clone sạch của `main` tại `2a78c9f`, commit gộp demo `a76673b` qua PR #23. **64/64 test đạt** và **soak 10/10 ngày, 0 lỗi**. Lệnh benchmark tạo đúng artifact, cả hai mốc FPS còn dưới mục tiêu trên máy đo. [Bằng chứng tích hợp](../proof/phase-4/ban-giao.md)

## Ma trận truy vết

| **AC** | **Yêu cầu** | **Bằng chứng kiểm tra** | **Kết quả** |
|---|---|---|---|
| AC-P4-01 | Manifest v1.3 khai `bench_cmd` và `soak_cmd` | Kiểm khóa ở gốc, chạy hai entry point và suite kho cá thể. [Manifest](../../game.contract.json), [kiểm chứng](../proof/phase-4/ban-giao.md) | Đạt |
| AC-P4-02 | Benchmark cảnh Gather, seed 42 và 30 giây | Artifact trên `main` có đủ 5 trường. Trung bình 34,65 FPS, 1% low 5,77 FPS, tải 3.558 ms. [JSON](../proof/phase-4/bench-2a78c9f.json), [cả hai lượt đo](../proof/phase-4/ban-giao.md#benchmark) | Đạt lệnh và schema. Đạt mốc tải, chưa đạt mốc 60 FPS và 30 FPS. |
| AC-P4-03 | Soak 10 ngày, không crash và lặp lại | Seed 7 hoàn tất 10 ngày. Kết quả theo ngày giống nhau sau khi bỏ `duration_s`. [Lượt đầu](../proof/phase-4/soak-2a78c9f.json), [lượt lặp](../proof/phase-4/soak-repeat-2a78c9f.json) | Đạt |
| AC-P4-04 | Hồi quy P1–P3 | 64/64 test trên clone `main`. Kiểm pause, mua và kích hoạt oxy ngày kế, Cá Sấu, độ tươi, kho cá thể và giá món. [Lệnh và kết quả](../proof/phase-4/ban-giao.md#lệnh-trên-clone-sạch) | Đạt |
| AC-P4-05 | Ba cảnh báo có chữ và biểu tượng ở tương phản cao | Chrome trên clone `main` kiểm oxy và thủy quái. Kiểm riêng HUD ca tối với fixture khách chờ ở T1. [Bằng chứng](../proof/phase-4/ban-giao.md#tương-phản-cao) | Đạt 2/3 trên live. Cảnh báo khách vắng do snapshot `tables[]` thiếu `customer_id`. |
| AC-P4-06 | Clone sạch chạy UI trong tối đa 3 lệnh | Clone đúng `main`, chạy entry point và mở UI trên Windows. [Lệnh README](../../README.md#bắt-đầu-nhanh) | Đạt trên Windows. macOS/Linux chưa có lượt đo trực tiếp. |
| AC-P4-07 | Tag `phase-4` và Release `v1.0.0` cùng SHA trên `main`, có gói chạy | Đã soạn release notes, rà CREDITS và kiểm refs trên GitHub. `LICENSE` có ở máy làm việc, chưa có trong clone. [Release notes](../release/v1.0.0.md), [trạng thái](../proof/phase-4/ban-giao.md#demo-và-phát-hành) | Chưa hoàn thành phát hành |
| AC-P4-08 | Demo trọn một ngày trên mô phỏng thật | Chrome kiểm Gather → Quán → Shop → Ngày 2, dùng fixture rút ngắn ca để kiểm. [Bằng chứng](../proof/phase-4/ban-giao.md#demo-và-phát-hành) | Đạt smoke live |
| AC-P4-09 | Ghi chép và retro cuối buổi | Cập nhật quyết định kỹ thuật, log AI, rà hành động Phase 2 và phản tư của Integrator. [Clarify](../clarify.md), [nhật ký AI](../ai-usage-log.md), [retro](../retro.md#phase-4), [lam2121](../members/lam2121.md) | Báo cáo tích hợp đã cập nhật. Các thành viên tự xác nhận phần phản tư của mình. |

## Đóng góp chính

| **Thành viên** | **Bằng chứng Phase 4** |
|---|---|
| Nguyễn Trung Dũng (`bomgoa1102`) | Gather, cấu hình độ tươi và công thức 1% low. [PR #20](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/20), [bằng chứng](../proof/phase-4/gather-benchmark.md) |
| Nguyễn Văn Lâm (`lam2121`) | Tích hợp campaign live/headless, manifest v1.3 và soak, xác minh bản `main`. [PR #23](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/23) |
| Nguyễn Duy Hưng (`Hungnd1208`) | Benchmark render, tương phản cao và hoàn thiện giao diện demo. [PR #22](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/22), [bằng chứng](../proof/phase-4/ui-demo.md) |
| Đặng Nguyễn Nhật Minh (`MN-HD`) | Ma trận baseline, kiểm cảnh báo trên preview và đo lại benchmark trên v1.2. [PR #21](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/21), [benchmark QA](../proof/phase-4/bench-qa-af4ca65.json) |

Nhóm bốn người ưu tiên các tiêu chí lõi. Các số đo ở trên gắn với bản đang kiểm. Khi gắn tag, đối chiếu SHA của tag với `main` và cập nhật trạng thái phát hành cùng tên gói đính kèm.
