import './polyfills/file-polyfill';
require('dotenv').config();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WinstonLogger, WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { GLOBAL_PREFIX } from './config';
import path = require('path');

import * as express from 'express';
const morgan = require('morgan');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // logger: false,
  });

  /**
   * ✅ IMPORTANT:
   * This must be registered BEFORE setGlobalPrefix()
   * And the path MUST include GLOBAL_PREFIX because it is part of the final route.
   *
   * With GLOBAL_PREFIX = "api/v1"
   * Final URL becomes: /api/v1/subscription/webhook
   */
  app.use(
    `/${GLOBAL_PREFIX}/subscription/webhook`,
    express.raw({ type: 'application/json' }),
  );

  const winstonLogger: WinstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(winstonLogger);

  app.use(
    morgan('combined', {
      stream: {
        write: function (message) {
          winstonLogger.log(message);
        },
      },
    }),
  );

  app.setBaseViewsDir(path.join(__dirname, '..', 'src/views'));
  app.setViewEngine('ejs');

  app.setGlobalPrefix(GLOBAL_PREFIX);

  await app.listen(process.env.PORT || 6000, () => {
    console.log(
      `Server running on http://localhost:${process.env.PORT || 6000}`,
    );
  });
}

bootstrap();
