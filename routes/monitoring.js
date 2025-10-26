// routes/monitoring.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// @route   GET /api/monitor
// @desc    Health check endpoint - Kiểm tra trạng thái ứng dụng và DB
router.get('/', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    const healthStatus = {
        status: dbState === 1 ? 'OK' : 'Service Unavailable',
        timestamp: new Date().toISOString(),
        database: {
            status: dbStates[dbState],
            connected: dbState === 1
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    };

    if (dbState === 1) {
        res.status(200).json(healthStatus);
    } else {
        res.status(503).json({
            ...healthStatus,
            error: 'Database connection issue'
        });
    }
});

// @route   GET /api/monitor/stats
// @desc    Database stats endpoint (for monitoring) - Lấy thống kê chi tiết DB
// Nên bảo vệ route này bằng authMiddleware(['admin']) nếu bạn muốn giới hạn truy cập
router.get('/stats', async (req, res) => { 
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        // Lấy thống kê database
        const stats = await mongoose.connection.db.stats();
        res.json({
            database: stats.db,
            collections: stats.collections,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            objects: stats.objects
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;