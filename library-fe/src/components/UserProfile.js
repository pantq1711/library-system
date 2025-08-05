// library-fe/src/components/UserProfile.js
import React, { useState, useRef, useEffect } from 'react';
import '../styles/UserProfile.css';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [facePhoto, setFacePhoto] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Lấy thông tin user từ localStorage hoặc API
    const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (userData.id) {
      setUser(userData);
      checkFaceRegistration(userData.id);
    }
  }, []);

  // Kiểm tra xem user đã đăng ký khuôn mặt chưa
  const checkFaceRegistration = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/face/status/${userId}`);
      const data = await response.json();
      if (data.success && data.faceData) {
        setMessage('✅ Đã đăng ký khuôn mặt');
      } else {
        setMessage('❌ Chưa đăng ký khuôn mặt');
      }
    } catch (error) {
      console.error('Lỗi kiểm tra trạng thái:', error);
    }
  };

  // Bật camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      videoRef.current.srcObject = stream;
      setIsCameraOn(true);
    } catch (error) {
      console.error('Lỗi khi bật camera:', error);
      alert('Không thể truy cập camera!');
    }
  };

  // Tắt camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  // Chụp ảnh từ camera
  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      setFacePhoto(blob);
      setMessage('Đã chụp ảnh, ấn "Đăng ký khuôn mặt" để lưu');
    }, 'image/jpeg', 0.8);
    
    stopCamera();
  };

  // Upload ảnh từ file
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFacePhoto(file);
      setMessage('Đã chọn ảnh, ấn "Đăng ký khuôn mặt" để lưu');
    } else {
      alert('Vui lòng chọn file ảnh!');
    }
  };

  // Đăng ký khuôn mặt
  const registerFace = async () => {
    if (!facePhoto || !user) {
      alert('Vui lòng chụp ảnh hoặc chọn file ảnh!');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('image', facePhoto);
    formData.append('description', 'Ảnh khuôn mặt người dùng');

    try {
      const response = await fetch(`http://localhost:5000/api/face/register/${user.id}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Đăng ký khuôn mặt thành công!');
        setFacePhoto(null);
      } else {
        setMessage(`❌ Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error('Lỗi khi đăng ký:', error);
      setMessage('❌ Có lỗi xảy ra khi đăng ký');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return <div>Vui lòng đăng nhập để sử dụng chức năng này</div>;
  }

  return (
    <div className="user-profile">
      <h2>👤 Hồ Sơ Người Dùng</h2>
      
      {/* Thông tin user */}
      <div className="user-info-section">
        <h3>Thông tin cá nhân</h3>
        <p><strong>Họ tên:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Vai trò:</strong> {user.role}</p>
      </div>

      {/* Đăng ký khuôn mặt */}
      <div className="face-registration-section">
        <h3>🤳 Đăng ký khuôn mặt</h3>
        <p className="status-message">{message}</p>

        {/* Camera controls */}
        <div className="camera-controls">
          {!isCameraOn ? (
            <button className="btn-camera" onClick={startCamera}>
              📷 Bật Camera
            </button>
          ) : (
            <div className="camera-actions">
              <button className="btn-capture" onClick={capturePhoto}>
                📸 Chụp ảnh
              </button>
              <button className="btn-stop" onClick={stopCamera}>
                ❌ Tắt Camera
              </button>
            </div>
          )}
        </div>

        {/* Video preview */}
        {isCameraOn && (
          <div className="camera-preview">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline
              className="video-preview"
            />
          </div>
        )}

        {/* File upload */}
        <div className="file-upload">
          <label htmlFor="face-upload" className="upload-label">
            📁 Hoặc chọn ảnh từ máy tính
          </label>
          <input 
            id="face-upload"
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>

        {/* Photo preview */}
        {facePhoto && (
          <div className="photo-preview">
            <h4>Ảnh đã chọn:</h4>
            <img 
              src={URL.createObjectURL(facePhoto)} 
              alt="Face preview"
              className="preview-image"
            />
          </div>
        )}

        {/* Register button */}
        {facePhoto && (
          <button 
            className="btn-register" 
            onClick={registerFace}
            disabled={uploading}
          >
            {uploading ? '⏳ Đang đăng ký...' : '✅ Đăng ký khuôn mặt'}
          </button>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default UserProfile;