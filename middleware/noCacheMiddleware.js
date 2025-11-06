// middleware/noCacheMiddleware.js
// Middleware để ngăn trình duyệt cache các trang protected

const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
};

module.exports = noCache;

