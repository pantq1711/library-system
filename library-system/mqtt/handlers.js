/**
 * Xử lý các tin nhắn MQTT
 */

const cardService = require('../services/cardService');
const bookService = require('../services/bookService');
const userService = require('../services/userService');
const { CARD_SCANNED, CARD_SCAN_ERROR, BOOK_SCANNED, BOOK_SCAN_ERROR } = require('../socket/events');

// Lưu trạng thái hiện tại
const activeUsers = new Map(); // Map cardId -> userId
const activeScans = new Map(); // Map userId -> { scanType, timestamp }
let mqttClient = null; // Để gửi response về ESP32

/**
 * Set MQTT client để gửi response
 * @param {object} client - MQTT client instance
 */
function setMqttClient(client) {
  mqttClient = client;
}

/**
 * Xử lý quét thẻ RFID
 * @param {string} message - Message JSON từ ESP32
 * @param {object} io - Socket.IO instance
 */
async function handleCardScan(message, io) {
  let cardId = '';
  
  try {
    // Parse JSON message từ ESP32
    const data = JSON.parse(message);
    cardId = data.uid;
    
    console.log(`🔍 Xử lý quét thẻ với UID: ${cardId}`);
    console.log(`📱 Data từ ESP32:`, data);
    
    // Lấy thông tin user từ cardId (SỬA: dùng userService thay vì cardService)
    const { user, card } = await userService.getUserByCardId(cardId);
    
    console.log(`✅ Tìm thấy user: ${user.name} (ID: ${user.id}, Email: ${user.email})`);
    
    // Cập nhật thời gian sử dụng thẻ gần nhất
    try {
      await cardService.updateCardLastUsed(cardId);
    } catch (updateError) {
      console.log(`⚠️ Không thể cập nhật lastUsed: ${updateError.message}`);
    }
    
    // Lưu thông tin người dùng đang hoạt động
    activeUsers.set(cardId, user.id);
     
    // Xác định loại quét (check-in/check-out hoặc mượn/trả sách)
    const scanType = user.role === 'member' ? 'loan' : 'attendance';
    
    // Lưu loại quét
    activeScans.set(user.id, { 
      scanType, 
      timestamp: Date.now(),
      cardId
    });
    
    // // Tạo response thành công để gửi về ESP32
    // const response = {
    //   status: 'success',
    //   user: user.name,
    //   userId: user.id,
    //   action: 'check-in', // hoặc logic phức tạp hơn để xác định check-in/out
    //   scanType: scanType,
    //   message: 'User found successfully'
    // };
    
    // // Gửi response về ESP32 qua MQTT
    // if (mqttClient) {
    //   mqttClient.publish('library/response', JSON.stringify(response));
    //   console.log(`📤 Đã gửi response về ESP32:`, response);
    // } else {
    //   console.log(`⚠️ MQTT client chưa được set, không thể gửi response về ESP32`);
    // }
    
    // Gửi thông báo qua Socket.IO cho frontend
    io.emit(CARD_SCANNED, { 
      cardId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      scanType
    });
    
    console.log(`✅ Người dùng ${user.name} (${user.id}) đã quét thẻ ${cardId} cho ${scanType}`);
    
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý quét thẻ ${cardId}:`, error.message);
    
    // Tạo error response để gửi về ESP32
    const errorResponse = {
      status: 'error',
      cardId: cardId,
      message: error.message.includes('Không tìm thấy') || error.message.includes('not found') 
        ? 'User not found' 
        : 'System error'
    };
    
    // Gửi error response về ESP32 qua MQTT
    if (mqttClient) {
      mqttClient.publish('library/response', JSON.stringify(errorResponse));
      console.log(`📤 Đã gửi error response về ESP32:`, errorResponse);
    }
    
    // Gửi error qua Socket.IO cho frontend
    io.emit(CARD_SCAN_ERROR, { 
      cardId: cardId,
      message: error.message 
    });
  }
}

/**
 * Xử lý quét sách
 * @param {string} message - Message JSON từ ESP32
 * @param {object} io - Socket.IO instance
 */
async function handleBookScan(message, io) {
  let rfidTag = '';
  
  try {
    // Parse JSON message từ ESP32
    const data = JSON.parse(message);
    rfidTag = data.uid; // Đối với sách, uid chính là RFID tag
    
    console.log(`📚 Xử lý quét sách với RFID: ${rfidTag}`);
    
    // Lấy thông tin sách
    const book = await bookService.getBookByRfidTag(rfidTag);
    
    console.log(`✅ Tìm thấy sách: "${book.title}" (ID: ${book.id})`);
    
    // Tạo response thành công để gửi về ESP32
    const response = {
      status: 'success',
      book: book.title,
      bookId: book.id,
      author: book.author,
      available: book.available,
      message: 'Book found successfully'
    };
    
    // Gửi response về ESP32 qua MQTT
    if (mqttClient) {
      mqttClient.publish('library/response', JSON.stringify(response));
      console.log(`📤 Đã gửi book response về ESP32:`, response);
    }
    
    // Gửi thông báo qua Socket.IO cho frontend
    io.emit(BOOK_SCANNED, { 
      rfidTag,
      bookId: book.id,
      title: book.title,
      author: book.author,
      available: book.available
    });
    
    console.log(`✅ Sách "${book.title}" (${book.id}) đã được quét với RFID ${rfidTag}`);
    
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý quét sách ${rfidTag}:`, error.message);
    
    // Tạo error response để gửi về ESP32
    const errorResponse = {
      status: 'error',
      rfidTag: rfidTag,
      message: error.message.includes('Không tìm thấy') || error.message.includes('not found')
        ? 'Book not found'
        : 'System error'
    };
    
    // Gửi error response về ESP32 qua MQTT
    if (mqttClient) {
      mqttClient.publish('library/response', JSON.stringify(errorResponse));
      console.log(`📤 Đã gửi book error response về ESP32:`, errorResponse);
    }
    
    // Gửi error qua Socket.IO cho frontend
    io.emit(BOOK_SCAN_ERROR, { 
      rfidTag: rfidTag,
      message: error.message 
    });
  }
}

/**
 * Xóa thông tin người dùng đang hoạt động sau một khoảng thời gian
 * @param {string} userId - ID của người dùng
 * @param {number} timeout - Thời gian timeout (ms)
 */
function clearActiveUserAfterTimeout(userId, timeout = 60000) {
  setTimeout(() => {
    const userScan = activeScans.get(userId);
    if (userScan) {
      activeScans.delete(userId);
      activeUsers.delete(userScan.cardId);
      console.log(`🧹 Đã xóa thông tin quét của người dùng ${userId} sau ${timeout}ms`);
    }
  }, timeout);
}

/**
 * Lấy thông tin người dùng đang hoạt động
 * @param {string} cardId - ID của thẻ
 * @returns {number|null} User ID hoặc null
 */
function getActiveUser(cardId) {
  return activeUsers.get(cardId) || null;
}

/**
 * Lấy thông tin quét đang hoạt động
 * @param {number} userId - ID của người dùng
 * @returns {object|null} Thông tin quét hoặc null
 */
function getActiveScan(userId) {
  return activeScans.get(userId) || null;
}

module.exports = {
  handleCardScan,
  handleBookScan,
  activeUsers,
  activeScans,
  clearActiveUserAfterTimeout,
  getActiveUser,
  getActiveScan,
  setMqttClient
};