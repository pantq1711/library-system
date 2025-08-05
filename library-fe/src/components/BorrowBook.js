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
      
      if (data.scanType === 'loan') {
        // Verify user đã check-in chưa
        setLoading(true);
        try {
          const response = await fetch(`http://localhost:5000/api/attendance/verify-checkin/${data.userId}`);
          const result = await response.json();
          console.log('📩 Response from verify-checkin:', result); // ⬅️ DÒNG CẦN ĐẶT ĐÂY

          if (result.isCheckedIn) {
            setUserCard({
              cardId: data.cardId,
              user: {
                id: data.userId,
                name: data.userName,
                role: data.userRole
              }
            });
            setIsCheckedIn(true);
            setMessage(`Xin chào ${data.userName}! Vui lòng quét sách cần mượn.`);
          } else {
            setMessage("Vui lòng check-in trước khi mượn sách!");
            setIsCheckedIn(false);
          }
        } catch (error) {
          console.error("Error verifying check-in:", error);
          setMessage("Lỗi kiểm tra trạng thái check-in!");
        } finally {
          setLoading(false);
        }
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
          setMessage(`Đã thêm: ${data.book}`);
        } else {
          setMessage("Sách này đã được quét!");
        }
      } else {
        setMessage("Vui lòng quét thẻ thành viên trước!");
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
        // console.log('📩 Response from verify-checkin:', result);

        setMessage("Mượn sách thành công!");
        
        // Reset sau 3 giây
        setTimeout(() => {
          setUserCard(null);
          setBorrowedBooks([]);
          setMessage("");
          setIsCheckedIn(false);
        }, 3000);
      } else {
        const error = await response.json();
        alert(error.message || "Mượn sách thất bại!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Có lỗi xảy ra khi mượn sách!");
    } finally {
      setLoading(false);
    }
  };

  const removeBook = (bookId) => {
    setBorrowedBooks(prev => prev.filter(b => b.id !== bookId));
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
        <div className={`message ${message.includes('Lỗi') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* User Info */}
      <div className="user-section">
        <h3>Thông tin người mượn:</h3>
        {userCard ? (
          <div className="user-info">
            <p><strong>Họ tên:</strong> {userCard.user.name}</p>
            <p><strong>Vai trò:</strong> {userCard.user.role}</p>
            <p><strong>Trạng thái:</strong> 
              <span className={isCheckedIn ? 'checked-in' : 'not-checked-in'}>
                {isCheckedIn ? ' ✅ Đã check-in' : ' ❌ Chưa check-in'}
              </span>
            </p>
          </div>
        ) : (
          <p className="instruction">Vui lòng quét thẻ thành viên để bắt đầu...</p>
        )}
      </div>

      {/* Books List */}
      <div className="books-section">
        <h3>Sách đã quét:</h3>
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
          <p className="instruction">Chưa có sách nào được quét.</p>
        )}
      </div>

      {/* Action Button */}
      {borrowedBooks.length > 0 && (
        <button 
          className="complete-btn"
          onClick={handleCompleteBorrow}
          disabled={loading}
        >
          {loading ? 'Đang xử lý...' : '✅ Hoàn tất mượn sách'}
        </button>
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

        .user-section, .books-section {
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
        }

        .not-checked-in {
          color: #dc3545;
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

        .remove-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
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
      `}</style>
    </div>
  );
};

export default BorrowBook;