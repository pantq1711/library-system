// library-system/controllers/loanController.js (Updated)
const { User, Book, Loan, Card } = require('../models');
const loanService = require('../services/loanService');
let io;

// Thiết lập Socket.IO
const setIo = (socketIo) => {
  io = socketIo;
};
exports.borrowBooks = async (req, res) => {
  try {
    const { userId, cardId, books } = req.body;
    
    console.log('📚 Processing borrow request:', { userId, cardId, books });
    
    // Validate input
    if (!userId || !books || !Array.isArray(books) || books.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin userId hoặc danh sách sách!'
      });
    }

    // ✅ KIỂM TRA USER ĐÃ CHECK-IN CHƯA
    const { Attendance } = require('../models');
    const checkInRecord = await Attendance.findOne({
      where: { 
        userId, 
        checkOutTime: null // Đang trong thư viện
      },
      order: [['checkInTime', 'DESC']]
    });

    if (!checkInRecord) {
      return res.status(400).json({
        success: false,
        message: '❌ Lỗi! Người dùng chưa check-in vào thư viện. Vui lòng check-in trước khi mượn sách.'
      });
    }

    console.log('✅ User is checked in:', checkInRecord.checkInTime);

    // Kiểm tra user có tồn tại không
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng!'
      });
    }

    // Kiểm tra các sách có tồn tại và có sẵn không
    const bookIds = books.map(book => book.bookId);
    const availableBooks = await Book.findAll({
      where: {
        id: bookIds,
        available: { [require('sequelize').Op.gt]: 0 }
      }
    });

    if (availableBooks.length !== books.length) {
      return res.status(400).json({
        success: false,
        message: 'Một hoặc nhiều cuốn sách không có sẵn để mượn!'
      });
    }

    // Kiểm tra user có đang mượn quá nhiều sách không (giới hạn 5 cuốn)
    const currentLoans = await Loan.count({
      where: {
        userId,
        status: 'borrowed'
      }
    });

    if (currentLoans + books.length > 5) {
      return res.status(400).json({
        success: false,
        message: `Bạn chỉ có thể mượn tối đa 5 cuốn sách. Hiện tại đang mượn ${currentLoans} cuốn.`
      });
    }

    // Tạo các loan records và cập nhật số lượng sách
    const createdLoans = [];
    const { Op } = require('sequelize');
    
    for (const bookData of books) {
      const book = availableBooks.find(b => b.id === bookData.bookId);
      
      // Tạo loan record
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 ngày sau
      
      const loan = await Loan.create({
        userId,
        bookId: book.id,
        issueDate: new Date(),
        dueDate,
        status: 'borrowed',
        rfidTag: bookData.rfidTag
      });

      // Giảm số lượng sách có sẵn
      await book.update({
        available: book.available - 1
      });

      createdLoans.push({
        id: loan.id,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        issueDate: loan.issueDate,
        dueDate: loan.dueDate
      });
    }

    // Gửi thông báo qua Socket.IO
    if (io) {
      io.emit('books_borrowed', {
        userId: user.id,
        userName: user.name,
        booksCount: createdLoans.length,
        books: createdLoans
      });
    }

    console.log('✅ Successfully borrowed books:', createdLoans.length);

    res.status(200).json({
      success: true,
      message: `Mượn thành công ${createdLoans.length} cuốn sách!`,
      loans: createdLoans,
      user: {
        id: user.id,
        name: user.name
      }
    });

  } catch (error) {
    console.error('❌ Error in borrowBooks:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi mượn sách: ' + error.message
    });
  }
};

// Xử lý quét thẻ người dùng cho mượn/trả sách
exports.processUserCardScan = async (req, res) => {
  try {
    const { cardId } = req.body;
    
    // Xử lý quét thẻ người dùng qua service
    const { user, card, activeLoans } = await loanService.processUserCardScan(cardId);
    
    // Gửi thông báo qua Socket.IO
    if (io) {
      io.emit('user_card_scanned', {
        userId: user.id,
        userName: user.name,
        activeLoans: activeLoans.map(loan => ({
          id: loan.id,
          bookTitle: loan.Book.title,
          issueDate: loan.issueDate,
          dueDate: loan.dueDate
        }))
      });
    }
    
    // Trả về thông tin người dùng
    res.status(200).json({
      success: true,
      message: 'Quét thẻ thành công, vui lòng quét sách',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      activeLoans: activeLoans.map(loan => ({
        id: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.Book.title,
        issueDate: loan.issueDate,
        dueDate: loan.dueDate
      }))
    });
    
  } catch (error) {
    console.error('Lỗi khi xử lý quét thẻ người dùng:', error);
    
    if (error.message.includes('Không tìm thấy') || error.message.includes('không hợp lệ')) {
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Lỗi server' 
    });
  }
};

