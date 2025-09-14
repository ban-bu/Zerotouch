# Railway专用Dockerfile - Express服务器版本
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache curl && \
    npm config set registry https://registry.npmjs.org/

# 复制package文件并安装所有依赖（构建需要）
COPY package*.json ./
RUN npm ci --no-audit --no-fund --verbose

# 复制源代码和配置文件
COPY src/ ./src/
COPY server.js ./
COPY vite.config.js tailwind.config.js postcss.config.js ./
COPY index.html ./

# 构建前端应用
RUN npm run build

# 安装生产依赖并清理
RUN npm prune --production && \
    rm -rf src/ vite.config.js tailwind.config.js postcss.config.js index.html && \
    npm cache clean --force

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 启动Express服务器（带代理功能）
CMD ["node", "server.js"]