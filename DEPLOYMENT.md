# Deployment Guide - Render.com

## Prerequisites
- Render.com account (sign up at https://render.com with GitHub)
- GitHub repository with your code

## Step 1: Deploy PostgreSQL Database

1. Go to Render Dashboard: https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `tic-tac-toe-db`
   - **Database**: `nakama`
   - **User**: `postgres`
   - **Region**: Choose closest to you
   - **Plan**: **Free**
4. Click **"Create Database"**
5. Wait for it to provision (2-3 minutes)
6. **Copy the Internal Database URL** (you'll need this)

## Step 2: Deploy Nakama Backend

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `Asha629399/tic-tac-toe`
3. Configure:
   - **Name**: `tic-tac-toe-nakama`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Environment**: **Docker**
   - **Dockerfile Path**: `Dockerfile.nakama`
   - **Plan**: **Free**
4. Add Environment Variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL from Step 1
5. Click **"Create Web Service"**
6. Wait for deployment (5-10 minutes)
7. **Copy your Nakama service URL** (e.g., `https://tic-tac-toe-nakama-2q2x.onrender.com`)

## Step 3: Deploy React Frontend

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository: `Asha629399/tic-tac-toe`
3. Configure:
   - **Name**: `tic-tac-toe-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Add Environment Variables:
   - **Key**: `REACT_APP_NAKAMA_HOST`
   - **Value**: Your Nakama URL without `https://` (e.g., `tic-tac-toe-nakama-2q2x.onrender.com`)
   - **Key**: `REACT_APP_NAKAMA_PORT`
   - **Value**: `443`
   - **Key**: `REACT_APP_NAKAMA_USE_SSL`
   - **Value**: `true`
5. Click **"Create Static Site"**
6. Wait for deployment (3-5 minutes)

## Step 4: Access Your App

Your frontend will be available at: `https://tic-tac-toe-frontend-5aop.onrender.com`

## Important Notes

### Free Tier Limitations:
- **Services sleep after 15 minutes of inactivity**
- First request after sleep takes 30-60 seconds to wake up
- PostgreSQL free tier expires after 90 days
- 750 hours/month of runtime

### Troubleshooting:
- If Nakama fails to start, check the logs in Render dashboard
- Make sure DATABASE_URL is correctly set
- Frontend must use HTTPS (SSL) to connect to Nakama

### Keeping Services Awake (Optional):
Use a service like UptimeRobot (free) to ping your services every 5 minutes to prevent sleeping.

## Cost After Free Tier:
- PostgreSQL: $7/month
- Nakama Web Service: $7/month
- Frontend Static Site: Free forever
- **Total**: ~$14/month after 90 days
