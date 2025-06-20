const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const setupMiddleware = (app) => {
  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
  }));
  app.use(morgan('combined'));
  app.use(express.json({ limit: '10mb' }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
};

module.exports = setupMiddleware;