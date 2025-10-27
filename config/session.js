// config/session.js
const session = require('express-session');

module.exports = (app) => {
    app.use(session({
        secret: process.env.SESSION_SECRET || 'your_session_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax' // Add sameSite for better security
        },
        name: 'connect.sid' // Explicitly set cookie name
    }));
};