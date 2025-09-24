# Railway Deployment Guide

This project is configured for easy deployment to Railway.

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/zerotouch-services)

## Manual Deployment Steps

1. **Connect GitHub Repository**
   - Fork or clone this repository
   - Connect your GitHub account to Railway
   - Create a new project from your repository

2. **Environment Variables**
   - Set `DASHSCOPE_API_KEY` in Railway dashboard
   - Other variables are automatically configured

3. **Deploy**
   - Railway will automatically build and deploy on git push
   - The app will be available at the provided Railway URL

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Features

- ✅ Automatic builds on git push
- ✅ Health check endpoint at `/health`
- ✅ API proxy for DashScope
- ✅ Static file serving
- ✅ SPA routing support
- ✅ Container optimization with multi-stage builds
- ✅ Security hardened with non-root user

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (auto-set by Railway) | No |
| `DASHSCOPE_API_KEY` | API key for DashScope service | Yes |
| `NODE_ENV` | Environment (auto-set to production) | No |

## Troubleshooting

1. **Build Fails**: Check that all dependencies are listed in package.json
2. **App Won't Start**: Verify the health check endpoint returns 200
3. **API Issues**: Ensure DASHSCOPE_API_KEY is set correctly

## Support

For Railway-specific issues, check the [Railway documentation](https://docs.railway.app/).
