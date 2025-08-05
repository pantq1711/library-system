// library-system/routes/loanRoutes.js (Updated)
const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// Xử lý quét thẻ người dùng cho mượn/trả sách
router.post('/user-card-scan', loanController.processUserCardScan);

// Xử lý quét sách
router.post('/book-scan', loanController.processBookScan);

// API mượn sách (batch) - Mới thêm
router.post('/borrow', loanController.borrowBooks);

// API trả sách (batch) - Mới thêm  
router.post('/return', loanController.returnBooks);
router.get('/user-active-loans/:userId', loanController.getUserActiveLoans);

module.exports = router;