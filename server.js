// Railway生产环境服务器 - 处理静态文件和API代理
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API代理中间件 - 转发到阿里云DashScope
app.use('/api/dashscope', createProxyMiddleware({
  target: 'https://dashscope.aliyuncs.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/dashscope': '/compatible-mode/v1'
  },
  secure: true,
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${proxyReq.getHeader('host')}${proxyReq.path}`)
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] Response: ${proxyRes.statusCode} for ${req.originalUrl}`)
  },
  onError: (err, req, res) => {
    console.error('[PROXY] Error:', err.message)
    res.status(500).json({ error: 'Proxy error', message: err.message })
  }
}))

// 静态文件服务 - 服务构建后的前端文件
app.use(express.static(path.join(__dirname, 'dist')))

// SPA路由支持 - 所有非API请求返回index.html
app.get('*', (req, res) => {
  // 跳过API路径
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('[SERVER] Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`)
  console.log(`🔄 API proxy: /api/dashscope -> https://dashscope.aliyuncs.com/compatible-mode/v1`)
  console.log(`🏥 Health check: /health`)
})
