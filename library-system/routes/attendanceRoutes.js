// Cập nhật library-system/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Route có sẵn
router.post('/card-scan', attendanceController.processCardScan);
router.post('/face-auth', attendanceController.processFaceAuth);

// Thêm route mới để lấy danh sách check-in
router.get('/checkin-list', attendanceController.getCheckinList);

// Route verify check-in status
router.get('/verify-checkin/:userId', attendanceController.verifyCheckin);

module.exports = router;