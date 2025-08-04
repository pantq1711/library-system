const attendanceService = require('../services/attendanceService');
let io;

// Thiết lập Socket.IO
const setIo = (socketIo) => {
  io = socketIo;
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
      mqttClient.publish('library/response', JSON.stringify(mqttResponse));
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

module.exports = {
  processCardScan: exports.processCardScan,
  processFaceAuth: exports.processFaceAuth,
  setIo
}; 