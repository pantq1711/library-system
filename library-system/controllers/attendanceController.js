  const attendanceService = require('../services/attendanceService');
  let io;

  // Thiết lập Socket.IO
  const setIo = (socketIo) => {
    io = socketIo;
  };
  const verifyCheckin = async (req, res) => {
    try {
      const { userId } = req.params;
      const { Attendance } = require('../models');
      
      // Tìm check-in gần nhất của user
      const attendance = await Attendance.findOne({
        where: {
          userId: userId,
          checkOutTime: null // đủ điều kiện để xác định là đang trong thư viện
        },
        order: [['checkInTime', 'DESC']]
      });
      

      if (attendance) {
        res.json({
          success: true,
          isCheckedIn: true,
          checkInTime: attendance.checkInTime,
          attendanceId: attendance.id
        });
      } else {
        res.json({
          success: true,
          isCheckedIn: false,
          message: 'User chưa check-in hoặc đã check-out'
        });
      }
    } catch (error) {
      console.error('Error verifying check-in:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi kiểm tra trạng thái check-in' 
      });
    }
  };

  // Xử lý quét thẻ RFID
  exports.processCardScan = async (req, res) => {
    try {
      const { cardId } = req.body;
      
      // Xử lý quét thẻ qua service
      const { user, card } = await attendanceService.processCardScan(cardId);
      
      // Trả về thông tin người dùng để xác thực khuôn mặt
      res.status(200).json({
        success: true,
        message: 'Quét thẻ thành công, vui lòng xác thực khuôn mặt',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
      
    } catch (error) {
      console.error('Lỗi khi xử lý quét thẻ:', error);
      res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
        success: false, 
        message: error.message || 'Lỗi server' 
      });
    }
  };

  // Xử lý xác thực khuôn mặt và check-in/check-out
  // THAY THẾ HOÀN TOÀN FUNCTION processFaceAuth trong attendanceController.js:

  exports.processFaceAuth = async (req, res) => {
    console.log("🔥 === FACE AUTH DEBUG START ===");
    console.log("📦 Request body:", req.body);
    console.log("📊 Request headers:", req.headers);
    
    try {
      const { userId, faceImage } = req.body;
      
      console.log(`🆔 User ID: ${userId}`);
      console.log(`🖼️ Face image exists: ${!!faceImage}`);
      console.log(`📏 Face image type: ${typeof faceImage}`);
      
      if (faceImage) {
        console.log(`📐 Face image length: ${faceImage.length}`);
        console.log(`🔤 Face image starts with: ${faceImage.substring(0, 50)}...`);
      }
      
      // Kiểm tra có ảnh khuôn mặt không
      if (!faceImage) {
        console.log("❌ No face image provided");
        return res.status(400).json({ 
          success: false, 
          message: 'Thiếu ảnh khuôn mặt để xác thực' 
        });
      }
      
      // LUÔN LUÔN TRUE nếu có ảnh (để test)
      const faceVerified = true;
      
      console.log(`✅ Face verified set to: ${faceVerified}`);
      console.log(`🚀 Calling attendanceService.processFaceAuth with verified=${faceVerified}`);
      
      // Xử lý xác thực khuôn mặt và check-in/check-out qua service
      const { attendance, action, user } = await attendanceService.processFaceAuth(userId, faceVerified);
      
      console.log(`✅ Service returned: action=${action}, user=${user.name}`);
      
      // Gửi thông báo qua Socket.IO
      if (io) {
        const socketData = {
          userId: user.id,
          userName: user.name,
          action,
          time: action === 'check-in' ? attendance.checkInTime : attendance.checkOutTime
        };
        
        io.emit('attendance_update', socketData);
        console.log(`📡 Emitted attendance_update:`, socketData);
        const mqttResponse = {
          status: 'success',
          user: user.name,
          userId: user.id,
          action: action,
          message: `${action === 'check-in' ? 'Check-in' : 'Check-out'} thành công`,
          timestamp: new Date().toISOString()
        };
        
        // TODO: Gửi về ESP32 qua MQTT
        // Cần import MQTT client hoặc dùng global instance
        console.log(`📤 Should send to ESP32:`, mqttResponse);
      }
      
      const responseData = {
        success: true,
        message: `${action === 'check-in' ? 'Check-in' : 'Check-out'} thành công`,
        attendance,
        action
      };
      
      console.log(`📤 Sending response:`, responseData);
      console.log("🔥 === FACE AUTH DEBUG END SUCCESS ===");
      
      res.status(200).json(responseData);
      
    } catch (error) {
      console.log("🔥 === FACE AUTH DEBUG END ERROR ===");
      console.error('❌ Full error object:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      if (error.message === 'Xác thực khuôn mặt thất bại') {
        return res.status(401).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      if (error.message.includes('Không tìm thấy')) {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Lỗi server' 
      });
    }
  };
  const getCheckinList = async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { Attendance, User } = require('../models');
      
      const checkins = await Attendance.findAll({
        where: {
          checkInTime: {
            [require('sequelize').Op.gte]: today
          }
        },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email', 'role']
        }],
        order: [['checkInTime', 'DESC']]
      });
  
      // Format dữ liệu cho frontend
      const formattedCheckins = checkins.map(checkin => ({
        id: checkin.id,
        name: checkin.User?.name || 'Unknown',
        email: checkin.User?.email,
        role: checkin.User?.role || 'student',
        checkInTime: checkin.checkInTime,
        checkOutTime: checkin.checkOutTime,
        status: checkin.status,
        duration: checkin.checkOutTime ? 
          calculateDuration(checkin.checkInTime, checkin.checkOutTime) : 
          'Đang trong thư viện'
      }));
  
      res.json({
        success: true,
        data: formattedCheckins,
        count: formattedCheckins.length
      });
    } catch (error) {
      console.error('Error fetching check-in list:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi khi lấy danh sách check-in' 
      });
    }
  };
  
  // Helper function tính thời gian
  const calculateDuration = (checkIn, checkOut) => {
    const duration = new Date(checkOut) - new Date(checkIn);
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };
  

  module.exports = {
    processCardScan: exports.processCardScan,
    processFaceAuth: exports.processFaceAuth,
    verifyCheckin,
    getCheckinList,
    setIo
  }; 