# AGENTS.md — hướng dẫn chung cho mọi agent AI của nhóm

> Cập nhật file này qua các phase (lịch sử git phải cho thấy điều đó). Ngắn gọn, có lệnh chạy thật.

## Lệnh
- Test: `PYTHONPATH=tests:. python3 -m unittest discover -s tests -v`
- Headless: `python3 -m chonoi.headless --mode day --seed 42 --days 5 --ticks 600 --out day.jsonl`.
- Chơi thử trên trình duyệt: `python3 -m chonoi.live --mode gather` (chọn **Bắt đầu hành trình**; WASD, E, Space, Esc/P).
- Xem UI Phase 2 độc lập: `python3 -m http.server 8000 --bind 127.0.0.1` (mở `/chonoi/web/?preview=2`; E, Space, Esc/P)
- Xem UI Phase 3: chạy cùng máy chủ tĩnh và mở `/chonoi/web/?preview=3` để kiểm kho cá thể, hàng ươn và giá chốt.
- Benchmark render: `python3 -m chonoi.bench --seed 42 --duration 30 --out bench.json` (cần Chrome hoặc Chromium).
- Soak: `python3 -m chonoi.soak --seed 7 --days 10 --out soak.json`.

## Cấu trúc & quy ước
- (Starter Python là TÙY CHỌN; nhóm có thể dùng ngôn ngữ khác nếu giữ Test Contract.) Khung do giảng viên cấp: `chonoi/{headless,inputs,scenario,contract,rng,ids,jsonl,inventory,runner,live}.py` và `chonoi/web/`. Hạn chế sửa; nếu phải sửa thì báo cả nhóm và ghi lại lý do.
- Luật mô phỏng: `chonoi/sim/gather.py`, `chonoi/sim/quan.py`. `chonoi/scenario.py` kiểm fixture trước khi tạo JSONL.
- **Số liệu chỉ đọc từ `game.contract.json` / dữ liệu**, không hard-code trong luật.
- Mọi số ngẫu nhiên đi qua `Streams` (`chonoi/rng.py`); không dùng `random` toàn cục, không dùng đồng hồ hệ thống.
- Sắp danh sách thực thể bằng `ids.sort_by_id`; cấp id bằng `IdAllocator`.

## Nên tránh
- Không sửa `docs/contracts/`, `game.contract.json` (khóa contract) hoặc schema kho khi chưa báo cả nhóm (đổi hợp đồng ảnh hưởng mọi module).
- Không làm hỏng nhánh chính: trước khi đẩy, chạy test.
- Không bịa yêu cầu: chỗ mơ hồ thì ghi `docs/clarify.md` và hỏi PO.
- Không sửa test cho xanh khi luật sai; phải sửa luật hoặc ghi lý do đổi test trong commit.

## Quy tắc làm việc với agent
- Phase 1 dùng [spec trong TEAM.md](TEAM.md#phase-1) để xác định module, phần phụ thuộc và tiêu chí bàn giao. Đối chiếu luật và payload theo mục D–G của PRD-0.
- Trước khi triển khai Sim, UI hoặc fixture, đọc [giao diện dùng chung](TEAM.md#giao-diện-dùng-chung) để dùng đúng API, tên trường và payload. Báo Integrator khi starter lệch mục B–G của Test Contract.
- Mỗi agent một việc rõ ràng (một lát). Cho agent đọc PRD/ticket đúng phase và hợp đồng kho trước.
- Agent làm xong phải chạy test và ghi kết quả vào mô tả commit hoặc `docs/proof/`; người đọc lại thay đổi trước khi đẩy.
- Sáng tạo thêm được khuyến khích nhưng phải tắt ở headless (xem README, mục "Tự do sáng tạo").

## Skills / hooks của nhóm
- `python3 tools/phase1.py verify` chạy kiểm danh sách thành viên và toàn bộ suite Phase 1 trước khi bàn giao.
- `python3 tools/phase1.py smoke` chạy riêng hai tiến trình Gather → kho → Quán khi sửa ranh giới tích hợp.
- Kết quả chạy của nhóm nằm trong [ma trận bàn giao Phase 1](docs/verification/phase-1.md).
- Khi kiểm Phase 2, đọc [ma trận nghiệm thu](docs/verification/phase-2.md) và chạy toàn suite trên commit tích hợp. Dùng `tools/phase1.py smoke` để kiểm riêng hai tiến trình bàn giao kho. Ghi kết quả preview và headless theo từng nguồn bằng chứng.
- Bàn giao Phase 4 dùng [ma trận Phase 4](docs/verification/phase-4.md). Lưu SHA, benchmark render và hai lần soak cùng seed. Khi so soak, bỏ `duration_s`.
