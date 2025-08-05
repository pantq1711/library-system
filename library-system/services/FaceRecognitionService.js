// library-system/services/FaceRecognitionService.js (Fixed)

const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, loadImage } = canvas;
const fs = require('fs-extra');
const path = require('path');
const User = require('../models/User');
const FaceData = require('../models/FaceData');
const Attendance = require('../models/Attendance');
const { Op } = require('sequelize');

// Cấu hình face-api.js sử dụng canvas
faceapi.env.monkeyPatch({ Canvas, Image });

// Đường dẫn thư mục
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');

// Đảm bảo thư mục tồn tại
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync(path.join(UPLOADS_DIR, 'faces'));

// Ngưỡng so sánh khuôn mặt
const FACE_MATCH_THRESHOLD = 0.5;

class FaceRecognitionService {
  constructor() {
    this.modelsLoaded = false;
  }

  /**
   * Tải models face-api từ local hoặc CDN
   */
  async loadModels() {
    try {
      if (this.modelsLoaded) {
        console.log('✅ Models đã được tải trước đó');
        return true;
      }

      console.log('🔄 Đang tải Face-API models...');
      
      // Thử tải từ local trước
      const modelsPath = path.join(__dirname, '../models/face-api');
      
      try {
        // Tải từ local nếu có
        if (fs.existsSync(modelsPath)) {
          console.log('📁 Tải models từ local:', modelsPath);
          await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
          await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
          await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
        } else {
          // Tải từ CDN
          console.log('🌐 Tải models từ CDN...');
          const MODELS_URI = 'https://justadudewhohacks.github.io/face-api.js/models';
          await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URI);
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URI);
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URI);
        }
      } catch (loadError) {
        console.warn('⚠️ Lỗi tải models, thử CDN fallback:', loadError.message);
        // Fallback to CDN
        const MODELS_URI = 'https://justadudewhohacks.github.io/face-api.js/models';
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URI);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URI);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URI);
      }
      
      console.log('✅ Đã tải thành công các models Face-API');
      this.modelsLoaded = true;
      return true;
    } catch (error) {
      console.error('❌ Lỗi khi tải models Face-API:', error);
      return false;
    }
  }

  /**
   * Load image helper
   */
  async _loadImage(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const img = await loadImage(imageBuffer); // ✅ Đúng
      return img;
    } catch (error) {
      throw new Error(`Không thể tải ảnh: ${error.message}`);
    }
  }

  /**
   * Phát hiện khuôn mặt trong ảnh
   */
  async detectFace(imagePath) {
    try {
      console.log('🔍 Đang phát hiện khuôn mặt trong:', imagePath);
      
      if (!this.modelsLoaded) {
        console.log('📦 Models chưa tải, đang tải...');
        const loaded = await this.loadModels();
        if (!loaded) {
          throw new Error('Không thể tải models Face-API');
        }
      }

      // Kiểm tra file tồn tại
      if (!fs.existsSync(imagePath)) {
        throw new Error(`File ảnh không tồn tại: ${imagePath}`);
      }

      // Tải ảnh
      const img = await this._loadImage(imagePath);
      console.log('📷 Đã tải ảnh thành công, kích thước:', img.width, 'x', img.height);
      
      // Phát hiện khuôn mặt
      const detections = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detections) {
        console.log('❌ Không phát hiện được khuôn mặt trong ảnh');
        return {
          success: false,
          message: 'Không phát hiện khuôn mặt trong ảnh. Vui lòng thử ảnh khác với khuôn mặt rõ ràng hơn.'
        };
      }
      
      console.log('✅ Đã phát hiện khuôn mặt thành công');
      console.log('📊 Face descriptor length:', detections.descriptor.length);
      
      return {
        success: true,
        detection: detections,
        descriptor: Array.from(detections.descriptor)
      };
    } catch (error) {
      console.error('❌ Lỗi khi phát hiện khuôn mặt:', error);
      return {
        success: false,
        message: `Lỗi khi phát hiện khuôn mặt: ${error.message}`
      };
    }
  }

  /**
   * Đăng ký khuôn mặt cho người dùng
   */
  async registerFace(userId, imagePath, description = 'Dữ liệu khuôn mặt') {
    try {
      console.log('📝 Đang đăng ký khuôn mặt cho user:', userId);
      
      // Kiểm tra người dùng tồn tại
      const user = await User.findByPk(userId);
      if (!user) {
        console.log('❌ Không tìm thấy user:', userId);
        return {
          success: false,
          message: 'Không tìm thấy người dùng'
        };
      }

      console.log('👤 Tìm thấy user:', user.name);

      // Phát hiện khuôn mặt
      const detectionResult = await this.detectFace(imagePath);
      if (!detectionResult.success) {
        return detectionResult;
      }

      console.log('💾 Đang lưu dữ liệu khuôn mặt vào database...');

      // Lưu ảnh khuôn mặt vào thư mục uploads/faces
      const facesDir = path.join(UPLOADS_DIR, 'faces');
      const fileName = `face_${userId}_${Date.now()}${path.extname(imagePath)}`;
      const destPath = path.join(facesDir, fileName);
      await fs.copy(imagePath, destPath);

      console.log('💾 Đã sao chép ảnh vào:', destPath);

      // Tìm hoặc tạo bản ghi dữ liệu khuôn mặt
      let faceData = await FaceData.findOne({
        where: { userId: userId }
      });
      
      // Chuẩn bị descriptor array
      let descriptors = [];
      if (faceData) {
        console.log('🔄 Cập nhật dữ liệu khuôn mặt hiện có');
        // Nếu đã có dữ liệu khuôn mặt, parse từ BLOB
        try {
          const existingData = faceData.faceEncoding.toString();
          if (existingData) {
            descriptors = JSON.parse(existingData);
          }
        } catch (e) {
          console.warn('⚠️ Lỗi khi phân tích dữ liệu khuôn mặt cũ:', e);
          descriptors = [];
        }
        
        // Thêm descriptor mới (chỉ giữ 3 descriptor gần nhất)
        descriptors.push(detectionResult.descriptor);
        if (descriptors.length > 3) {
          descriptors = descriptors.slice(-3);
        }
        
        // Cập nhật bản ghi
        faceData.faceEncoding = Buffer.from(JSON.stringify(descriptors));
        faceData.description = description;
        faceData.updatedAt = new Date();
        await faceData.save();
        
        console.log('✅ Đã cập nhật dữ liệu khuôn mặt');
      } else {
        console.log('➕ Tạo mới dữ liệu khuôn mặt');
        // Tạo mới dữ liệu khuôn mặt
        descriptors = [detectionResult.descriptor];
        faceData = await FaceData.create({
          userId: userId,
          faceEncoding: Buffer.from(JSON.stringify(descriptors)),
          description: description
        });
        
        console.log('✅ Đã tạo mới dữ liệu khuôn mặt, ID:', faceData.id);
      }

      return {
        success: true,
        message: 'Đăng ký khuôn mặt thành công',
        totalFaces: descriptors.length,
        faceDataId: faceData.id
      };
    } catch (error) {
      console.error('❌ Lỗi khi đăng ký khuôn mặt:', error);
      return {
        success: false,
        message: `Lỗi khi đăng ký khuôn mặt: ${error.message}`
      };
    }
  }

  /**
   * Kiểm tra trạng thái đăng ký khuôn mặt
   */
  async getFaceRegistrationStatus(userId) {
    try {
      console.log('🔍 Kiểm tra trạng thái khuôn mặt cho user:', userId);
      
      const faceData = await FaceData.findOne({
        where: { userId: userId }
      });
      
      if (faceData) {
        console.log('✅ User đã có dữ liệu khuôn mặt');
        return {
          success: true,
          faceData: {
            id: faceData.id,
            description: faceData.description,
            createdAt: faceData.createdAt,
            updatedAt: faceData.updatedAt
          }
        };
      } else {
        console.log('❌ User chưa có dữ liệu khuôn mặt');
        return {
          success: false,
          message: 'Chưa đăng ký khuôn mặt'
        };
      }
    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra trạng thái:', error);
      return {
        success: false,
        message: `Lỗi khi kiểm tra trạng thái: ${error.message}`
      };
    }
  }

  /**
   * Check-in bằng khuôn mặt
   */
  async checkIn(imagePath) {
    try {
      console.log('🏛️ Đang xử lý check-in bằng khuôn mặt');
      
      // Phát hiện khuôn mặt
      const detectionResult = await this.detectFace(imagePath);
      if (!detectionResult.success) {
        return detectionResult;
      }

      // So sánh với dữ liệu đã đăng ký
      const matchResult = await this.compareFaces(detectionResult.descriptor);
      if (!matchResult.success) {
        return matchResult;
      }

      // Tìm user
      const user = await User.findByPk(matchResult.userId);
      if (!user) {
        return {
          success: false,
          message: 'Không tìm thấy thông tin người dùng'
        };
      }

      // Thực hiện check-in
      const attendance = await Attendance.create({
        userId: user.id,
        checkInTime: new Date(),
        status: 'check-in',
        faceVerified: true,
        cardVerified: false
      });

      console.log('✅ Check-in thành công cho user:', user.name);

      return {
        success: true,
        message: `Check-in thành công! Chào mừng ${user.name}`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        attendance: {
          id: attendance.id,
          checkInTime: attendance.checkInTime
        }
      };
    } catch (error) {
      console.error('❌ Lỗi khi check-in:', error);
      return {
        success: false,
        message: `Lỗi khi check-in: ${error.message}`
      };
    }
  }

  /**
   * So sánh khuôn mặt với dữ liệu đã đăng ký
   */
  async compareFaces(faceDescriptor) {
    try {
      console.log('🔍 Đang so sánh khuôn mặt với database...');
      
      // Lấy tất cả dữ liệu khuôn mặt
      const allFaceData = await FaceData.findAll();
      
      if (allFaceData.length === 0) {
        return {
          success: false,
          message: 'Không có dữ liệu khuôn mặt để so sánh'
        };
      }
      
      console.log('📊 Tìm thấy', allFaceData.length, 'bản ghi khuôn mặt');
      
      // Chuẩn bị dữ liệu khuôn mặt cho việc so sánh
      const labeledDescriptors = [];
      
      for (const faceData of allFaceData) {
        try {
          const encodingString = faceData.faceEncoding.toString();
          const descriptors = JSON.parse(encodingString);
          
          if (descriptors && descriptors.length > 0) {
            const faceDescriptors = descriptors.map(d => new Float32Array(d));
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(faceData.userId.toString(), faceDescriptors)
            );
          }
        } catch (e) {
          console.error(`❌ Lỗi parse dữ liệu khuôn mặt user ${faceData.userId}:`, e);
        }
      }
      
      if (labeledDescriptors.length === 0) {
        return {
          success: false,
          message: 'Không có dữ liệu khuôn mặt hợp lệ để so sánh'
        };
      }
      
      console.log('🎯 So sánh với', labeledDescriptors.length, 'khuôn mặt đã đăng ký');
      
      // Tạo face matcher
      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD);
      
      // So sánh
      const match = faceMatcher.findBestMatch(faceDescriptor);
      
      console.log('📊 Kết quả so sánh:', match.toString());
      
      if (match.label === 'unknown') {
        return {
          success: false,
          message: 'Không nhận diện được khuôn mặt'
        };
      }
      
      return {
        success: true,
        userId: parseInt(match.label),
        distance: match.distance,
        confidence: Math.round((1 - match.distance) * 100)
      };
    } catch (error) {
      console.error('❌ Lỗi khi so sánh khuôn mặt:', error);
      return {
        success: false,
        message: `Lỗi khi so sánh khuôn mặt: ${error.message}`
      };
    }
  }
}

module.exports = new FaceRecognitionService();