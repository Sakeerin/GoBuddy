# Quick Start Guide
## GoBuddy - Get Started in 5 Minutes

## 🚀 Quick Start with Docker

### Step 1: Start Services
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis
```

### Step 2: Setup Database
```bash
# Wait a few seconds for services to start, then load demo data
npm run seed
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start Application
```bash
npm run dev
```

### Step 5: Test It Works
```bash
# Health check
curl http://localhost:3000/health

# Request OTP (check logs for code)
curl -X POST http://localhost:3000/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com"}'
```

## 📋 Demo Data

After running `npm run seed`, you'll have:

### Users
- **demo@example.com** - Regular user
- **admin@example.com** - Super admin
- **traveler@example.com** - Traveler user

**Login**: Use OTP (check application logs for code)

### Trips
- **Bangkok Adventure** - 4-day trip with itinerary
- **Tokyo Family Trip** - 7-day family trip

### Sample Data
- 7 POIs (Bangkok & Tokyo)
- 1 Confirmed booking
- 1 Provider configuration

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :5432

# Or change ports in docker-compose.yml
```

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres
```

### Reset Everything
```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d postgres redis
npm run seed
```

## 📚 Next Steps

1. ✅ Services running
2. ✅ Demo data loaded
3. 📖 Read [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed setup
4. 📖 Read [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for API docs
5. 🧪 Test API endpoints
6. 🎨 Build your frontend

## 💡 Tips

- **OTP Login**: In development, OTP codes are logged to console
- **Admin Access**: Use `admin@example.com` for admin endpoints
- **API Base URL**: `http://localhost:3000`
- **Database**: Use `docker-compose exec postgres psql -U gobuddy_user -d gobuddy` to access

## 🆘 Need Help?

- Check [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed instructions
- Check [README.md](README.md) for project overview
- Review Docker logs: `docker-compose logs -f`
