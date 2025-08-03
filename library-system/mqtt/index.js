/**
 * Khởi tạo kết nối MQTT
 */

const mqtt = require('mqtt');
const { handleCardScan, handleBookScan, setMqttClient } = require('./handlers');
const { CARD_TOPIC, BOOK_TOPIC } = require('./topics');

/**
 * Thiết lập kết nối MQTT và xử lý tin nhắn
 * @param {object} io - Socket.IO instance
 * @returns {object} MQTT client
 */
function setupMQTT(io) {
  const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com', {
    clientId: process.env.MQTT_CLIENT_ID || `library_system_${Math.random().toString(16).substr(2, 8)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clean: true
  });

  mqttClient.on('connect', () => {
    console.log('✅ Kết nối MQTT thành công');
    console.log(`📡 Broker: ${process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com'}`);
    console.log(`🆔 Client ID: ${process.env.MQTT_CLIENT_ID || 'auto-generated'}`);
    
    // Set MQTT client cho handlers để có thể gửi response
    setMqttClient(mqttClient);
    
    // Đăng ký các topic
    mqttClient.subscribe(CARD_TOPIC, (err) => {
      if (!err) {
        console.log(`📡 Đã đăng ký topic ${CARD_TOPIC}`);
      } else {
        console.error(`❌ Lỗi khi đăng ký topic ${CARD_TOPIC}:`, err);
      }
    });
    
    mqttClient.subscribe(BOOK_TOPIC, (err) => {
      if (!err) {
        console.log(`📡 Đã đăng ký topic ${BOOK_TOPIC}`);
      } else {
        console.error(`❌ Lỗi khi đăng ký topic ${BOOK_TOPIC}:`, err);
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    const messageStr = message.toString();
    console.log(`📨 Nhận tin nhắn từ topic ${topic}: ${messageStr}`);
    
    try {
      if (topic === CARD_TOPIC) {
        handleCardScan(messageStr, io);
      } else if (topic === BOOK_TOPIC) {
        handleBookScan(messageStr, io);
      }
    } catch (error) {
      console.error(`❌ Lỗi khi xử lý message từ topic ${topic}:`, error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ Lỗi kết nối MQTT:', error);
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Đang kết nối lại MQTT...');
  });

  mqttClient.on('close', () => {
    console.log('❌ Kết nối MQTT đã đóng');
  });

  return mqttClient;
}

module.exports = { setupMQTT };