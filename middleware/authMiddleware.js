const jwt = require('jsonwebtoken');
const User = require('../models/User');

const isGuest = (req, res, next) => {
    if (req.session && req.session.user) {
        // If user is logged in, redirect to appropriate dashboard
        const role = req.session.user.role;
        if (role === 'admin') return res.redirect('/admin/dashboard');
        if (role === 'member') return res.redirect('/member/dashboard');
        return res.redirect('/user/dashboard');
    }
    next();
};

const authMiddleware = (roles = []) => {
    return function(req, res, next) {
        const token = req.session?.token || req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            if (!req.originalUrl.startsWith('/api')) {
                req.flash('error_msg', 'Vui lòng đăng nhập để truy cập.');
                return res.redirect('/auth/login');
            }
            return res.status(401).json({ message: 'Vui lòng đăng nhập để truy cập' });
        }

        jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret', (err, decoded) => {
            if (err) {
                if (!req.originalUrl.startsWith('/api')) {
                    if (req.session) {
                        req.session.destroy(() => res.redirect('/auth/login'));
                    } else {
                        res.redirect('/auth/login');
                    }
                } else {
                    res.status(401).json({ msg: 'Token is not valid' });
                }
                return;
            }

            User.findById(decoded.id)
                .select('-password')
                .populate('ViGiaoDich')
                .then(user => {
                    if (!user) {
                        if (!req.originalUrl.startsWith('/api')) {
                            req.session.error_msg = 'User not found';
                            return res.redirect('/auth/login');
                        }
                        return res.status(401).json({ msg: 'User not found' });
                    }

                    if (user.status === 'banned') {
                        if (!req.originalUrl.startsWith('/api')) {
                            req.session.error_msg = 'Account is banned';
                            return res.redirect('/auth/login');
                        }
                        return res.status(403).json({ msg: 'Account is banned' });
                    }

                    if (roles.length > 0 && !roles.includes(user.role)) {
                        if (!req.originalUrl.startsWith('/api')) {
                            req.session.error_msg = 'Access denied';
                            return res.redirect('/auth/login');
                        }
                        return res.status(403).json({ msg: 'Access denied' });
                    }

                    req.user = user;
                    next();
                })
                .catch(err => {
                    console.error('Database error:', err);
                    if (!req.originalUrl.startsWith('/api')) {
                        return res.redirect('/auth/login');
                    }
                    res.status(500).json({ msg: 'Server error' });
                });
        });
    };
}

module.exports = {
    isGuest,
    authMiddleware
};
