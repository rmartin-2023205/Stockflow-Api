import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import inventoryRouter from './modules/inventory/inventory.routes.js';
import salesRouter from './modules/sales/sales.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import organizationsRouter from './modules/organizations/organizations.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';

export const app = express();

// Security and CORS configuration
const allowedOrigins = env.CLIENT_URL
  ? env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/$/, ''))
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`CORS no permitido para el origen: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
}));

// Cookie parser for secure HttpOnly session tokens
app.use(cookieParser());

// Body parser with payload size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API routes under /api
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/dashboard', dashboardRouter);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
