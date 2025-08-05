Hệ Thống Quản Lý Thư Viện Thông Minh
Hệ thống quản lý thư viện hiện đại tích hợp công nghệ RFID và nhận diện khuôn mặt, được xây dựng với Node.js, React, và các thiết bị IoT.
🚀 Tính Năng Chính
Quản Lý Cơ Bản

Quản lý sách: Thêm, sửa, xóa, tìm kiếm sách
Quản lý người dùng: Đăng ký, cập nhật thông tin thành viên
Quản lý mượn trả: Theo dõi lịch sử mượn trả sách
Báo cáo thống kê: Phân tích dữ liệu sử dụng thư viện

Công Nghệ Tiên Tiến

🏷️ RFID Technology: Quét thẻ RFID để xác thực người dùng và sách
👤 Face Recognition: Nhận diện khuôn mặt sử dụng Face-API.js
📡 IoT Integration: Kết nối với các thiết bị thông qua MQTT
⚡ Real-time Updates: Cập nhật theo thời gian thực với Socket.IO
🔐 JWT Authentication: Bảo mật với JSON Web Token

🛠️ Công Nghệ Sử Dụng
Backend

Framework: Express.js
Database: MySQL với Sequelize ORM
Authentication: JWT + bcrypt
Real-time: Socket.IO
Face Recognition: @vladmandic/face-api, Face-API.js
IoT Communication: MQTT
File Upload: Multer
Environment: dotenv

Frontend

Framework: React 19.1.0
Routing: React Router DOM
Testing: Jest, React Testing Library
Real-time: Socket.IO Client
Build Tool: Create React App

Hardware/IoT

Microcontroller: ESP32
RFID Module: MFRC522
Display: LCD 16x2
Communication: Wi-Fi, MQTT
Development: Arduino IDE/PlatformIO

📁 Cấu Trúc Dự Án
library-management-system/
├── library-system/          # Backend API
│   ├── app.js              # Entry point
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── middleware/         # Authentication & validation
│   ├── config/             # Database & environment config
│   └── uploads/            # File uploads
├── library-fe/             # Frontend React App
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── styles/         # CSS styles
│   │   └── App.js          # Main app component
│   └── public/             # Static files
└── hardware/               # IoT device code (ESP32)
    ├── rfid_scanner/
    └── face_detection/
🔧 Cài Đặt và Chạy
Yêu Cầu Hệ Thống

Node.js >= 14.0.0
MySQL >= 8.0
MQTT Broker (HiveMQ hoặc tương tự)
ESP32 development board
MFRC522 RFID module

1. Cài Đặt Backend
bash# Clone repository
git clone <repository-url>
cd library-system

# Cài đặt dependencies
npm install

# Cấu hình environment variables
cp .env.example .env
# Chỉnh sửa file .env với thông tin database và MQTT

# Chạy migrations (nếu có)
npm run migrate

# Khởi động server development
npm run dev

# Hoặc chạy production
npm start
2. Cài Đặt Frontend
bashcd library-fe

# Cài đặt dependencies
npm install

# Chạy development server
npm start

# Build cho production
npm run build
3. Cấu Hình Hardware
bash# Upload code lên ESP32
# Cấu hình Wi-Fi credentials
# Kết nối RFID module với ESP32
# Cấu hình MQTT broker settings
📡 API Endpoints
Authentication
POST /api/auth/login      # Đăng nhập
POST /api/auth/register   # Đăng ký
Books Management
GET    /api/books         # Lấy danh sách sách
POST   /api/books         # Thêm sách mới
PUT    /api/books/:id     # Cập nhật sách
DELETE /api/books/:id     # Xóa sách
Users Management
GET    /api/users         # Lấy danh sách người dùng
POST   /api/users         # Thêm người dùng
PUT    /api/users/:id     # Cập nhật người dùng
DELETE /api/users/:id     # Xóa người dùng
Loans Management
GET    /api/loans         # Lịch sử mượn trả
POST   /api/loans/borrow  # Mượn sách
POST   /api/loans/return  # Trả sách
🔌 MQTT Topics
library/rfid/scan         # RFID card scanned
library/face/detected     # Face detected
library/device/status     # Device status updates
library/books/checkout    # Book checkout events
library/books/checkin     # Book return events
🎯 Luồng Hoạt Động
Luồng 1: Check-in (Vào thư viện)

Người dùng quét thẻ RFID hoặc sử dụng nhận diện khuôn mặt
ESP32 gửi dữ liệu lên backend qua MQTT
Backend xác thực và cập nhật trạng thái
Frontend hiển thị thông tin real-time qua Socket.IO

Luồng 2: Mượn sách

Người dùng quét thẻ RFID để xác thực
Quét RFID tag của sách cần mượn
ESP32 gửi dữ liệu lên HiveMQ
Backend xử lý giao dịch mượn sách
Cập nhật database và thông báo đến frontend

🚦 Scripts Có Sẵn
Backend Scripts
bashnpm start          # Chạy production server
npm run dev        # Chạy development với nodemon
npm test           # Chạy tests
Frontend Scripts
bashnpm start          # Chạy development server (localhost:3000)
npm run build      # Build cho production
npm test           # Chạy test suite
npm run eject      # Eject từ CRA (không khuyến khích)
🔒 Bảo Mật

JWT Authentication: Xác thực API với JSON Web Token
Password Hashing: Mã hóa mật khẩu bằng bcrypt
CORS Protection: Cấu hình CORS cho frontend
Input Validation: Kiểm tra dữ liệu đầu vào
HTTPS Support: Hỗ trợ SSL/TLS

📊 Database Schema
Bảng chính:

Books: Thông tin sách (title, author, isbn, rfidTag, category)
Users: Thông tin người dùng (name, email, role, phone, address)
Loans: Lịch sử mượn trả (userId, bookId, issueDate, dueDate, status)
Cards: Thẻ RFID (cardId, userId, isActive)
Attendance: Lịch sử ra vào (userId, checkInTime, checkOutTime)

🎨 Giao Diện Người Dùng
Frontend được thiết kế responsive với:

Dashboard tổng quan
Quản lý sách và người dùng
Lịch sử mượn trả
Báo cáo và thống kê
Cài đặt hệ thống

🐛 Troubleshooting
Lỗi Thường Gặp
Backend không kết nối được database:
bash# Kiểm tra MySQL service
sudo systemctl status mysql
# Kiểm tra credentials trong .env
Frontend không kết nối được API:
bash# Kiểm tra backend có chạy trên port 5000
# Kiểm tra CORS settings
ESP32 không kết nối MQTT:
bash# Kiểm tra Wi-Fi connection
# Kiểm tra MQTT broker settings
# Kiểm tra firewall
📈 Phát Triển Tương Lai

 Mobile app với React Native
 Barcode scanning support
 Email notifications
 Advanced analytics dashboard
 Multi-library support
 Blockchain integration for secure records