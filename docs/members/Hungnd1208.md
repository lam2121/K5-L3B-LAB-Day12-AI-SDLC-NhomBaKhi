# Nguyễn Duy Hưng · `Hungnd1208`

**Vai trò:** `client/ui` và Scrum/Release.

- **Tôi đã làm**
  - Phase 1 dựng menu, HUD, hai cảnh Canvas và màn bàn giao kho từ sông sang quán. [Commit 4df6a18](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/commit/4df6a18)
  - Phase 2 làm giao diện 5 ngày, màn tạm dừng, cửa hàng và tổng kết. [Commit 34db565](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/commit/34db565)
  - Phase 3 hiển thị độ tươi từng cá thể, hàng giữ chỗ và giá món đã chốt. [Commit 6928a4d](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/commit/6928a4d)
  - Phase 4 thêm benchmark render, ba cảnh báo có chữ và biểu tượng, tương phản cao và ảnh bìa demo. [Commit 78c6f67](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/commit/78c6f67) · [Commit 444470c](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/commit/444470c)
- **Tôi đã rà soát** Bàn giao kho với sim thật, luồng mẫu 5 ngày trên Chrome ở 1280×720 và hồi quy trên nhánh UI. Kết quả 54/57, ba lỗi headless trùng commit nền. [Bằng chứng](../proof/phase-4/ui-demo.md)
- **AI sai ở đâu** Benchmark ban đầu lấy nghịch đảo p99 thời gian khung hình. QA đối chiếu ticket, phát hiện yêu cầu lấy nghịch đảo thời gian trung bình của 1% khung chậm nhất. [Bằng chứng sửa](../proof/phase-4/gather-benchmark.md)
- **Điều tôi học được** Kiểm giao diện bằng snapshot mẫu và chạy lại với sim thật sau tích hợp. Mỗi số đo cần gắn với công thức và commit đã chạy.
