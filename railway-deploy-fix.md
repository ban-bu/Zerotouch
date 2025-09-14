# 🔧 Railway部署API调用修复方案

## 🚨 问题描述
- **本地环境**：API调用正常，使用Vite开发代理
- **Railway环境**：API调用失败，返回空响应
- **根本原因**：生产环境使用静态文件服务器，无代理功能

## ✅ 解决方案
创建Express服务器处理API代理和静态文件服务

### 📁 新增和修改文件
- **`server.js`** - Express服务器（API代理 + 静态文件）
- **`.dockerignore`** - 优化Docker构建，减少镜像大小
- **更新了** `package.json` - 添加express和http-proxy-middleware依赖
- **优化了** `Dockerfile.railway` - 多阶段构建，先安装依赖构建，后清理
- **更新了** `railway.toml` - 健康检查路径改为`/health`

### 🔄 代理配置
```javascript
// /api/dashscope/* -> https://dashscope.aliyuncs.com/compatible-mode/v1/*
app.use('/api/dashscope', createProxyMiddleware({
  target: 'https://dashscope.aliyuncs.com',
  changeOrigin: true,
  pathRewrite: { '^/api/dashscope': '/compatible-mode/v1' }
}))
```

## 🚀 部署步骤

### 1. 提交更改到Git
```bash
git add .
git commit -m "fix: 添加Express服务器和优化Dockerfile解决Railway部署问题"
git push origin main
```

### 2. Railway重新部署
- Railway会自动检测到更改并重新部署
- 新的部署将使用优化后的Express服务器

### 3. ⚠️ 如果仍有npm安装问题
如果Railway部署时`npm ci`仍然失败，可以尝试以下解决方案：

**方案A**: 使用npm install替代npm ci
在Railway环境变量中添加：
- `NPM_CONFIG_PRODUCTION=false`
- `NODE_ENV=production`

**方案B**: 修改Dockerfile.railway第13行：
```dockerfile
RUN npm install --no-audit --no-fund --verbose
```

### 3. 验证修复
部署完成后，检查以下端点：
- **健康检查**: `https://your-app.railway.app/health`
- **API代理**: 前端调用`/api/dashscope/chat/completions`会被正确转发

## 🔍 修复验证清单

- [x] Express服务器创建 (`server.js`)
- [x] 依赖包安装 (`express`, `http-proxy-middleware`)
- [x] Dockerfile优化 (多阶段构建，详细日志)
- [x] .dockerignore创建 (减少构建上下文)
- [x] 启动脚本更新 (`railway:start`)
- [x] 健康检查路径更新 (`/health`)
- [x] API代理配置 (`/api/dashscope -> DashScope API`)
- [x] 本地构建测试通过

## 💡 技术细节

### Express服务器功能
1. **API代理** - 转发`/api/dashscope/*`到阿里云API
2. **静态文件服务** - 服务构建后的React应用
3. **SPA路由支持** - 所有非API请求返回index.html
4. **健康检查** - 提供`/health`端点
5. **错误处理** - 完善的错误日志记录

### CORS解决方案
- 服务器端代理完全绕过浏览器CORS限制
- API密钥在服务器端处理，更加安全
- 支持所有HTTP方法和头部

## 🔧 本地测试（可选）
```bash
# 构建项目
npm run build

# 启动生产服务器
npm start

# 访问 http://localhost:8080
```

## 📊 预期结果
- ✅ Railway部署后AI能正常回答问题
- ✅ API调用不再出现CORS错误
- ✅ 日志显示正确的代理转发
- ✅ 健康检查正常通过

---
**注意**: 此修复保持了原有的前端代码不变，只是在生产环境提供了代理服务器功能。