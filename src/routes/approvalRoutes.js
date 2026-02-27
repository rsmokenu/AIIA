const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');

router.get('/', approvalController.listPending);
router.post('/:id/approve', approvalController.approve);
router.post('/:id/deny', approvalController.deny);

module.exports = router;
