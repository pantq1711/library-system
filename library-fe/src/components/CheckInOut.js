import React, { useState, useEffect, useRef } from "react";
import socket from "../socket";
import "../styles/CheckInOut.css";
import CheckInList from './CheckInList';


function CheckInOut() {
  // States
  const [cardId, setCardId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [faceImage, setFaceImage] = useState(null);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Camera states
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Prevent duplicate processing
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset all states
  const resetStates = () => {
    setCardId(null);
    setUserInfo(null);
    setMessage("");
    setFaceImage(null);
    setResult("");
    setIsLoading(false);
    stopCamera();
  };

  // Socket.IO Setup
  useEffect(() => {
    console.log("🔌 Setting up Socket.IO connection...");
    
    // Connection events
    socket.on('connect', () => {
      console.log("✅ Socket connected successfully");
    });
    
    socket.on('disconnect', (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setMessage("Kết nối bị gián đoạn. Vui lòng thử lại.");
    });

    // Card scanned event
    const handleCardScanned = async (data) => {
      if (isProcessing) {
        console.log("⚠️ Already processing, skipping...");
        return;
      }
      
      setIsProcessing(true);
      console.log("📱 Received card data:", data);
      
      // Auto-reset processing after 5 seconds to prevent stuck
      setTimeout(() => {
        setIsProcessing(false);
        console.log("🔄 Auto-reset processing flag");
      }, 5000);
      
      const card = data.cardId;
      setCardId(card);
      resetStates();
      setMessage("Đang kiểm tra thẻ RFID...");

      try {
        const response = await fetch("http://localhost:5000/api/attendance/card-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card }),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log("✅ API Response:", responseData);

          if (responseData.success) {
            setUserInfo(responseData.user);
            setMessage("Thẻ hợp lệ. Vui lòng xác thực khuôn mặt.");
          } else {
            setMessage(responseData.message || "Có lỗi xảy ra.");
          }
        } else {
          setMessage("Thẻ không hợp lệ hoặc không tìm thấy người dùng.");
        }
      } catch (error) {
        console.error("❌ API Error:", error);
        setMessage("Có lỗi xảy ra khi kiểm tra thẻ.");
      } finally {
        setIsProcessing(false);
      }
    };

    // Attendance update event
    const handleAttendanceUpdate = (data) => {
      console.log("📝 Attendance update:", data);
      setResult(`${data.action === 'check-in' ? 'Check-in' : 'Check-out'} thành công!`);
      setMessage("");
      stopCamera();
    };

    // Register events
    socket.on("card_scanned", handleCardScanned);
    socket.on("attendance_update", handleAttendanceUpdate);

    // Cleanup
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off("card_scanned", handleCardScanned);
      socket.off("attendance_update", handleAttendanceUpdate);
    };
  }, [isProcessing]);

  // Camera Functions
  const startCamera = async () => {
    try {
      console.log("📷 Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOn(true);
        console.log("✅ Camera started successfully");
      }
    } catch (error) {
      console.error("❌ Camera error:", error);
      alert("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      console.log("📷 Stopping camera...");
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraOn(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      console.log("📸 Capturing image...");
      const context = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      // Draw image from video
      context.drawImage(videoRef.current, 0, 0);
      
      // Convert to base64
      const imageData = canvasRef.current.toDataURL("image/jpeg", 0.8);
      setFaceImage(imageData);
      console.log("✅ Image captured successfully");
    }
  };

  // Face Authentication
  const handleFaceAuth = async (e) => {
    e.preventDefault();
    
    if (!faceImage) {
      alert("Vui lòng chụp ảnh khuôn mặt trước.");
      return;
    }

    if (!userInfo) {
      alert("Không tìm thấy thông tin người dùng.");
      return;
    }

    setIsLoading(true);
    console.log("🔐 Processing face authentication...");

    try {
      const response = await fetch("http://localhost:5000/api/attendance/face-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: userInfo.id, 
          faceImage: faceImage 
        }),
      });

      const data = await response.json();
      console.log("✅ Face auth response:", data);

      if (data.success) {
        setResult(data.message);
        setMessage("");
        stopCamera();
      } else {
        alert(data.message || "Xác thực khuôn mặt thất bại.");
      }
    } catch (error) {
      console.error("❌ Face auth error:", error);
      alert("Có lỗi khi xác thực khuôn mặt.");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear result and reset for new scan
  const handleNewScan = () => {
    resetStates();
  };

  return (
    <div className="check-in-out">
      <h1>Check-in/Check-out</h1>

      {/* RFID Section */}
      <div className="rfid-section">
        <h3>Bước 1: Quét thẻ RFID</h3>
        <div className="rfid-box">
          <label>Quét thẻ RFID:</label>
          <div className="rfid-display">
            {cardId || "Vui lòng quét thẻ vào ô này"}
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="message-section">
          <p className="message">{message}</p>
        </div>
      )}

      {/* User Info Section */}
      {userInfo && !result && (
        <div className="user-section">
          <h3>Bước 2: Thông tin người dùng</h3>
          <div className="user-info">
            <p><strong>Họ tên:</strong> {userInfo.name}</p>
            <p><strong>Email:</strong> {userInfo.email}</p>
            <p><strong>Role:</strong> {userInfo.role}</p>
          </div>
        </div>
      )}

      {/* Camera Section */}
      {userInfo && !result && (
        <div className="camera-section">
          <h3>Bước 3: Xác thực khuôn mặt</h3>
          
          <div className="camera-container">
            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ 
                display: isCameraOn ? "block" : "none", 
                width: "100%", 
                maxWidth: "400px",
                transform: "scaleX(-1)",
                border: "2px solid #ddd",
                borderRadius: "8px"
              }}
            />
            
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
            
            {/* Captured image preview */}
            {faceImage && (
              <div className="captured-image">
                <h4>Ảnh đã chụp:</h4>
                <img
                  src={faceImage}
                  alt="Captured face"
                  style={{ 
                    width: "100%", 
                    maxWidth: "400px", 
                    marginTop: "10px",
                    border: "2px solid #28a745",
                    borderRadius: "8px"
                  }}
                />
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="camera-controls">
            {!isCameraOn ? (
              <button 
                type="button" 
                onClick={startCamera} 
                className="btn btn-primary"
              >
                📷 Mở camera
              </button>
            ) : (
              <div className="camera-buttons">
                <button 
                  type="button" 
                  onClick={captureImage} 
                  className="btn btn-success"
                >
                  📸 Chụp ảnh
                </button>
                <button 
                  type="button" 
                  onClick={stopCamera} 
                  className="btn btn-secondary"
                >
                  ❌ Tắt camera
                </button>
              </div>
            )}
          </div>

          {/* Face Auth Button */}
          {faceImage && (
            <div className="auth-section">
              <button 
                onClick={handleFaceAuth}
                disabled={isLoading || !faceImage}
                className="btn btn-auth"
              >
                {isLoading ? "⏳ Đang xác thực..." : "🔐 Xác thực khuôn mặt"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Đang xác thực khuôn mặt...</p>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="result-section">
          <h3>✅ Kết quả</h3>
          <p className="result success">{result}</p>
          <button 
            onClick={handleNewScan}
            className="btn btn-new-scan"
          >
            🔄 Quét thẻ mới
          </button>
        </div>
      )}
<CheckInList />
      {/* Debug Info */}
      <div className="debug-info" style={{ marginTop: "20px", fontSize: "12px", color: "#666" }}>
        <p>🔌 Socket: {socket.connected ? "Connected" : "Disconnected"}</p>
        <p>📱 Card ID: {cardId || "None"}</p>
        <p>👤 User: {userInfo ? userInfo.name : "None"}</p>
        <p>📷 Camera: {isCameraOn ? "ON" : "OFF"}</p>
        <p>🖼️ Image: {faceImage ? "Captured" : "None"}</p>
      </div>
    </div>
  );
}

export default CheckInOut;