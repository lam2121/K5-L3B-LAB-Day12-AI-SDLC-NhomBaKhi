# Retro nhóm

## Phase 1

- **Điều tốt.** Kho mẫu và snapshot mẫu giúp Quán, UI và QA làm song song. Cả bốn module đã vào `main` qua bốn PR. Smoke seed 42 xác nhận hai tiến trình dùng chung đúng kho.
- **Điểm phát hiện muộn.** Suite tích hợp ban đầu xanh dù fixture rút ngắn ca làm khách đến sớm và món có thể kẹt sau khi khách rời. Một ca kiểm `TEAM.md` mẫu cũng phụ thuộc file đang chạy và lộ ra khi điền đủ handle.
- **Hành động cho Phase 2.** Khi thay đổi luật theo tick, thêm fixture cho đúng bước kết thúc và bước liền trước. Chạy `tools/phase1.py verify` trên bản tích hợp trước khi gắn tag.

## Phase 2

- **Điều tốt.** Gather và Quán chạy được trên preset tích hợp. Smoke bàn giao kho và hồi quy Phase 1 vẫn đạt. Preview cho phép UI kiểm luồng D1–D5 trong lúc chờ runner thật.
- **Điểm phát hiện khi gộp.** Manifest đã lên v1.1, còn CLI, parser input và validator giỏ vẫn có phần dùng quy ước v1.0. Chạy suite trên `main` phát hiện ba sai lệch ở `day`/Shop, pause và `keo_neo`. [Bằng chứng](proof/phase-2/integration.md#các-ca-chưa-đạt)
- **Hành động cho Phase 3.** Thêm smoke xuyên CLI → runner → live trên cùng commit khi đổi contract. Lượt kiểm đầu tiên chạy đúng ba ca đỏ Phase 2, rồi kiểm campaign qua `/config` và `/state`.

## Phase 4

- **Rà hành động Phase 2.** Đã chạy lại ca biên headless cho pause, Shop và Cá Sấu, rồi kiểm `/config`, `/state` và chuyển Gather → Quán → Shop bằng Chrome. Campaign live hoàn thành ở Phase 4, sau khi Phase 3 tích hợp xong kho cá thể. [Báo cáo Phase 2](verification/phase-2.md), [PR tích hợp #23](https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi/pull/23)
- **Điều làm tốt.** Fixture kho, QA theo tick và adapter preview giúp từng module kiểm sớm. Bản tích hợp chạy được Gather, ca tối, Shop và demo campaign. Rà lại tag, hồ sơ thành viên, license và artifact trước khi phát hành giúp phát hiện báo cáo Phase 4 còn trỏ vào commit cũ.
- **Điều cần sửa.** Việc đọc schema giữa sim, runner và UI được xác nhận muộn. Kết quả benchmark thay đổi giữa các checkout và môi trường chạy. Gắn mỗi phép đo với SHA, cấu hình và phương pháp; báo rõ FPS thấp hơn mốc thay vì chỉ nói lệnh chạy thành công. [Ma trận Phase 4](verification/phase-4.md)
- **Số liệu.** Hồi quy hiện đạt 69/69, kiểm danh sách đạt 4/4, soak seed 7 đạt 10/10 ngày không crash ở cả hai lượt. Benchmark seed 42 ghi 33.44 FPS trung bình, 3.38 FPS 1% low và tải cảnh 1,976 ms trên Windows/Chrome. [Artifact](proof/phase-4/)
- **Một lỗi AI.** Bản campaign đầu đọc `QuanSim.shift_earned`, trường đã đổi ở Quán v1.2. Test mua oxy báo `AttributeError`; đối chiếu `earned` trước/sau ca, rồi sửa và chạy lại regression cùng demo Chrome.
- **Một lỗi AI.** Bản campaign đầu đọc `QuanSim.shift_earned` từ schema cũ. Test mua oxy ở Shop báo `AttributeError`. Đối chiếu mô phỏng Quán v1.2, theo dõi chênh lệch của `earned` từ lúc mở ca, rồi chạy lại test và demo Chrome.
- **Hành động bàn giao.** Đã lưu suite, soak và benchmark trong `docs/proof/phase-4/`, cập nhật release notes và đóng P4-04 trong Clarify. Tag `phase-4`, Release `v1.0.0` và ZIP nguồn dùng cùng commit trên `main`; GitHub Actions kiểm tra Linux.
