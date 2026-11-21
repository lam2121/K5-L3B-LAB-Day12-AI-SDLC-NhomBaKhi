# Day 12 — AI SDLC: Quán Ăn Chợ Nổi

> **Làm theo nhóm 4–6 người** · Dùng AI để xây game 2D qua **4 phase** trong **3 giờ**: Út Sen lặn bắt cá, hái rau trên mặt nước rồi tối mở quán phục vụ khách.
> **Yêu cầu từng phase mở đúng mốc giờ tại lab board:** **[Chợ Nổi Lab](https://claude.ai/artifact/E35v787wSx2wDgPTNhMVDg)** (cần đăng nhập claude.ai; có trợ giảng AI cho từng phase).

## Bắt buộc (chỉ có thế)

Cách làm việc kỹ thuật là **tự do** (push thẳng, nhánh + PR, pair, có hay không CI…). Cái bắt buộc:

1. **Một repo chung:** trưởng nhóm **fork** repo này, đặt tên `K5-L3B-LAB-Day12-AI-SDLC-<ten-nhom>`, thêm mọi thành viên làm collaborator (*Settings → Collaborators*, quyền Write) và để repo **public** (giảng viên xem được, không cần mời).
2. **Cả nhóm cùng commit** bằng tài khoản GitHub của mình, mỗi người **≥ 3 commit có nội dung** (làm cặp thì ghi `Co-authored-by:`).
3. **Điền [`TEAM.md`](TEAM.md):** danh sách thành viên + thỏa thuận làm việc nhóm; sửa `team_size` trong [`game.contract.json`](game.contract.json). Commit của người không có trong `TEAM.md` không được tính.
4. **Gắn tag** `phase-1` … `phase-4` đúng hạn; chạy được tại từng tag.
5. **Ghi chép tối thiểu:** `docs/verification/phase-n.md`, `docs/clarify.md`, `docs/ai-usage-log.md`, `docs/retro.md`, `docs/members/<handle>.md`.

## Bắt đầu nhanh

Yêu cầu Git, Python 3.10 trở lên và trình duyệt. Game dùng thư viện chuẩn Python. Benchmark cần thêm Chrome hoặc Chromium trên máy chạy.

```bash
git clone https://github.com/lam2121/K5-L3B-LAB-Day12-AI-SDLC-NhomBaKhi.git chonoi-demo
cd chonoi-demo
python3 -m chonoi.live --mode gather
```

Mở địa chỉ máy chủ in ra, mặc định `http://127.0.0.1:8000/`. Chọn **Bắt đầu hành trình** để chơi *Mùa Nước Nổi* qua Gather → Quán → Shop trong năm ngày. Có thể vào riêng **Buổi sáng** hoặc **Buổi tối**. Nếu cổng 8000 đang bận, thêm `--port 8080`.

## Điều khiển

| Phím | Buổi sáng · Sông Chín Khúc | Buổi tối · Nhà bè Má Tư |
|---|---|---|
| WASD hoặc mũi tên | Bơi, `S` / `↓` để lặn | Đi lại, `W` / `↑` đi về phía bắc |
| E | Hái rau hoặc cập bến | Tương tác với bếp hoặc bàn để nấu, bưng, phục vụ |
| Space | Bắt đàn cá gần khi đang lặn | |
| R | Chơi lại buổi sáng | Chơi lại ca tối với kho đầu ca |

Trong **Bắt đầu hành trình**, **Esc** hoặc **P** tạm dừng hoặc tiếp tục, kể cả khi ở cửa hàng. Bấm **Mua cấp** để mua nâng cấp và **Qua ngày mới** để đóng cửa hàng. Cấp đã mua bắt đầu áp dụng từ sáng hôm sau.

Nút **Tương phản cao** nằm trên thanh trên cùng và trong màn tạm dừng. Trình duyệt lưu lựa chọn. Cảnh báo oxy thấp, thủy quái và khách sắp bỏ đi có cả chữ và biểu tượng.

Trong hành trình, **Mở quán** chuyển kho cá thể từ giỏ sáng sang ca tối trong cùng phiên. Buổi sáng độc lập ghi `inventory.json` khi kết thúc. Buổi tối độc lập đọc file đó nếu có, hoặc dùng [kho cá thể mẫu](docs/contracts/inventory.v12.sample.json). Dùng `python3 -m chonoi.live --mode quan --inventory kho.json` để chọn kho riêng.

Điểm cuối ca bằng doanh thu cộng `reputation_multiplier × floor(uy tín)`, với hệ số trong [contract](game.contract.json) là 100. Tiền và boa hiển thị theo nghìn đồng.

## Kiểm tra

```bash
PYTHONPATH=tests:. python3 -m unittest discover -s tests -v
python3 -m chonoi.headless --mode day --seed 42 --days 5 --ticks 600 --out day.jsonl
python3 -m chonoi.soak --seed 7 --days 10 --out soak.json
```

Để kiểm danh sách thành viên và chạy cả suite bằng một lệnh, dùng `python3 tools/phase1.py verify`. Dùng `python3 tools/phase1.py smoke` nếu chỉ cần kiểm tra bàn giao kho giữa hai tiến trình. [Ma trận nghiệm thu Phase 1](docs/verification/phase-1.md)

Lệnh headless trên kiểm 600 tick đầu. `--inputs` nạp kịch bản thao tác, `--mode gather` và `--mode quan` chạy từng buổi. Lệnh soak chạy đủ 10 ngày bằng bot tất định. [Ma trận nghiệm thu Phase 4](docs/verification/phase-4.md)

Khi cần kiểm tra UI riêng, chạy `python3 -m http.server 8000 --bind 127.0.0.1` ở gốc repo và mở `http://127.0.0.1:8000/chonoi/web/?preview=1`. Chọn chế độ, rồi nhấn **E** hoặc **Space** để duyệt các snapshot mẫu. Bản xem có thể đi qua luồng thu hoạch, chuyển kho, nấu, bưng, phục vụ, thanh toán và tổng kết.

Để xem UI Phase 2 độc lập, đổi URL thành `http://127.0.0.1:8000/chonoi/web/?preview=2`. Chọn **Bắt đầu hành trình**, nhấn **E** hoặc **Space** để duyệt cảnh sông và nhấn **E** để duyệt ca tối. Phiên này dùng tình huống đã dựng sẵn. Trên PowerShell có thể chạy máy chủ bằng `python -m chonoi.live --mode gather`. [Báo cáo nghiệm thu Phase 2](docs/verification/phase-2.md)

Đổi thành `http://127.0.0.1:8000/chonoi/web/?preview=3` để xem UI Phase 3 độc lập. Trong Ngày 1, nhấn **E**, **Space**, rồi **E** để xem hàng ươn trong giỏ và bàn giao kho. Mở quán rồi nhấn **E** để xem một nguyên liệu đang giữ chỗ tụt dưới 30% và bàn báo **Hết hàng tươi!**. [Checklist UI Phase 3](docs/verification/phase-3.md)

## Benchmark render

Chạy ở gốc repo với Python và Chrome hoặc Chromium đã cài. Trên Windows có thể dùng `python`.

```bash
python3 -m chonoi.bench --seed 42 --duration 30 --out bench.json
```

Lệnh tự mở Chromium ở 1280×720, dùng Gather thật của checkout với Út Sen đứng ở bến, làm nóng 3 giây rồi ghi `bench.json`. Có thể đặt `CHONOI_BROWSER` nếu Chrome nằm ngoài `PATH` hoặc vị trí cài phổ biến. [Phương pháp và bằng chứng Phase 4](docs/proof/phase-4/client-ui.md)

## Sáng tạo của nhóm

- Sông Chín Khúc có trời hồng, bờ dừa nước, nhà sàn và bọt khí khi Út Sen bơi dưới nước. Camera cuộn ngang theo nhân vật.
- Nhà bè Má Tư có sàn gỗ, đèn dây đung đưa và khói khi bếp đang nấu. Út Sen mặc áo bà ba, quàng khăn rằn và mang giỏ lưới.
- Thông báo dùng giọng Nam Bộ. Cạn oxy hiện cảnh báo, ngạt làm viền đỏ và rung nhẹ, khách boa làm thông báo thanh toán sáng lên. Đồ họa và hiệu ứng do client vẽ từ snapshot và event. [Bằng chứng UI](docs/proof/phase-1/client-ui.md)
- Phase 2 chia sông thành ba tầng màu, thêm vạch nước sâu và cá sấu Năm Chèo với phản hồi riêng khi đuổi hoặc bị choáng. Nhà bè có ánh đèn dây, khói trên hai bếp và lời thoại ngắn của khách. [Checklist UI Phase 2](docs/verification/phase-2.md)
- *Mùa Nước Nổi* thêm lá, hạt phù sa và bọt nước màu vàng ở sông. Giỏ dùng vạch xanh hoặc vàng theo độ tươi, và gạch chéo các ô ươn.
- Màn mở đầu *Mùa Nước Nổi* minh họa Út Sen chèo ghe qua chợ sớm. Ánh mặt trời phản chiếu trên sông và đèn dầu hắt xuống sàn nhà bè trong hai cảnh chơi. [Kiểm tra giao diện demo](docs/proof/phase-4/ui-demo.md)
- Trước mỗi chuyến lặn trong **Bắt đầu hành trình**, Út Sen có thể dùng tiền trong ví để mua súng lặn, đạn bong bóng, bình oxy hoặc áo phao. Dưới nước, bấm **F** hoặc **Bắn** để hạ cá sấu gần nhất trong tầm. Tiền bán món và tiền thưởng được giữ sang ngày sau. [Bộ ảnh dụng cụ](chonoi/web/assets/README.md#prompt-tạo-dụng-cụ-lặn)

## Tự do sáng tạo

Ngoài phần đề yêu cầu, nhóm được **thêm** nhân vật, loài cá/cây, sinh vật, món, bản đồ, cơ chế, câu chuyện, đồ họa, âm nhạc… với ba điều kiện: **không phá phần cố định** (tắt ở headless), ghi mục **"Sáng tạo của nhóm"** trong README của nhóm, và **làm lõi đúng trước**.

## Lịch 3 giờ

| Mốc | Phase | Hạn tag |
|---|---|---|
| 0:00 | Phase 1 (PRD-0) | `phase-1` trước 1:00 |
| 1:00 | Phase 2 | `phase-2` trước 1:55 |
| 1:55 | Phase 3 | `phase-3` trước 2:30 |
| 2:30 | Phase 4 | `phase-4` + Release `v1.0.0` trước 3:00 |

Hết giờ mỗi phase thì gắn tag rồi đi tiếp; chỗ chưa xong ghi trung thực trong bằng chứng.

## Đánh giá (100 điểm)

| Hạng mục | Điểm |
|---|---|
| Test tự động ẩn (headless, gồm kiểm tra lại phase trước) | 25 |
| Làm việc nhóm (một repo chung, chia việc, tích hợp, đổi yêu cầu) | 25 |
| Kiểm chứng & bằng chứng | 15 |
| Harness AI (AGENTS.md, skill, nhật ký dùng AI) | 10 |
| Đánh giá & retro | 10 |
| Chất lượng sản phẩm (đúng yêu cầu, mở rộng/sáng tạo) | 10 |
| Demo | 5 |

## Quy định

- Dùng AI thoải mái; **không sao chép repo của nhóm khác**; bằng chứng phải thật.
- Nhân vật, bối cảnh là bản gốc của lab; asset ngoài chỉ dùng CC0/CC-BY/MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`. Không commit API key, token, `.env`.
