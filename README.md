# Jotform → Bitrix24 Integration

Ứng dụng Node.js nhận dữ liệu mỗi khi có người gửi form Jotform, lấy chi tiết submission qua **Jotform API**, rồi tạo một **Contact** mới trong **Bitrix24 CRM** qua REST API (inbound webhook).

## Luồng hoạt động

```
Người dùng gửi form
      │
      ▼
Jotform ──(webhook POST: submissionID)──► POST /webhook/jotform  (ứng dụng này)
                                               │
                                               ├─ 1. GET  https://api.jotform.com/submission/{id}   (Jotform API)
                                               ├─ 2. Kiểm tra dữ liệu (họ tên, SĐT, email)
                                               └─ 3. POST {BITRIX24_WEBHOOK_URL}crm.contact.add     (Bitrix24 API)
```

Ánh xạ trường:

| Jotform              | Bitrix24 |
| -------------------- | -------- |
| Họ và tên (Full Name) | `NAME`   |
| Số điện thoại (Phone) | `PHONE`  |
| Email                 | `EMAIL`  |

## Cấu trúc thư mục

```
src/
├── app.js                          # Khởi tạo Express, kiểm tra biến môi trường
├── routes/webhook.routes.js        # Khai báo route POST /webhook/jotform
├── controllers/webhook.controller.js  # Điều phối: Jotform → validate → Bitrix24
├── services/jotform.service.js     # Gọi Jotform API, trích xuất họ tên/SĐT/email
├── services/bitrix24.service.js    # Gọi crm.contact.add trên Bitrix24
└── utils/
    ├── logger.js                   # Ghi log ra console và logs/app.log
    └── validator.js                # Kiểm tra & chuẩn hoá dữ liệu
```

## Yêu cầu

