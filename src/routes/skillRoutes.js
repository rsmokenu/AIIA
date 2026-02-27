const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');

router.get('/', skillController.listSkills);
router.get('/:id', skillController.getSkillDetails);
router.post('/:id/execute', skillController.executeSkill);

module.exports = router;
