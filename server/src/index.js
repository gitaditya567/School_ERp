import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { startReconciler } from './controllers/paymentController.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());
const ATOM_HOSTS = ['https://*.atomtech.in', ...[process.env.ATOM_CDN_URL, process.env.ATOM_AUTH_URL]
  .filter(Boolean).map((u) => { try { return new URL(u).origin; } catch { return null; } }).filter(Boolean)];
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      // the Atom checkout script, its frame and its calls must be allowed when this server serves the app
      scriptSrc: ["'self'", ...ATOM_HOSTS],
      frameSrc: ["'self'", ...ATOM_HOSTS],
      connectSrc: ["'self'", ...ATOM_HOSTS],
      imgSrc: ["'self'", 'data:', 'blob:', ...ATOM_HOSTS],
      formAction: ["'self'", ...ATOM_HOSTS],
    },
  },
}));
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Behind nginx: take the client IP from X-Forwarded-For, otherwise every user shares one rate-limit bucket.
app.set('trust proxy', 1);
// Only the password endpoints are rate-limited; /auth/me and /auth/status run on every page load.
const loginLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
app.use(['/api/auth/login', '/api/auth/bootstrap'], loginLimit);
app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.use('/api', routes);

// serve the built React app in production
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../client/dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
    startReconciler(); // confirms online payments left pending (closed browser, bank delay)
  })
  .catch((err) => { console.error('Could not start:', err.message); process.exit(1); });
