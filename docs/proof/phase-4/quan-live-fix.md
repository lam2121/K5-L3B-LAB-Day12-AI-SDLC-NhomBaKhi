# Kiểm chứng sửa lỗi ca tối

Kiểm ngày 2026-11-21 trên `lam`, từ `150ff4c` cùng bản sửa local.

- `/state` của phiên demo cũ dừng tại tick 1352, `mode: day`, `phase: quan`. Khi có món đủ nguyên liệu, bước tạo khách báo `AttributeError: 'Streams' object has no attribute 'quan'`. Bản sửa dùng `Streams.get("customer")` và `IdAllocator.new("C")`.
- Snapshot Quán nối khách với bàn qua `customer_id`. Chrome xác nhận cảnh báo kiên nhẫn thấp có biểu tượng trong chế độ tương phản cao, gợi ý E hiện khi có thể thao tác và chuyển thành **Phục vụ bàn T1** khi cầm đúng món.
- Dùng Chrome headless với hai máy chủ localhost và fixture ca tối rút ngắn. Chạy **Buổi tối** riêng và **Bắt đầu hành trình** qua Gather → Quán. Cả hai có khách tự đến, B1 nấu xong, người chơi bưng món, đi đến T1, phục vụ và thu **70k** gồm **59k tiền món + 11k boa**. T1 được giải phóng sau thanh toán. Bản hành trình hiện đúng hai khoản ở tổng kết ca. Hai lượt không ghi lỗi JavaScript.
- Suite Python đạt **66/66**. Hai ca mới bao phủ khách tự đến → hoàn tất thanh toán và dọn món khi khách rời, gồm lúc kiên nhẫn về 0 trùng tick đóng ca. Helper dựng input test chỉ đưa các nút đang nhấn vào tập cạnh nhấn.

```powershell
$env:PYTHONPATH = 'tests;.'
$env:PYTHONUTF8 = '1'
python3 -m unittest discover -s tests -v
node --check chonoi/web/scenes.js
```
