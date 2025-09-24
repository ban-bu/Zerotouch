#!/bin/bash

# Railway startup script for Zerotouch application
echo "🚀 Starting Zerotouch application..."

# Check if NODE_ENV is set, default to production
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}

# Log environment info
echo "📊 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"
echo "📁 Working directory: $(pwd)"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ dist directory not found, building application..."
    npm run build
else
    echo "✅ dist directory exists"
fi

# Start the server
echo "🚀 Starting Express server..."
exec node server.js
