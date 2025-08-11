# 发个东西

一个局域网文字/文件 P2P 传输工具，现已集成 TURN 服务支持

> 项目中仅在线用户列表和 WebRTC 信令迫不得已需要一个轻量化的服务，其他数据传输都采用了基于 WebRTC 的点对点传输，不经过中间服务器，所以局域网内互传一些文字/文件都比较快。内置 TURN 服务可解决 NAT 穿越问题。

demo 演示：https://fagedongxi.com

## 新增功能

- ✅ 集成 Node-TURN 服务器，解决 NAT 穿越问题
- ✅ 可配置的 TURN 服务参数
- ✅ 自动检测和使用本地 TURN 服务器

## 优点

无需安装任何软件，打开浏览器，无需登录直接传输。
现在支持跨网络环境传输（通过内置 TURN 服务器）。

## 缺点

接收大文件比较吃内存（单文件几百兆一般没问题）

## 场景：

比如新装的 win 系统需要从 mac 系统传一些需要 🪜 才能下载的软件或者搜到的一些东西

## 部署/启动

> 自`1.1.0`版本后，不再需要单独部署网页端了，仅启动一个服务端即可
> 自`1.1.4`版本后，集成了 TURN 服务器，可以解决网络连通性问题

参考视频：https://v.douyin.com/zp_dXkV1fys/

### 源码方式

1. 安装 nodejs，node 版本没有测试，我用的是 `16.20.2`
2. 下载源码
3. 进入 项目根目录，运行 `npm install`
4. 创建配置文件 `config.json`（可选，参考 `config.example.json`）
5. 运行 `npm run start`

### 二进制方式

- 下载对应平台的可执行文件，直接执行即可
- 创建配置文件 `config.json`（可选，参考 `config.example.json`）
- 如果你用 windows，可参考 https://v.douyin.com/CeiJahpLD/ 注册成服务

## 配置文件

现在使用**统一配置文件** `config.json` 来管理所有设置，包含三个主要板块：

### 配置文件结构

```json
{
  "server": {
    "httpPort": 8081,
    "host": "0.0.0.0"
  },
  "rooms": [
    {
      "roomId": "testroom",
      "pwd": "5d41402abc4b2a76b9719d911017c592",
      "remark": "测试房间 - 密码: hello"
    }
  ],
  "turnConfig": {
    "enabled": true,
    "turnPort": 3478,
    "minPort": 49152,
    "maxPort": 65535,
    "debugLevel": "ERROR",
    "listeningIps": ["0.0.0.0"],
    "relayIps": ["0.0.0.0"],
    "authMech": "long-term"
  }
}
```

### 配置板块说明

#### 1. server 板块

- `httpPort`: Web 服务器端口（默认 8081）
- `host`: Web 服务器绑定地址（默认 0.0.0.0）

#### 2. rooms 板块

- `roomId`: 房间 ID
- `pwd`: 房间密码的 MD5 哈希值
- `remark`: 房间备注说明

#### 3. turnConfig 板块

- `enabled`: 是否启用 TURN 服务器（true/false）
- `turnPort`: TURN 服务器端口（默认 3478）
- `minPort`/`maxPort`: 中继端口范围
- `debugLevel`: 日志级别
- `listeningIps`/`relayIps`: 监听和中继 IP 地址

### 迁移说明

项目现已完全迁移到统一配置文件 `config.json`。旧的配置文件不再支持：

- ~~`turn-config.json`~~ - 已合并到 `config.json` 的 `turnConfig` 板块
- ~~`room_pwd.json`~~ - 已合并到 `config.json` 的 `rooms` 板块

## TURN 服务配置

应用会自动使用内置的 TURN 服务器，每次启动时**自动生成随机的用户名和密码**，无需手动配置认证信息。

### 安全特性

- ✅ 每次启动自动生成随机用户名（10 位字符）
- ✅ 每次启动自动生成随机密码（12 位字符）
- ✅ 使用字母数字混合（a-z, A-Z, 0-9）
- ✅ 前端自动获取最新的 TURN 认证信息

### 默认 TURN 配置

```json
{
  "enabled": true,
  "turnPort": 3478,
  "minPort": 49152,
  "maxPort": 65535,
  "debugLevel": "ERROR",
  "listeningIps": ["0.0.0.0"],
  "relayIps": ["0.0.0.0"],
  "authMech": "long-term"
}
```

### 自定义 TURN 配置

在应用目录下创建 `turn-config.json` 文件来覆盖默认配置（认证信息仍然会自动生成）：

```json
{
  "enabled": false,
  "turnPort": 3478,
  "minPort": 50000,
  "maxPort": 60000,
  "debugLevel": "WARN"
}
```

#### 配置选项说明

- `enabled`: 布尔值，控制是否启用 TURN 服务器（true=启用，false=禁用）
- `turnPort`: TURN 服务器监听端口
- `minPort`/`maxPort`: 中继端口范围
- `debugLevel`: 日志级别（ERROR、WARN、INFO、DEBUG）
- `listeningIps`/`relayIps`: 监听和中继 IP 地址

#### TURN 服务开关

### 使用示例

#### 1. 创建基本配置

```bash
# 复制示例配置文件
cp config.example.json config.json

# 编辑配置文件
nano config.json
```

#### 2. 启动服务

```bash
# 使用配置文件启动
npm start

# 或指定端口覆盖配置
npm start 8082 3479
```

## 安全特性

- ✅ 每次启动自动生成随机 TURN 用户名（10 位字符）
- ✅ 每次启动自动生成随机 TURN 密码（12 位字符）
- ✅ 使用字母数字混合（a-z, A-Z, 0-9）
- ✅ 前端自动获取最新的 TURN 认证信息
- ✅ 统一配置管理，避免配置文件分散

## 防火墙配置

如果启用了 TURN 服务器，需要确保以下端口可访问：

- HTTP 服务端口（默认 8081 或配置文件中的 httpPort）
- TURN 服务端口（默认 3478 或配置文件中的 turnPort）
- TURN 中继端口范围（默认 49152-65535 或配置文件中的范围）

## 常见问题

在线列表看见对方，但一直处于断开的状态且无法发送消息：

- **原因一**：浏览器不支持 WebRTC（目前最新版已经在用户打开后自动检测并加入提示），旧版没有检测功能可以临时用这个进行测试：https://space.coze.cn/s/qDNpw1y7MJw/
- **原因二**：网络环境不支持互相访问
  > **解决方案**：
  >
  > 1. ✅ **使用内置 TURN 服务器**（推荐，已集成）
  >    - 在 `config.json` 中设置 `"turnConfig.enabled": true`
  >    - 确保防火墙开放相应端口
  > 2. **禁用 TURN 服务器**（仅局域网使用）
  >    - 在 `config.json` 中设置 `"turnConfig.enabled": false`
  >    - 适用于同网段内的简单通信

### nginx 代理配置样例

```
server
{
  server_name fagedongxi.com;
  index index.html;
  listen 80;

  location / {
    proxy_pass  http://127.0.0.1:8081/;
  }

  location /ws/ {
      proxy_pass http://127.0.0.1:8081/ws/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

}
```

## 免责声明：

本项目仅用于学习交流，请勿用于非法用途，否则后果自负。
