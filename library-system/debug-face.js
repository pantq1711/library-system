// library-system/debug-face.js
// Script để debug Face-API setup

const { sequelize } = require('./config/database');
const FaceData = require('./models/FaceData');
const User = require('./models/User');
const faceRecognitionService = require('./services/FaceRecognitionService');

async function debugFaceSetup() {
  try {
    console.log('🔍 === DEBUGGING FACE-API SETUP ===');
    
    // 1. Kiểm tra database connection
    console.log('\n1. 📊 Kiểm tra kết nối database...');
    await sequelize.authenticate();
    console.log('✅ Database kết nối thành công');
    
    // 2. Kiểm tra table FaceData
    console.log('\n2. 🗃️ Kiểm tra table FaceData...');
    try {
      const tableExists = await sequelize.getQueryInterface().describeTable('FaceData');
      console.log('✅ Table FaceData tồn tại:', Object.keys(tableExists));
    } catch (error) {
      console.log('❌ Table FaceData KHÔNG tồn tại!');
      console.log('💡 Cần chạy: npm run migrate hoặc tạo table manually');
      console.log('SQL: CREATE TABLE FaceData ...');
      return;
    }
    
    // 3. Kiểm tra Face-API models
    console.log('\n3. 🤖 Kiểm tra Face-API models...');
    const modelsLoaded = await faceRecognitionService.loadModels();
    if (modelsLoaded) {
      console.log('✅ Face-API models tải thành công');
    } else {
      console.log('❌ Face-API models KHÔNG tải được');
      console.log('💡 Kiểm tra internet connection hoặc CDN');
      return;
    }
    
    // 4. Kiểm tra users trong database
    console.log('\n4. 👤 Kiểm tra users...');
    const users = await User.findAll({ limit: 5 });
    console.log(`✅ Tìm thấy ${users.length} users:`, users.map(u => ({ id: u.id, name: u.name })));
    
    // 5. Kiểm tra FaceData records
    console.log('\n5. 🤳 Kiểm tra FaceData records...');
    const faceDataRecords = await FaceData.findAll();
    console.log(`📊 Tìm thấy ${faceDataRecords.length} face data records`);
    
    if (faceDataRecords.length > 0) {
      faceDataRecords.forEach(record => {
        console.log(`- User ${record.userId}: ${record.description} (${record.createdAt})`);
      });
    }
    
    // 6. Test API endpoints
    console.log('\n6. 🌐 Để test API endpoints, chạy:');
    console.log('GET  http://localhost:5000/api/face/setup');
    console.log('GET  http://localhost:5000/api/face/status/1');
    console.log('POST http://localhost:5000/api/face/register/1 (với file ảnh)');
    
    console.log('\n✅ === DEBUG HOÀN TẤT ===');
    
  } catch (error) {
    console.error('❌ Lỗi khi debug:', error);
  } finally {
    await sequelize.close();
  }
}

// Chạy debug nếu file được gọi trực tiếp
if (require.main === module) {
  debugFaceSetup();
}

module.exports = debugFaceSetup;