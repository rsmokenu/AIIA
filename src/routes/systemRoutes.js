const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

router.get('/status', systemController.getStatus);
router.get('/events', systemController.getEvents);

module.exports = router;
