# 使用官方轻量级基础镜像（Node.js v22.18 Alpine Linux）
FROM node:22.18-alpine

# 设置容器工作目录（所有后续命令在此目录执行）
WORKDIR /app

# 1. 先单独复制依赖定义文件（利用Docker缓存层加速构建）
COPY package.json package-lock.json* ./

# 2. 安装生产依赖（指定仅安装生产包，缩小镜像体积）
RUN npm install --only=production && npm cache clean --force

# 3. 复制项目源码（排除.dockerignore中定义的文件）
COPY . .

# 声明建议挂载点（不会自动挂载，仅文档作用）
VOLUME ["/app/config.json"]

# 4. 启动命令（根据项目启动方式调整）
CMD ["npm", "start"]
