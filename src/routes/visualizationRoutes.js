// backend/src/routes/visualizationRoutes.js

const express = require('express');
const router = express.Router();
const visualizationController = require('../controllers/visualizationController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Routes
router.get('/', visualizationController.getAllVisualizations);
router.get('/:id', visualizationController.getVisualizationById);
router.post('/upload', upload.single('dataset'), visualizationController.uploadDataset);
router.post('/elbow', visualizationController.calculateElbow);
router.post('/process', visualizationController.processClustering);
router.get('/:id/results', visualizationController.getClusteringResults);
router.delete('/:id', visualizationController.deleteVisualization);
router.post('/clean', visualizationController.cleanData);

module.exports = router;