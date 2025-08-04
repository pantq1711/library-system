// library-fe/src/components/BorrowBook.js

import React, { useState, useEffect } from "react";
import io from "socket.io-client";

// Kết nối Socket.IO
const socket = io("http://localhost:3000"); // ✅ Đổi về port 3000

const BorrowBook = () => {
  const [userCard, setUserCard] = useState(null);
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [message, setMessage] = useState("");

  // ✅ Socket.IO Connection Check
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  // ✅ Listen cho RFID user card scan
  useEffect(() => {
    const handleRfidScanned = (data) => {
      console.log("📧 RFID được quét:", data);
      setUserCard(data);
      setMessage(`Xin chào ${data.user?.name}! Hãy quét sách bạn muốn mượn.`);
    };

    socket.on("rfid_scanned", handleRfidScanned);

    return () => {
      socket.off("rfid_scanned", handleRfidScanned);
    };
  }, []);

  // ✅ FIX: Listen cho book scan - XỬ LÝ DATA ĐÚNG
  useEffect(() => {
    if (!userCard?.user?.id) return;

    const handleBookScanned = async (data) => {
      try {
        console.log("📚 Sách được quét:", data);
        
        // ✅ FIX: Không cần parse JSON, data đã là object
        const rfidTag = data.rfidTag;
        const bookId = data.bookId; // ✅ Đã là số, không cần parse
        const userId = userCard.user.id;

        console.log("📊 Processing data:", {
          rfidTag,
          bookId,
          userId,
          bookTitle: data.title,
          bookAuthor: data.author
        });

        // Gọi API để xử lý mượn sách
        const response = await fetch("http://localhost:3000/api/loans/book-scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            rfidTag: rfidTag, // ✅ Gửi rfidTag thay vì bookId
          }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log("✅ Kết quả từ server:", result);

          // ✅ Cập nhật danh sách sách đã mượn
          if (result.book) {
            setBorrowedBooks((prevBooks) => [...prevBooks, result.book]);
          }

          setMessage(result.message || "Mượn/trả sách thành công!");
        } else {
          console.error("❌ Lỗi response:", result);
          setMessage(result.message || "Mượn/trả sách thất bại!");
        }
      } catch (error) {
        console.error("❌ Lỗi khi xử lý book_scanned:", error);
        setMessage("Lỗi khi gửi yêu cầu mượn/trả sách.");
      }
    };

    socket.on("book_scanned", handleBookScanned);

    return () => {
      socket.off("book_scanned", handleBookScanned);
    };
  }, [userCard?.user?.id]);

  // ✅ DEBUG: Thêm listener cho tất cả events
  useEffect(() => {
    const handleAllEvents = (eventName) => {
      return (data) => {
        console.log(`🔊 Socket Event [${eventName}]:`, data);
      };
    };

    // Listen tất cả events để debug
    socket.onAny(handleAllEvents);

    return () => {
      socket.offAny(handleAllEvents);
    };
  }, []);

  const handleCompleteBorrow = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/borrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userCard,
          books: borrowedBooks,
        }),
      });

      if (response.ok) {
        alert("Mượn sách thành công!");
        setUserCard(null);
        setBorrowedBooks([]);
        setMessage("");
      } else {
        alert("Mượn sách thất bại!");
      }
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Có lỗi xảy ra khi mượn sách.");
    }
  };

  return (
    <div className="borrow-book">
      <h1>Mượn Sách</h1>
      
      {/* ✅ Thêm Socket Status */}
      <div className="socket-status">
        <p>Socket ID: {socket.id || "Disconnected"}</p>
        <p>Status: {socket.connected ? "🟢 Connected" : "🔴 Disconnected"}</p>
      </div>

      {message && <p className="message">{message}</p>}

      <div className="user-info">
        {userCard ? (
          <div>
            <h2>Thông tin người mượn:</h2>
            <p>Tên: {userCard.user?.name}</p>
            <p>Email: {userCard.user?.email}</p>
          </div>
        ) : (
          <p>Vui lòng quét thẻ để bắt đầu...</p>
        )}
      </div>

      <div className="borrowed-books">
        <h2>Sách đã quét:</h2>
        {borrowedBooks.length > 0 ? (
          <ul>
            {borrowedBooks.map((book, index) => (
              <li key={index}>
                {book.title} - {book.author}
              </li>
            ))}
          </ul>
        ) : (
          <p>Chưa có sách nào được quét.</p>
        )}
      </div>

      {borrowedBooks.length > 0 && (
        <button onClick={handleCompleteBorrow}>Hoàn tất mượn sách</button>
      )}
    </div>
  );
};

export default BorrowBook;