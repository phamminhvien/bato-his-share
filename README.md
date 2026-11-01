# HIS Toolkit

Thư mục chứa các công cụ độc lập, mini tools, tiện ích tự động hóa và tiện ích mở rộng (browser extensions) phục vụ cho hệ thống HIS mà không phụ thuộc trực tiếp vào mã nguồn cốt lõi (core codebase).

---

## 📁 Cấu trúc thư mục

```text
src/toolkit/
├── extensions/               # Chứa các tiện ích mở rộng trình duyệt (Chrome / Edge extension)
│   └── BATO_SMART_FILL/      # Tự động bắt sự kiện & điền/chọn dữ liệu thông minh theo quy tắc / Script JS
├── scripts/                  # Các script tự động hóa, mini CLI tools (Node.js, Python, PowerShell...)
└── README.md                 # Tài liệu tổng quan
```

---

## 🛠️ Nguyên tắc phát triển
1. **Độc lập (Decoupled)**: Mỗi mini tool / extension nên có dependency riêng (package.json, requirements.txt...) để không ảnh hưởng đến `backend` hay `frontend` của HIS.
2. **Mục tiêu rõ ràng**: Phục vụ các nghiệp vụ phụ trợ (nhập liệu tự động, cào/đồng bộ dữ liệu, phím tắt nhanh, tiện ích hỗ trợ khám/xét nghiệm...).
