// library-fe/src/components/BorrowBook.js (FIXED VERSION)
import React, { useState, useEffect } from "react";
import socket from "../socket";
import "../styles/BorrowBook.css";

const BorrowBook = () => {
  const [userCard, setUserCard] = useState(null);
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [message, setMessage] = useState("");
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for card scan từ MQTT
    socket.on("card_scanned", async (data) => {
      console.log("📱 Card scanned:", data);
      
      // ✅ FIX: Chỉ xử lý khi có scanType là 'loan' hoặc không có scanType
      if (data.scanType && data.scanType !== 'loan') {
        console.log("⚠️ Skipping non-loan scan type in BorrowBook component");
        return;
      }
      
      // Verify user đã check-in chưa
      setLoading(true);
      try {
        // ✅ FIX: Lấy userId từ data đúng cách
        const userId = data.userId || data.user?.id;
        
        if (!userId) {
          setMessage("Không tìm thấy thông tin người dùng từ thẻ!");
          setLoading(false);
          return;
        }

        console.log(`📋 Verifying check-in for user ID: ${userId}`);

        const response = await fetch(`http://localhost:5000/api/attendance/verify-checkin/${userId}`);
        const result = await response.json();
        
        console.log('📩 Response from verify-checkin:', result);

        if (result.success && result.isCheckedIn) {
          setUserCard({
            cardId: data.cardId,
            user: {
              id: userId,
              name: data.userName || data.user?.name,
              role: data.userRole || data.user?.role || 'member'
            }
          });
          setIsCheckedIn(true);
          setMessage(`Xin chào ${data.userName || data.user?.name}! Vui lòng quét sách cần mượn.`);
        } else {
          setUserCard({
            cardId: data.cardId,
            user: {
              id: userId,
              name: data.userName || data.user?.name,
              role: data.userRole || data.user?.role || 'member'
            }
          });
          setIsCheckedIn(false);
          setMessage("⚠️ Vui lòng check-in trước khi mượn sách! Hãy đến khu vực Check-in/Check-out để điểm danh.");
        }
      } catch (error) {
        console.error("Error verifying check-in:", error);
        setMessage("❌ Lỗi kiểm tra trạng thái check-in! Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    });

    // Listen for book scan
    socket.on("book_scanned", (data) => {
      console.log("📚 Book scanned:", data);
      
      if (userCard && isCheckedIn) {
        const bookExists = borrowedBooks.find(b => b.id === data.bookId);
        if (!bookExists) {
          setBorrowedBooks(prev => [...prev, {
            id: data.bookId,
            title: data.book,
            author: data.author,
            rfidTag: data.rfidTag,
            available: data.available
          }]);
          setMessage(`✅ Đã thêm: ${data.book}`);
        } else {
          setMessage("⚠️ Sách này đã được quét!");
        }
      } else if (userCard && !isCheckedIn) {
        setMessage("❌ Vui lòng check-in trước khi mượn sách!");
      } else {
        setMessage("❌ Vui lòng quét thẻ thành viên trước!");
      }
    });

    return () => {
      socket.off("card_scanned");
      socket.off("book_scanned");
    };
  }, [userCard, isCheckedIn, borrowedBooks]);

  const handleCompleteBorrow = async () => {
    if (!userCard || borrowedBooks.length === 0) {
      alert("Vui lòng quét thẻ và ít nhất một cuốn sách!");
      return;
    }

    if (!isCheckedIn) {
      alert("Vui lòng check-in trước khi mượn sách!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/loans/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userCard.user.id,
          cardId: userCard.cardId,
          books: borrowedBooks.map(book => ({
            bookId: book.id,
            rfidTag: book.rfidTag
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📋 Borrow response:', result);

        setMessage("✅ Mượn sách thành công!");
        
        // Reset sau 3 giây
        setTimeout(() => {
          setUserCard(null);
          setBorrowedBooks([]);
          setMessage("");
          setIsCheckedIn(false);
        }, 3000);
      } else {
        const error = await response.json();
        alert(`❌ Lỗi: ${error.message || "Mượn sách thất bại!"}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Có lỗi xảy ra khi mượn sách!");
    } finally {
      setLoading(false);
    }
  };

  const removeBook = (bookId) => {
    setBorrowedBooks(prev => prev.filter(b => b.id !== bookId));
    setMessage("📚 Đã xóa sách khỏi danh sách mượn");
  };

  const resetSession = () => {
    setUserCard(null);
    setBorrowedBooks([]);
    setMessage("");
    setIsCheckedIn(false);
  };

  return (
    <div className="borrow-book">
      <h1>📚 Mượn Sách Thư Viện</h1>
      
      {/* Status */}
      <div className="socket-status">
        <span className={`status-dot ${socket.connected ? 'connected' : 'disconnected'}`}></span>
        {socket.connected ? 'Đã kết nối' : 'Mất kết nối'}
      </div>

      {/* Message */}
      {message && (
        <div className={`message ${message.includes('Lỗi') || message.includes('❌') || message.includes('⚠️') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* User Info */}
      <div className="user-section">
        <h3>👤 Thông tin người mượn:</h3>
        {userCard ? (
          <div className="user-info">
            <p><strong>Họ tên:</strong> {userCard.user.name}</p>
            <p><strong>Vai trò:</strong> {userCard.user.role}</p>
            <p><strong>Card ID:</strong> {userCard.cardId}</p>
            <p><strong>Trạng thái:</strong> 
              <span className={isCheckedIn ? 'checked-in' : 'not-checked-in'}>
                {isCheckedIn ? ' ✅ Đã check-in - Có thể mượn sách' : ' ❌ Chưa check-in - Cần check-in trước'}
              </span>
            </p>
            {!isCheckedIn && (
              <div className="warning-box">
                <p>⚠️ <strong>Lưu ý:</strong> Bạn cần check-in tại khu vực "Check-in/Check-out" trước khi mượn sách.</p>
              </div>
            )}
          </div>
        ) : (
          <p className="instruction">🏷️ Vui lòng quét thẻ thành viên để bắt đầu...</p>
        )}
        
        {userCard && (
          <button 
            className="btn btn-reset"
            onClick={resetSession}
            style={{ marginTop: '10px' }}
          >
            🔄 Đổi người mượn
          </button>
        )}
      </div>

      {/* Books List */}
      <div className="books-section">
        <h3>📖 Sách đã quét:</h3>
        {borrowedBooks.length > 0 ? (
          <div className="books-list">
            {borrowedBooks.map((book, index) => (
              <div key={book.id} className="book-item">
                <span className="book-index">{index + 1}.</span>
                <div className="book-info">
                  <strong>{book.title}</strong>
                  <span className="author"> - {book.author}</span>
                  <span className={`availability ${book.available > 0 ? 'available' : 'unavailable'}`}>
                    (Còn {book.available} cuốn)
                  </span>
                </div>
                <button 
                  className="remove-btn"
                  onClick={() => removeBook(book.id)}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="instruction">
            {userCard && isCheckedIn 
              ? "📚 Chưa có sách nào được quét. Hãy quét sách muốn mượn."
              : "⚠️ Vui lòng quét thẻ và check-in trước."
            }
          </p>
        )}
      </div>

      {/* Action Button */}
      {borrowedBooks.length > 0 && isCheckedIn && (
        <button 
          className="complete-btn"
          onClick={handleCompleteBorrow}
          disabled={loading}
        >
          {loading ? '⏳ Đang xử lý...' : `✅ Hoàn tất mượn ${borrowedBooks.length} cuốn sách`}
        </button>
      )}

      {/* Instructions */}
      {!userCard && (
        <div className="instructions">
          <h3>📋 Hướng dẫn mượn sách:</h3>
          <ol>
            <li>🏷️ <strong>Check-in:</strong> Đến khu vực "Check-in/Check-out" để điểm danh</li>
            <li>📱 <strong>Quét thẻ:</strong> Quét thẻ thành viên tại khu vực mượn sách</li>
            <li>📚 <strong>Quét sách:</strong> Quét từng cuốn sách muốn mượn</li>
            <li>✅ <strong>Hoàn tất:</strong> Nhấn "Hoàn tất mượn sách"</li>
          </ol>
          
          <div className="note">
            <p><strong>📝 Lưu ý quan trọng:</strong></p>
            <ul>
              <li>Bạn <strong>phải check-in</strong> trước khi mượn sách</li>
              <li>Mỗi lần chỉ được mượn tối đa 5 cuốn sách</li>
              <li>Thời hạn mượn là 14 ngày</li>
            </ul>
          </div>
        </div>
      )}

      <style jsx>{`
        .borrow-book {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .socket-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background-color: #28a745;
        }

        .status-dot.disconnected {
          background-color: #dc3545;
        }

        .message {
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .message.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .user-section, .books-section, .instructions {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .user-info p {
          margin: 8px 0;
        }

        .checked-in {
          color: #28a745;
          font-weight: bold;
        }

        .not-checked-in {
          color: #dc3545;
          font-weight: bold;
        }

        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
        }

        .instruction {
          color: #6c757d;
          font-style: italic;
        }

        .books-list {
          margin-top: 15px;
        }

        .book-item {
          display: flex;
          align-items: center;
          padding: 10px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .book-index {
          margin-right: 10px;
          font-weight: bold;
        }

        .book-info {
          flex: 1;
        }

        .author {
          color: #6c757d;
        }

        .availability {
          margin-left: 10px;
          font-size: 14px;
        }

        .availability.available {
          color: #28a745;
        }

        .availability.unavailable {
          color: #dc3545;
        }

        .remove-btn, .btn-reset {
          background: none;
          border: 1px solid #ccc;
          cursor: pointer;
          font-size: 14px;
          padding: 5px 10px;
          border-radius: 4px;
        }

        .complete-btn {
          width: 100%;
          padding: 12px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .complete-btn:hover:not(:disabled) {
          background-color: #218838;
        }

        .complete-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .note {
          background: #e9ecef;
          padding: 15px;
          border-radius: 4px;
          margin-top: 15px;
        }
      `}</style>
    </div>
  );
};

export default BorrowBook;