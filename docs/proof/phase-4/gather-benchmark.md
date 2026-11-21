# Kiểm chứng Gather và benchmark Phase 4

Đo trên mã game tại `1c065b47e28e916a2586f0ed7407c107652c84bb`, Windows, Python 3.12.10 và Chrome headless. Benchmark chạy đúng lệnh của contract v1.3:

```powershell
python -m chonoi.bench --seed 42 --duration 30 --out docs/proof/phase-4/bench.json
```

| FPS trung bình | 1% low FPS | Khung đo | Thời gian đo | Tải cảnh |
|---:|---:|---:|---:|---:|
| 33.44 | 3.38 | 1,002 | 29.963 s | 1,976 ms |

JSON có đủ `avg_fps`, `p1_low_fps`, `frames`, `measured_s`, `load_ms`. Công thức `p1_low_fps` là nghịch đảo thời gian trung bình của `max(1, ceil(0.01 × frames))` khung chậm nhất. Tải cảnh dưới 10 giây; FPS trung bình và 1% low thấp hơn mốc tham khảo 60/30 trên máy đo này. [Artifact](bench.json)

`PYTHONPATH=tests:. python -m unittest discover -s tests -v` đạt **69/69**. Các ca Gather kiểm độ tươi, ngất ở tick biên, nhả giỏ theo LIFO và bàn giao kho đều đạt. Lượt chạy trong sandbox bị chặn loopback trên Windows; kết quả trên được chạy lại với quyền kết nối loopback cục bộ.
