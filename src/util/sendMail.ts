require('dotenv').config();
import nodemailer = require('nodemailer');
import { MAIL_FROM } from '../config';
import { capitalize, formatMoney } from '../util/index';
import Email = require('email-templates');
import moment = require('moment-timezone');
import sgTransport = require('nodemailer-sendgrid-transport');

const options = {
  auth: {
    api_key: process.env.SEND_GRID_API_KEY,
  },
};

const transporter = nodemailer.createTransport(sgTransport(options));

const email = new Email({
  transport: transporter,
  send: process.env.NODE_ENV === 'production',
  preview: process.env.NODE_ENV !== 'production',
  views: {
    root: 'src/views/mailTemplates',
    options: {
      extension: 'ejs',
    },
  },
});

export const sendTemplateEmail = (
  to: string | string[],
  template: string,
  locals: object,
  from?: string,
): Promise<any> => {
  return email.send({
    template,
    message: {
      from: from || MAIL_FROM.UPDATE,
      to,
    },
    locals: {
      ...locals,
      moment,
      capitalize,
      formatMoney,
    },
  });
};
