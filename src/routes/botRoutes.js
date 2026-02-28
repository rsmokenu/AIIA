const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

router.post('/handshake', botController.handshake);
router.get('/registry', botController.listBots);
router.get('/brain-status', botController.getBrainStatus);
router.post('/:id/tasks', botController.assignTask);
router.get('/:id/tasks', botController.listTasks);
router.get('/:id/tasks/history', botController.getTaskHistory);
router.post('/:id/tasks/:taskId/complete', botController.completeTask);
router.delete('/:id/tasks/:taskId', botController.removeTask);
router.post('/:id/tasks/:taskId/priority/:direction(up|down)', botController.updateTaskPriority);
router.post('/:id/:action(stop|resume)', botController.updateState);
router.delete('/:id', botController.removeBot);
router.post('/:id/rename', botController.renameBot);
router.post('/:id/broadcast', botController.broadcast);

module.exports = router;
