// library-fe/src/components/ReturnBook.js (UPDATED VERSION)
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import '../styles/ReturnBook.css';

const ReturnBook = () => {
  const [socket, setSocket] = useState(null);
  const [userCard, setUserCard] = useState(null);
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [returnBooks, setReturnBooks] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('📡 Kết nối Socket.IO thành công');
    });

    // ✅ Lắng nghe sự kiện quét thẻ người dùng cho trả sách
    newSocket.on('card_scanned', async (data) => {
      console.log('👤 User card scanned:', data);
      
      // Chỉ xử lý khi không có scanType hoặc scanType là 'return'
      if (data.scanType && data.scanType !== 'return' && data.scanType !== 'loan') {
        return;
      }

      setLoading(true);
      try {
        // Lấy danh sách sách đang mượn của user
        const response = await fetch(`http://localhost:5000/api/loans/user-active-loans/${data.userId}`);
        
        if (response.ok) {
          const result = await response.json();
          
          setUserCard({
            user: {
              id: data.userId,
              name: data.userName,
              role: data.userRole || 'member'
            },
            cardId: data.cardId || ''
          });
          
          setBorrowedBooks(result.activeLoans || []);
          setMessage(`Xin chào ${data.userName}! Bạn đang mượn ${result.activeLoans?.length || 0} cuốn sách.`);
        } else {
          // Fallback: tạo dummy data nếu API không có
          setUserCard({
            user: {
              id: data.userId,
              name: data.userName,
              role: data.userRole || 'member'
            },
            cardId: data.cardId || ''
          });
          setBorrowedBooks([]);
          setMessage(`Xin chào ${data.userName}! Hiện tại chưa có sách đang mượn.`);
        }
      } catch (error) {
        console.error('Error fetching active loans:', error);
        setMessage('Lỗi khi lấy danh sách sách đang mượn!');
      } finally {
        setLoading(false);
      }
    });

    // ✅ Lắng nghe sự kiện quét sách để trả
    newSocket.on('book_scanned', (data) => {
      console.log('📚 Book scanned for return:', data);
      
      if (userCard && data.rfidTag) {
        handleBookScanned(data.rfidTag, data);
      } else {
        setMessage("Vui lòng quét thẻ thành viên trước!");
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [userCard]);

  const handleBookScanned = (rfidTag, bookData) => {
    // Tìm sách trong danh sách đã mượn
    const borrowedBook = borrowedBooks.find(book => 
      book.Book?.rfidTag === rfidTag || book.rfidTag === rfidTag
    );

    if (borrowedBook) {
      // Kiểm tra xem đã thêm vào danh sách trả chưa
      const alreadyAdded = returnBooks.find(book => 
        book.loanId === borrowedBook.id
      );

      if (!alreadyAdded) {
        const bookToReturn = {
          loanId: borrowedBook.id,
          bookId: borrowedBook.bookId,
          bookTitle: borrowedBook.bookTitle || borrowedBook.Book?.title || bookData.book,
          author: borrowedBook.Book?.author || bookData.author,
          issueDate: borrowedBook.issueDate,
          dueDate: borrowedBook.dueDate,
          rfidTag: rfidTag
        };

        setReturnBooks(prev => [...prev, bookToReturn]);
        setMessage(`✅ Đã thêm "${bookToReturn.bookTitle}" vào danh sách trả sách`);
      } else {
        setMessage(`⚠️ Sách đã có trong danh sách trả rồi!`);
      }
    } else {
      // Nếu không tìm thấy trong danh sách mượn, tạo record tạm thời
      const tempBook = {
        loanId: Date.now(), // temporary ID
        bookId: bookData.bookId || null,
        bookTitle: bookData.book || 'Sách không xác định',
        author: bookData.author || 'Tác giả không xác định',
        issueDate: new Date(),
        dueDate: new Date(),
        rfidTag: rfidTag
      };
      
      setReturnBooks(prev => [...prev, tempBook]);
      setMessage(`⚠️ Đã thêm "${tempBook.bookTitle}" (có thể không phải sách của bạn)`);
    }
  };

  const handleCompleteReturn = async () => {
    if (!userCard || returnBooks.length === 0) {
      alert("Vui lòng quét thẻ và ít nhất một cuốn sách để trả!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/loans/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userCard.user.id,
          books: returnBooks.map(book => ({
            loanId: book.loanId,
            bookId: book.bookId,
            rfidTag: book.rfidTag
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📋 Return response:', result);

        let successMessage = `✅ Trả thành công ${result.returnedBooks?.length || 0} cuốn sách!`;
        
        // Hiển thị thông tin tiền phạt nếu có
        if (result.totalFine > 0) {
          successMessage += `\n💰 Tổng tiền phạt: ${result.totalFine.toLocaleString()} VND`;
        }

        // Hiển thị chi tiết sách trả muộn
        const lateBooks = result.returnedBooks?.filter(book => book.fine > 0);
        if (lateBooks && lateBooks.length > 0) {
          successMessage += '\n📅 Sách trả muộn:';
          lateBooks.forEach(book => {
            successMessage += `\n- ${book.bookTitle}: ${book.daysLate} ngày (${book.fine.toLocaleString()} VND)`;
          });
        }

        setMessage(successMessage);
        
        // Reset sau 8 giây
        setTimeout(() => {
          setUserCard(null);
          setBorrowedBooks([]);
          setReturnBooks([]);
          setMessage("");
        }, 8000);
      } else {
        const error = await response.json();
        alert(`❌ Lỗi: ${error.message}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Có lỗi xảy ra khi trả sách!");
    } finally {
      setLoading(false);
    }
  };

  const removeBookFromReturn = (loanId) => {
    setReturnBooks(prev => prev.filter(book => book.loanId !== loanId));
    setMessage("📚 Đã xóa sách khỏi danh sách trả");
  };

  const addAllBooksToReturn = () => {
    const allBooks = borrowedBooks.map(book => ({
      loanId: book.id,
      bookId: book.bookId,
      bookTitle: book.bookTitle || book.Book?.title,
      author: book.Book?.author,
      issueDate: book.issueDate,
      dueDate: book.dueDate,
      rfidTag: book.rfidTag || book.Book?.rfidTag
    }));
    setReturnBooks(allBooks);
    setMessage(`✅ Đã thêm tất cả ${allBooks.length} cuốn sách vào danh sách trả`);
  };

  const isBookOverdue = (dueDate) => {
    return new Date() > new Date(dueDate);
  };

  const calculateOverdueDays = (dueDate) => {
    const diffTime = new Date() - new Date(dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const resetSession = () => {
    setUserCard(null);
    setBorrowedBooks([]);
    setReturnBooks([]);
    setMessage("");
  };

  return (
    <div className="return-book">
      <h1>📤 Trả Sách Thư Viện</h1>
      
      {/* Socket Status */}
      <div className="socket-status">
        <span className={`status-dot ${socket?.connected ? 'connected' : 'disconnected'}`}></span>
        {socket?.connected ? 'Đã kết nối' : 'Mất kết nối'}
      </div>

      {/* Message */}
      {message && (
        <div className={`message ${message.includes('Lỗi') || message.includes('❌') || message.includes('chưa') ? 'error' : 'success'}`}>
          <pre>{message}</pre>
        </div>
      )}

      {/* User Info */}
      <div className="user-section">
        <h3>👤 Thông tin người trả sách:</h3>
        {userCard ? (
          <div className="user-info">
            <p><strong>Họ tên:</strong> {userCard.user.name}</p>
            <p><strong>Vai trò:</strong> {userCard.user.role}</p>
            <p><strong>Card ID:</strong> {userCard.cardId}</p>
            <p><strong>Số sách đang mượn:</strong> {borrowedBooks.length}</p>
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
            🔄 Đổi người trả
          </button>
        )}
      </div>

      {/* Borrowed Books List */}
      {borrowedBooks.length > 0 && (
        <div className="borrowed-books-section">
          <div className="section-header">
            <h3>📚 Sách đang mượn ({borrowedBooks.length}):</h3>
            <button 
              className="btn-add-all" 
              onClick={addAllBooksToReturn}
              disabled={returnBooks.length === borrowedBooks.length}
            >
              ➕ Thêm tất cả
            </button>
          </div>
          <div className="books-list">
            {borrowedBooks.map((book, index) => {
              const isOverdue = isBookOverdue(book.dueDate);
              const overdueDays = calculateOverdueDays(book.dueDate);
              const isInReturnList = returnBooks.find(rb => rb.loanId === book.id);
              
              return (
                <div key={book.id || index} className={`book-item ${isOverdue ? 'overdue' : ''} ${isInReturnList ? 'selected' : ''}`}>
                  <div className="book-info">
                    <h4>{book.bookTitle || book.Book?.title}</h4>
                    <p><strong>Tác giả:</strong> {book.Book?.author || 'N/A'}</p>
                    <p><strong>Ngày mượn:</strong> {new Date(book.issueDate).toLocaleDateString()}</p>
                    <p><strong>Hạn trả:</strong> {new Date(book.dueDate).toLocaleDateString()}</p>
                    {isOverdue && (
                      <p className="overdue-warning">
                        ⚠️ Quá hạn {overdueDays} ngày - Phạt: {(overdueDays * 5000).toLocaleString()} VND
                      </p>
                    )}
                  </div>
                  <div className="book-actions">
                    {isInReturnList ? (
                      <span className="selected-badge">✅ Đã chọn</span>
                    ) : (
                      <span className="not-selected">📚 Quét để trả</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Return Books List */}
      {returnBooks.length > 0 && (
        <div className="return-books-section">
          <h3>📤 Sách chuẩn bị trả ({returnBooks.length}):</h3>
          <div className="return-list">
            {returnBooks.map((book, index) => {
              const isOverdue = isBookOverdue(book.dueDate);
              const overdueDays = calculateOverdueDays(book.dueDate);
              
              return (
                <div key={book.loanId || index} className={`return-item ${isOverdue ? 'overdue' : ''}`}>
                  <div className="return-info">
                    <h4>{book.bookTitle}</h4>
                    <p><strong>Tác giả:</strong> {book.author || 'N/A'}</p>
                    <p><strong>Ngày mượn:</strong> {new Date(book.issueDate).toLocaleDateString()}</p>
                    <p><strong>Hạn trả:</strong> {new Date(book.dueDate).toLocaleDateString()}</p>
                    {isOverdue && (
                      <p className="fine-info">
                        💰 Phạt: {(overdueDays * 5000).toLocaleString()} VND ({overdueDays} ngày)
                      </p>
                    )}
                  </div>
                  <button 
                    className="btn-remove"
                    onClick={() => removeBookFromReturn(book.loanId)}
                  >
                    ❌ Xóa
                  </button>
                </div>
              );
            })}
          </div>

          {/* Complete Return Button */}
          <div className="complete-section">
            <button 
              className="btn-complete-return" 
              onClick={handleCompleteReturn}
              disabled={loading}
            >
              {loading ? '⏳ Đang xử lý...' : `📤 Hoàn tất trả ${returnBooks.length} cuốn sách`}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!userCard && (
        <div className="instructions">
          <h3>📋 Hướng dẫn trả sách:</h3>
          <ol>
            <li>🏷️ Quét thẻ thành viên của bạn</li>
            <li>📚 Quét từng cuốn sách muốn trả</li>
            <li>✅ Kiểm tra danh sách và hoàn tất</li>
          </ol>
          
          <div className="note">
            <p><strong>📝 Lưu ý:</strong></p>
            <ul>
              <li>Phí phạt trả muộn: <strong>5,000 VND/ngày</strong></li>
              <li>Có thể trả một phần hoặc tất cả sách đang mượn</li>
              <li>Kiểm tra kỹ danh sách trước khi hoàn tất</li>
            </ul>
          </div>
        </div>
      )}

      <style jsx>{`
        .return-book {
          max-width: 900px;
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
          white-space: pre-line;
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

        .user-section, .borrowed-books-section, .return-books-section, .instructions {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .btn-add-all, .btn-reset {
          background: #17a2b8;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-add-all:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .books-list, .return-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .book-item, .return-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          transition: all 0.3s;
        }

        .book-item.overdue, .return-item.overdue {
          border-color: #dc3545;
          background-color: #f8f9fa;
        }

        .book-item.selected {
          border-color: #28a745;
          background-color: #d4edda;
        }

        .book-info, .return-info {
          flex: 1;
        }

        .book-info h4, .return-info h4 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .overdue-warning, .fine-info {
          color: #dc3545;
          font-weight: bold;
          margin-top: 8px;
        }

        .selected-badge {
          background: #28a745;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
        }

        .not-selected {
          color: #6c757d;
          font-style: italic;
        }

        .btn-remove {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-complete-return {
          width: 100%;
          padding: 15px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 20px;
        }

        .btn-complete-return:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .note {
          background: #e9ecef;
          padding: 15px;
          border-radius: 4px;
          margin-top: 15px;
        }

        .instruction {
          color: #6c757d;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default ReturnBook;