# Kiểm chứng contract Gather Phase 4

Game dùng Test Contract v1.3. `game.contract.json` cung cấp tuning và khai báo `bench_cmd`/`soak_cmd`; kho cá thể cùng độ tươi giữ schema từ v1.2. Luật không hard-code số liệu cân bằng, và phần bắn cá sấu chỉ hoạt động ở live, không xuất event trang bị vào headless.

```powershell
python -m chonoi.headless --mode gather --seed 42 --ticks 600 --out gather.jsonl
python tools/phase1.py smoke
python -m chonoi.soak --seed 7 --days 10 --out soak.json
```

Headless Gather 600 tick, smoke chuyển kho Gather → Quán và soak 10 ngày đều thành công. Hai lượt soak seed 7 ghi đủ 10 ngày, 0 crash và khớp kết quả gameplay khi bỏ `duration_s`. Regression suite hiện đạt **69/69**. [Ma trận Phase 4](../../verification/phase-4.md) · [Soak 1](soak.json) · [Soak 2](soak-repeat.json)