- Node.js **18 trở lên** (dùng `fetch` có sẵn)
- Tài khoản Jotform và Bitrix24
- Một URL public để Jotform gọi tới (khi chạy local có thể dùng [ngrok](https://ngrok.com/))

> **Lưu ý:** Jotform đang bị chặn tại Việt Nam. Cần bật **VPN** để truy cập form Jotform, và máy chạy ứng dụng này cũng phải có VPN (hoặc đặt ở server ngoài Việt Nam) thì mới gọi được Jotform API. Nếu không, log sẽ báo lỗi `Cannot connect to Jotform API: fetch failed` (`Connection reset by peer`).

## 1. Thiết lập Jotform và lấy API Key

1. Đăng ký/đăng nhập Jotform bằng email được mời.
2. **Tạo form**: *Create Form → Start From Scratch*, thêm 3 trường và bật **Required** cho cả 3:
   - **Full Name** (hoặc *Short Text*) – Họ và tên
   - **Phone** – Số điện thoại
   - **Email** – Email
3. Bấm **Publish** để form hoạt động.
4. **Lấy API Key**: ảnh đại diện → *Settings* → *API* → **Create New Key**, chọn quyền **Read Access**. Sao chép key.

> Tài khoản đặt ở EU thì dùng `JOTFORM_API_URL=https://eu-api.jotform.com`.

## 2. Thiết lập webhook trên Bitrix24

1. Đăng nhập Bitrix24 → **Developer resources** (Tài nguyên dành cho nhà phát triển) → **Other** → **Inbound webhook**.
2. Ở phần **Assign permissions**, chọn scope **CRM (crm)**.
3. Bấm **Save**. Sao chép **Webhook to call REST API**, có dạng:
   ```
   https://your-domain.bitrix24.com/rest/1/xxxxxxxxxxxxxxxx/
   ```
   Đây là thông tin xác thực mà ứng dụng dùng (không cần OAuth). Giữ bí mật URL này.

Tham khảo: https://helpdesk.bitrix24.com/open/13341996/

## 3. Cài đặt và chạy ứng dụng

```bash
git clone <repo-url>
cd jotform-bitrix24-integration
npm install
cp .env.example .env     # sau đó điền giá trị thật vào .env
npm start                # hoặc: npm run dev (tự reload khi sửa code)
```

Nội dung `.env`:

| Biến                   | Mô tả                                                   |
| ---------------------- | ------------------------------------------------------- |
| `PORT`                 | Cổng chạy server (mặc định `3000`)                      |
| `JOTFORM_API_KEY`      | API Key lấy ở bước 1                                    |
| `JOTFORM_API_URL`      | `https://api.jotform.com` (hoặc `eu-api` cho tài khoản EU) |
| `BITRIX24_WEBHOOK_URL` | URL webhook lấy ở bước 2                                |
| `LOG_MAX_SIZE_MB`      | (tuỳ chọn) Kích thước tối đa của `app.log` trước khi xoay vòng, mặc định `5` |
| `LOG_MAX_FILES`        | (tuỳ chọn) Số file log cũ giữ lại (`app.log.1` … `app.log.N`), mặc định `5` |

Kiểm tra server: `curl http://localhost:3000/health` → `{"status":"ok"}`

## 4. Kết nối Jotform với ứng dụng

1. Đưa ứng dụng ra Internet. Khi chạy local:
   ```bash
   ngrok http 3000
   ```
   Lấy URL dạng `https://abcd-1234.ngrok-free.app`.
2. Trong Jotform, mở form → **Settings** → **Integrations** → tìm **WebHooks**.
3. Dán URL: `https://abcd-1234.ngrok-free.app/webhook/jotform` → **Complete Integration**.
4. Gửi thử form. Trong Bitrix24 → **CRM → Contacts** sẽ xuất hiện contact mới.

## Logging

Mọi hoạt động được ghi ra console và file `logs/app.log`, ví dụ:

```
[2026-10-08T03:12:01.123Z] [INFO] Received Jotform webhook {"submissionID":"6012345678901234567","formID":"251234567890123"}
[2026-10-08T03:12:01.540Z] [INFO] Fetched submission from Jotform {"submissionId":"6012345678901234567"}
[2026-10-08T03:12:01.910Z] [INFO] Created Bitrix24 contact {"contactId":42}
[2026-10-08T03:12:01.911Z] [INFO] Submission synced to Bitrix24 {"submissionID":"6012345678901234567","contactId":42}
```

## Chống trùng, retry và xoay vòng log

- **Chống trùng theo submission ID:** mỗi `submissionID` đã đồng bộ thành công được lưu vào `data/processed-submissions.json` (giữ tối đa 10.000 ID gần nhất, còn sau khi restart). Jotform gửi lại cùng ID thì bỏ qua ngay, không gọi API nào và trả lại `contactId` cũ với `duplicate: true`. Các webhook đồng thời cùng ID được gộp thành một lần xử lý. ID chỉ được lưu khi thành công, nên lần lỗi vẫn thử lại được.
- **Retry:** lỗi mạng, timeout, HTTP 429/5xx và `QUERY_LIMIT_EXCEEDED` được thử lại tối đa 3 lần (chờ 0.5s → 1s → 2s) cho cả Jotform và Bitrix24. Lỗi 4xx/sai API key không retry. Timeout khi gọi Bitrix24 không được thử lại (có thể contact đã được tạo), tránh tạo contact kép.
- **Xoay vòng log:** khi `logs/app.log` đạt `LOG_MAX_SIZE_MB` sẽ đổi thành `app.log.1`, các file cũ dồn lên, file vượt `LOG_MAX_FILES` bị xoá.

## Xử lý lỗi

| Tình huống                                  | Phản hồi | Ghi log |
| ------------------------------------------- | -------- | ------- |
| Thiếu biến môi trường khi khởi động          | Dừng ứng dụng | `ERROR` |
| Request không có `submissionID`              | `400`    | `WARN`  |
| Dữ liệu sai định dạng (thiếu tên, SĐT/email sai) | `422` | `WARN`  |
| Không kết nối được / timeout (10s) tới Jotform hoặc Bitrix24 | `502` | `ERROR` |
| Sai API Key Jotform / sai webhook Bitrix24   | `502`    | `ERROR` |

## Test thủ công không cần form

Lấy một `submissionID` có thật (Jotform → *Inbox*, hoặc `GET https://api.jotform.com/form/{formID}/submissions?apiKey=...`), rồi:

```bash
curl -X POST http://localhost:3000/webhook/jotform -F submissionID=6012345678901234567
```
