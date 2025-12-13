const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const visualizationRoutes = require('./routes/visualizationRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', visualizationRoutes);

// Root endpoint
app.get('/', (req, res) => {
res.json({ 
    message: 'K-Means Clustering API',
    version: '1.0.0',
    endpoints: {
    visualizations: '/api/visualizations',
    upload: '/api/upload',
    elbow: '/api/elbow',
    process: '/api/process'
    }
});
});

// Error handling middleware
app.use((err, req, res, next) => {
console.error(err.stack);
res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
});
});

// 404 handler
app.use((req, res) => {
res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
console.log(`🚀 Server running on port ${PORT}`);
console.log(`📊 API available at http://localhost:${PORT}/api`);
});

module.exports = app;