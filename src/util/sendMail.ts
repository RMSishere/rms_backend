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
  preview: false, // ✅ Always disable preview to avoid Node 22+ crash
  views: {
    root: 'src/views/mailTemplates',
    options: {
      extension: 'ejs',
    },
  },
});

export const sendTemplateEmail = async (
  to: string | string[],
  template: string,
  locals: object,
  from?: string,
): Promise<any> => {
  try {
    console.log('📧 Preparing to send email');
    console.log('➡️ To:', to);
    console.log('➡️ Template:', template);
    console.log('➡️ Locals:', JSON.stringify(locals, null, 2));

    const result = await email.send({
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

    console.log('✅ Email sent (email.send result):', result);
    return result;
  } catch (err) {
    console.error('❌ sendTemplateEmail failed:', err);
    throw err;
  }
};
