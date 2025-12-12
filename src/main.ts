require('dotenv').config();
import './polyfills/node-file-polyfill';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// import { readFileSync } from 'fs';
import { WinstonLogger, WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { GLOBAL_PREFIX } from './config';
import path = require('path');

const morgan = require('morgan');

// const httpsOptions =
//   process.env.NODE_ENV === 'production'
//     ? {
//         key: readFileSync(
//           '/etc/letsencrypt/live/api.runmysale.com/privkey.pem',
//         ),
//         cert: readFileSync('/etc/letsencrypt/live/api.runmysale.com/cert.pem'),
//       }
//     : null;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // httpsOptions,
    // logger: false,
  });
  const winstonLogger: WinstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(winstonLogger);
  app.use(
    morgan('combined', {
      stream: {
        write: function(message, encoding) {
          // use the 'info' log level so the output will be picked up by both transports (file and console)
          winstonLogger.log(message);
        },
      },
    }),
  );
  // app.use(function(err, req, res, next) {
  //   winstonLogger.error(
  //     `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${
  //       req.method
  //     } - ${req.ip}`,
  //   );
  //   next(err);
  // });

  app.setBaseViewsDir(path.join(__dirname, '..', 'src/views'));
  app.setViewEngine('ejs');
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.listen(process.env.PORT || 6000 , () => {
    console.log(`Server running on http://localhost:` + (process.env.PORT || 6000));
  });
}
bootstrap();
