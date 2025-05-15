import { format, LoggerOptions, transports } from 'winston';
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const rimraf = require('rimraf');

const options = {
  console: {
    level: 'error',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

export const transport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

transport.on('rotate', function(oldFilename, newFilename) {
  const todayDate = new Date();
  const deletingday = new Date(todayDate);
  deletingday.setDate(deletingday.getDate() - 10);
  const hour = deletingday.getHours();
  let date = deletingday.getDate().toString();
  if (date < '10') {
    date = '0' + date;
  }

  let month = (deletingday.getMonth() + 1).toString();
  if (month < '10') {
    month = '0' + month;
  }

  const year = deletingday.getFullYear();
  const delteDate = `${year + '-' + month + '-' + date}`;
  const url = path.join(__dirname, '..', `combined-${delteDate}.log.gz`);
  rimraf.sync(url);
});

export const winstonConfig: LoggerOptions = {
  transports: [
    transport,
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new transports.Console(options.console),
  ],
  exceptionHandlers: [new transports.File({ filename: 'logs/exceptions.log' })],
  format: format.combine(format.timestamp(), format.prettyPrint()),
  exitOnError: false, // do not exit on handled exceptions,
};
