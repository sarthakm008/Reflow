import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { env, validateEnvironment } from './config/env.js';
import { connectDatabase, getDatabaseStatus } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.clientOrigin.split(',').map((origin) => origin.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  const database = getDatabaseStatus();
  const connected = Boolean(database?.connected);
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    service: 'reflow-api',
    timestamp: new Date().toISOString(),
    database,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/user', userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

// Start the server only when this file is run directly, not when imported by tests.
const isMainFile = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainFile) {
  const errors = validateEnvironment();
  if (errors.length) {
    console.error('Reflow API configuration error:\n- ' + errors.join('\n- '));
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Reflow API listening on http://localhost:${env.port}`);
    connectDatabase(env.mongoUri)
      .then(() => console.log('MongoDB connected.'))
      .catch((error) => console.error(`MongoDB connection failed: ${error.message}. Health endpoint will report degraded status.`));
  });

  function shutdown(signal) {
    console.log(`${signal} received; shutting down Reflow API.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
