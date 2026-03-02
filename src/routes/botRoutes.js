const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

// Registry and Management
router.post('/handshake', botController.handshake);
router.get('/registry', botController.listBots);
router.delete('/:id', botController.removeBot);
router.post('/:id/rename', botController.renameBot);
router.post('/:id/:action(stop|resume)', botController.updateState);

// Real-time & Synchronization
router.get('/brain-status', botController.getBrainStatus);
router.get('/sync-status', botController.getSyncStatus);
router.post('/feedback', botController.handleFeedback);
router.post('/critique', botController.handleFeedback);
router.post('/:id/broadcast', botController.broadcast);

// Tasking
router.post('/:id/tasks', botController.assignTask);
router.get('/:id/tasks', botController.listTasks);
router.get('/:id/tasks/history', botController.getTaskHistory);
router.post('/:id/tasks/:taskId/complete', botController.completeTask);
router.delete('/:id/tasks/:taskId', botController.removeTask);
router.post('/:id/tasks/:taskId/priority/:direction(up|down)', botController.updateTaskPriority);

module.exports = router;
