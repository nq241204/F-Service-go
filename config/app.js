// config/app.js
const path = require('path');
require('dotenv').config();

module.exports = {
    app: {
        name: 'F-Service',
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        secret: process.env.APP_SECRET || 'your-secret-key',
        url: process.env.APP_URL || 'http://localhost:3000'
    },

    db: {
        url: process.env.MONGODB_URI || 'mongodb://localhost:27017/f-service',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useCreateIndex: true,
            useFindAndModify: false
        }
    },

    session: {
        secret: process.env.SESSION_SECRET || 'session-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        }
    },

    upload: {
        dir: path.join(__dirname, '../public/uploads'),
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB
        },
        allowedTypes: ['image/jpeg', 'image/png']
    },

    payment: {
        minimumDeposit: 10000,
        minimumWithdraw: 50000,
        commission: {
            rate: 0.1, // 10%
            minimum: 1000
        }
    },

    email: {
        from: process.env.MAIL_FROM || 'no-reply@f-service.com',
        smtp: {
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT || 587,
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        }
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'jwt-secret-key',
        expiresIn: '7d'
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        prefix: 'f-service:'
    }
};