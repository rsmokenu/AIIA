const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');

router.post('/summarize', toolController.summarize);
router.post('/completions', toolController.completions);
router.get('/audit', toolController.auditEnvironment);

module.exports = router;
