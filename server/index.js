import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { keyManager } from './services/key-manager.js';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 导入路由
import { loginRouter } from './api/login.js';
import versionRoutes from './api/versions.js';
import downloadRoutes from './api/download.js';

// 注册路由
app.use('/api', loginRouter);
app.use('/api', versionRoutes);
app.use('/api', downloadRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 启动服务器
const startServer = async () => {
  try {
    // 等待密钥管理器初始化完成
    await keyManager.init();
    
    let PORT = parseInt(process.env.PORT) || 8080;
    let attempts = 0;
    const maxAttempts = 10;
    
    const server = app.listen(PORT, () => {
      console.log('');
      console.log(`🚀 Server started at http://localhost:${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Encryption: Enabled (Key ID: ${keyManager.getCurrentKeyId()})`);
      console.log('');
    });
    
    // 捕获服务器错误
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${PORT} is busy, trying another port...`);
        attempts++;
        
        if (attempts <= maxAttempts) {
          PORT++;
          console.log(`🔧 Trying port: ${PORT}`);
          server.listen(PORT);
        } else {
          console.error(`❌ Could not find an available port after ${maxAttempts} attempts`);
        }
      } else {
        console.error('Server error:', err);
      }
    });
    
    // 监听服务器成功启动
    server.on('listening', () => {
      console.log(`✅ Server successfully listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();

export default app;