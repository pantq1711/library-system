// library-fe/src/components/UserUpdate.js (Updated with Face Upload)
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/UserUpdate.css";

function UserUpdate() {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    phone: "",
    address: "",
    isActive: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Face Recognition States
  const [facePhoto, setFacePhoto] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceStatus, setFaceStatus] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Lấy thông tin user
    fetch(`http://localhost:5000/api/users/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch user details");
        }
        return response.json();
      })
      .then((data) => {
        setFormData(data.data);
        setLoading(false);
        // Kiểm tra trạng thái khuôn mặt
        checkFaceRegistration();
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Kiểm tra trạng thái đăng ký khuôn mặt
  const checkFaceRegistration = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/face/status/${id}`);
      const data = await response.json();
      if (data.success && data.faceData) {
        setFaceStatus('registered');
        setFaceMessage('✅ Đã đăng ký khuôn mặt');
      } else {
        setFaceStatus('not_registered');
        setFaceMessage('❌ Chưa đăng ký khuôn mặt');
      }
    } catch (error) {
      console.error('Lỗi kiểm tra trạng thái:', error);
      setFaceMessage('❓ Không thể kiểm tra trạng thái');
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
      setFaceMessage('📷 Camera đã sẵn sàng, ấn "Chụp ảnh" để chụp');
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
      setFaceMessage('📸 Đã chụp ảnh, ấn "Cập nhật khuôn mặt" để lưu');
    }, 'image/jpeg', 0.8);
    
    stopCamera();
  };

  // Upload ảnh từ file
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFacePhoto(file);
      setFaceMessage('📁 Đã chọn ảnh, ấn "Cập nhật khuôn mặt" để lưu');
    } else {
      alert('Vui lòng chọn file ảnh!');
    }
  };

  // Cập nhật khuôn mặt
  const updateFace = async () => {
    if (!facePhoto) {
      alert('Vui lòng chụp ảnh hoặc chọn file ảnh!');
      return;
    }

    setUploadingFace(true);
    const formDataFace = new FormData();
    formDataFace.append('image', facePhoto);
    formDataFace.append('description', `Ảnh khuôn mặt của ${formData.name}`);

    try {
      const response = await fetch(`http://localhost:5000/api/face/register/${id}`, {
        method: 'POST',
        body: formDataFace
      });

      const data = await response.json();
      if (data.success) {
        setFaceMessage('✅ Cập nhật khuôn mặt thành công!');
        setFaceStatus('registered');
        setFacePhoto(null);
        
        // Refresh trạng thái sau 2 giây
        setTimeout(() => {
          checkFaceRegistration();
        }, 2000);
      } else {
        setFaceMessage(`❌ Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật:', error);
      setFaceMessage('❌ Có lỗi xảy ra khi cập nhật');
    } finally {
      setUploadingFace(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Cập nhật thành viên thành công!");
        navigate("/members");
      } else {
        alert("Cập nhật thành viên thất bại!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Có lỗi xảy ra!");
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="user-update">
      <h1>✏️ Cập nhật thông tin thành viên</h1>
      
      {/* Basic Information Form */}
      <div className="form-section">
        <h2>📝 Thông tin cơ bản</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Tên:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Vai trò:</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="admin">Admin</option>
                <option value="librarian">Librarian</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div className="form-group">
              <label>Số điện thoại:</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Địa chỉ:</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              Trạng thái hoạt động
            </label>
          </div>
          
          <button type="submit" className="btn btn-submit">
            💾 Cập nhật thông tin
          </button>
        </form>
      </div>

      {/* Face Recognition Section */}
      <div className="face-section">
        <h2>🤳 Quản lý khuôn mặt</h2>
        
        {/* Face Status */}
        <div className={`face-status ${faceStatus}`}>
          <p>{faceMessage}</p>
        </div>

        {/* Camera Controls */}
        <div className="camera-controls">
          {!isCameraOn && !facePhoto ? (
            <button className="btn btn-camera" onClick={startCamera}>
              📷 Bật Camera
            </button>
          ) : null}
          
          {isCameraOn && !facePhoto ? (
            <div className="camera-actions">
              <button className="btn btn-capture" onClick={capturePhoto}>
                📸 Chụp ảnh
              </button>
              <button className="btn btn-stop" onClick={stopCamera}>
                ❌ Tắt Camera
              </button>
            </div>
          ) : null}
        </div>

        {/* Video Preview */}
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

        {/* File Upload */}
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

        {/* Photo Preview */}
        {facePhoto && (
          <div className="photo-preview">
            <h4>Ảnh đã chọn:</h4>
            <img 
              src={URL.createObjectURL(facePhoto)} 
              alt="Face preview"
              className="preview-image"
            />
            
            <div className="photo-actions">
              <button 
                className="btn btn-update-face" 
                onClick={updateFace}
                disabled={uploadingFace}
              >
                {uploadingFace ? '⏳ Đang cập nhật...' : '✅ Cập nhật khuôn mặt'}
              </button>
              <button 
                className="btn btn-cancel"
                onClick={() => {
                  setFacePhoto(null);
                  setFaceMessage(faceStatus === 'registered' ? '✅ Đã đăng ký khuôn mặt' : '❌ Chưa đăng ký khuôn mặt');
                }}
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Navigation */}
      <div className="navigation">
        <button className="btn btn-back" onClick={() => navigate("/members")}>
          ← Quay lại danh sách
        </button>
      </div>
    </div>
  );
}

export default UserUpdate;