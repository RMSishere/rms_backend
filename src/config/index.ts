export const paginationLimit = 10;

export * from './services';

export const GLOBAL_PREFIX = 'api/v1';

export const USER_ROLES = {
  ADMIN: 1,
  AFFILIATE: 2,
  CLIENT: 3,
};

export const MAIL_FROM = {
  UPDATE: 'update@runmysale.com',
  AFFILIATE: 'affiliate@runmysale.com',
};

export const MAIL_TEMPLATES = {
  HELP_MESSAGE: 'helpMessage',
  REQUEST_REPORT: 'requestReport',
  REPORT_USER: 'reportUser',
  NEW_MESSAGE: 'newMessage',
  NEW_REQUEST: 'newRequest',
  APPOINTMENT_REMINDERS: {
    ON_APPOINTMENT_DATE: 'appointmentReminders/onAppointmentDate',
    TWO_WEEKS_BEFORE: 'appointmentReminders/twoWeeksBefore',
    ONE_WEEK_BEFORE: 'appointmentReminders/oneWeekBefore',
  },
};

export const NOTIFICATION_TYPES = {
  APP_UPDATES: {
    title: 'App Updates',
    desc: 'Find out whenever we make updates to RunMySale!',
    forRoles: [USER_ROLES.AFFILIATE, USER_ROLES.CLIENT],
    type: 'APP_UPDATES',
  },
  PROMOTIONS: {
    title: 'Promotions',
    desc: 'Get exclusive deals that save you or make you $.',
    forRoles: [USER_ROLES.AFFILIATE, USER_ROLES.CLIENT],
    type: 'PROMOTIONS',
  },
  JOB_STATUS_UPDATES: {
    title: 'Job Status Updates',
    desc: 'Be notified about the status of your jobs.',
    forRoles: [USER_ROLES.AFFILIATE, USER_ROLES.CLIENT],
    type: 'JOB_STATUS_UPDATES',
  },
  VALUE_EMAILS: {
    title: 'Value Emails',
    desc:
      'Receive a variety of emails providing you with ways to live a happier, healthier and more successful life.',
    forRoles: [USER_ROLES.AFFILIATE, USER_ROLES.CLIENT],
    type: 'VALUE_EMAILS',
  },
  NEW_JOB: {
    title: 'New Jobs',
    desc: 'Get notified about new jobs in your area!',
    forRoles: [USER_ROLES.AFFILIATE],
    type: 'NEW_JOB',
  },
};

export const NOTIFICATION_CHANNELS = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
};

export const METERS_PER_MILE = 1609;

export const API_MESSAGES = {
  TOKEN_EXPIRED: 'User session expired!',
  SERVER_ERROR:
    'Could not process your request. Please try again after some time!',
  PHONE_UNVERIFIED: 'Phone number unverified!',
};

export const defaultLeadCalculations = [
  { minCount: 1, maxCount: 1, price: '50' },
  { minCount: 2, maxCount: 2, price: '50' },
  { minCount: 3, maxCount: 3, price: '20' },
  { minCount: 4, maxCount: 4, price: '15' },
  { minCount: 5, maxCount: 5, price: '14' },
  { minCount: 6, maxCount: 10, price: '12' },
  { minCount: 11, maxCount: 15, price: '9' },
  { minCount: 16, maxCount: Number.MAX_SAFE_INTEGER, price: '5' },
];

export const SOCKET_EVENTS = {
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  MESSAGE_SENT: 'MESSAGE_SENT',
  READ_MESSAGE: 'READ_MESSAGE',
  NEW_MESSAGE: 'NEW_MESSAGE',
  UPDATE_MESSAGE: 'UPDATE_MESSAGE',
  MARK_MESSAGES_READ: 'MARK_MESSAGES_READ',
  UPDATE_USER_NOTIFICATIONS: 'UPDATE_USER_NOTIFICATIONS',
};

export const TWILIO_CHANNEL = {
  SMS: 'sms',
  CALL: 'call',
  EMAIL: 'email',
};

export const REQUEST_STATUS = {
  INIT: 'INIT',
  JOB: 'JOB',
  PAUSE: 'PAUSE',
  CLOSE: 'CLOSE',
};

export const PAYMENT_STATUS = {
  CREATED: { label: 'Failed', value: 'CREATED' },
  COMPLETED: { label: 'Success', value: 'COMPLETED' },
};

export const PAYMENT_TYPES = {
  PURCHASE_LEAD: 'PURCHASE_LEAD',
  FINALIZE_SALE: 'FINALIZE_SALE',
};

export const CHARGE_BASIS = {
  COMMISSION: 'COMMISSION',
  FLAT_FEE: 'FLAT_FEE',
  HOURLY: 'HOURLY',
};

export enum SCHEDULE_JOB {
  SEND_MAIL = 'SEND_MAIL',
}

export const SCHEDULE_JOB_TYPES = [SCHEDULE_JOB.SEND_MAIL];

export enum NOTIFICATION_MESSAGE_TYPE {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
}