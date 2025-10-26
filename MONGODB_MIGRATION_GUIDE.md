# MongoDB Migration Guide for F-Service

## Current Status ✅
Your project is already using MongoDB with Mongoose! Here's how to optimize and complete the setup.

## 1. Environment Configuration

Create a `.env` file in your project root:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/f_service
# For MongoDB Atlas (cloud):
# MONGO_URI=mongodb://localhost:27017/f_service

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
PORT=5000
NODE_ENV=development
```

## 2. Database Connection Options

### Option A: Local MongoDB
```bash
# Install MongoDB locally
# Windows: Download from https://www.mongodb.com/try/download/community
# Or use Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Option B: MongoDB Atlas (Cloud)
1. Go to https://cloud.mongodb.com/
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Update MONGO_URI in .env

## 3. Database Optimization

### Add Indexes for Better Performance
Your models need indexes for optimal performance:

```javascript
// In your models, add these indexes:

// User.js - Add after schema definition
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

// Service.js - Add after schema definition  
ServiceSchema.index({ user: 1 });
ServiceSchema.index({ status: 1 });
ServiceSchema.index({ createdAt: -1 });

// Transaction.js - Add after schema definition
TransactionSchema.index({ user: 1 });
TransactionSchema.index({ createdAt: -1 });
```

## 4. Migration Scripts

### Seed Data Script (already exists)
Your `seed.js` file can be used to populate initial data.

### Data Migration Script
Create `migrate.js` for data transformations if needed.

## 5. Production Considerations

### Connection Pooling
Update `config/db.js` for production:

```javascript
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
```

## 6. Running the Application

```bash
# Install dependencies
npm install

# Start the application
npm run dev

# Or for production
npm start
```

## 7. Database Management

### MongoDB Compass (GUI)
Download MongoDB Compass for visual database management:
https://www.mongodb.com/products/compass

### Useful MongoDB Commands
```bash
# Connect to MongoDB shell
mongosh

# Show databases
show dbs

# Use your database
use f_service

# Show collections
show collections

# Query users
db.users.find()
```

## 8. Monitoring and Maintenance

### Health Check Endpoint
Add to your routes for monitoring:

```javascript
// In routes/web.js or create health.js
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date()
  });
});
```

## 9. Backup Strategy

### Automated Backups
```bash
# Create backup
mongodump --db f_service --out ./backups/$(date +%Y%m%d)

# Restore backup
mongorestore --db f_service ./backups/20231201/f_service
```

## 10. Security Best Practices

1. **Environment Variables**: Never commit .env files
2. **Authentication**: Use strong JWT secrets
3. **Database Access**: Limit network access to MongoDB
4. **Validation**: Your models already have good validation
5. **Rate Limiting**: Consider adding rate limiting middleware

## Next Steps

1. Set up your `.env` file
2. Choose local or cloud MongoDB
3. Run the application
4. Test all endpoints
5. Add indexes for performance
6. Set up monitoring

Your project structure is already well-organized for MongoDB! 🎉