// Xử lý quét sách
exports.processBookScan = async (req, res) => {
  try {
    const { userId, rfidTag } = req.body;
    
    // Xử lý quét sách qua service
    const { loan, book, user, action } = await loanService.processBookScan(userId, rfidTag);
    
    // Gửi thông báo qua Socket.IO
    if (io) {
      io.emit('book_processed', {
        userId: user.id,
        userName: user.name,
        bookId: book.id,
        bookTitle: book.title,
        action
      });
    }
    
    res.status(200).json({
      success: true,
      message: `${action === 'borrow' ? 'Mượn' : 'Trả'} sách thành công`,
      loan,
      book,
      user,
      action
    });
    
  } catch (error) {
    console.error('Lỗi khi xử lý quét sách:', error);
    
    if (error.message.includes('Không tìm thấy') || error.message.includes('không đủ')) {
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    if (error.message.includes('đã mượn') || error.message.includes('chưa mượn')) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Lỗi server' 
    });
  }
};

// API trả sách (batch) - Mới thêm
exports.returnBooks = async (req, res) => {
  try {
    const { userId, books } = req.body;
    
    console.log('📤 Processing return request:', { userId, books });
    
    // Validate input
    if (!userId || !books || !Array.isArray(books) || books.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin userId hoặc danh sách sách!'
      });
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng!'
      });
    }

    const returnedBooks = [];
    let totalFine = 0;

    // Process từng cuốn sách
    for (const bookData of books) {
      const { loanId, bookId, rfidTag } = bookData;
      
      // Tìm loan record
      const loan = await Loan.findOne({
        where: {
          id: loanId,
          userId,
          bookId,
          status: 'borrowed'
        },
        include: [{ model: Book }]
      });

      if (!loan) {
        console.log(`❌ Loan not found for book ${bookId}`);
        continue;
      }

      // Tính toán tiền phạt (5,000 VND/ngày)
      const currentDate = new Date();
      const dueDate = new Date(loan.dueDate);
      let fine = 0;
      let daysLate = 0;

      if (currentDate > dueDate) {
        daysLate = Math.ceil((currentDate - dueDate) / (1000 * 60 * 60 * 24));
        fine = daysLate * 5000; // 5,000 VND per day
        totalFine += fine;
      }

      // Cập nhật loan record
      await loan.update({
        returnDate: currentDate,
        status: 'returned',
        fine: fine
      });

      // Tăng số lượng sách có sẵn
      await loan.Book.update({
        available: loan.Book.available + 1
      });

      returnedBooks.push({
        loanId: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.Book.title,
        author: loan.Book.author,
        issueDate: loan.issueDate,
        dueDate: loan.dueDate,
        returnDate: currentDate,
        daysLate,
        fine,
        isLate: daysLate > 0
      });

      console.log(`✅ Returned book: ${loan.Book.title}, Fine: ${fine} VND`);
    }

    // Gửi thông báo qua Socket.IO
    if (io) {
      io.emit('books_returned', {
        userId: user.id,
        userName: user.name,
        booksCount: returnedBooks.length,
        totalFine,
        books: returnedBooks
      });
    }

    console.log(`✅ Successfully returned ${returnedBooks.length} books, Total fine: ${totalFine} VND`);

    res.status(200).json({
      success: true,
      message: `Trả thành công ${returnedBooks.length} cuốn sách!`,
      returnedBooks,
      totalFine,
      user: {
        id: user.id,
        name: user.name
      }
    });

  } catch (error) {
    console.error('❌ Error in returnBooks:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi trả sách: ' + error.message
    });
  }
};
exports.getUserActiveLoans = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📋 Getting active loans for user:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu userId!'
      });
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng!'
      });
    }

    // Lấy danh sách sách đang mượn
    const activeLoans = await Loan.findAll({
      where: {
        userId,
        status: 'borrowed'
      },
      include: [{
        model: Book,
        attributes: ['id', 'title', 'author', 'rfidTag', 'isbn']
      }],
      order: [['issueDate', 'DESC']]
    });

    console.log(`✅ Found ${activeLoans.length} active loans for user ${user.name}`);

    res.status(200).json({
      success: true,
      message: `Tìm thấy ${activeLoans.length} sách đang mượn`,
      activeLoans: activeLoans.map(loan => ({
        id: loan.id,
        bookId: loan.bookId,
        bookTitle: loan.Book.title,
        author: loan.Book.author,
        issueDate: loan.issueDate,
        dueDate: loan.dueDate,
        rfidTag: loan.Book.rfidTag,
        Book: {
          id: loan.Book.id,
          title: loan.Book.title,
          author: loan.Book.author,
          rfidTag: loan.Book.rfidTag
        }
      })),
      user: {
        id: user.id,
        name: user.name
      }
    });

  } catch (error) {
    console.error('❌ Error getting active loans:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách sách đang mượn: ' + error.message
    });
  }
};
// Export các functions
module.exports = {
  setIo,
  processUserCardScan: exports.processUserCardScan,
  processBookScan: exports.processBookScan,
  borrowBooks: exports.borrowBooks,
  returnBooks: exports.returnBooks,
  getUserActiveLoans: exports.getUserActiveLoans,  // ← MỚI
};