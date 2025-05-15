import bcrypt = require('bcrypt');
import crypto = require('crypto');
import zipcodes = require('zipcodes-nearby');
import moment = require('moment');

export const getRandomNumber = (low: number, high: number): number => {
  return Math.floor(Math.random() * (high - low) + low);
};

export const getIntersection = (
  arr1: Array<any>,
  arr2: Array<any>,
): Array<any> => {
  return arr1.filter(dt => arr2.includes(dt));
};

export const getEncryptedPassword = async (
  password: string,
): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const getfullName = (user): string => {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
};

export const verifyPassword = async (
  password: string,
  encryptedPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, encryptedPassword);
};

export const weekOfMonth = m => {
  return (
    m.week() -
    moment(m)
      .startOf('month')
      .week() +
    1
  );
};

export const getDefaulAvatarUrl = (
  firstName: string,
  lastName: string,
): string => {
  return `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=0566A9&color=fff&size=512`;
};

export const capitalize = (text = '', separator = '_'): string => {
  if (!(text.length > 2)) {
    return text;
  }
  return text
    .split(separator)
    .map(word => word[0].toUpperCase() + word.substr(1).toLowerCase())
    .join(' ');
};

export const getNearByZipCodes = (
  zipCode: string,
  radius: number,
): Promise<string[]> => {
  return zipcodes.near(zipCode, radius, { datafile: './src/zipcodes.csv' });
};

export const formatNumberWithCommas = (
  number,
  decPlaces?,
  decSep?,
  thouSep?,
) => {
  decPlaces = isNaN((decPlaces = Math.abs(decPlaces))) ? 2 : decPlaces;
  decSep = typeof decSep === 'undefined' ? '.' : decSep;
  thouSep = typeof thouSep === 'undefined' ? ',' : thouSep;
  const sign = number < 0 ? '-' : '';
  const i = String(
    parseInt((number = Math.abs(Number(number) || 0).toFixed(decPlaces))),
  );
  let j;
  j = i.length > 3 ? j % 3 : 0;

  return (
    sign +
    (j ? i.substr(0, j) + thouSep : '') +
    i.substr(j).replace(/(\decSep{3})(?=\decSep)/g, '$1' + thouSep) +
    (decPlaces
      ? decSep +
        Math.abs(number - +i)
          .toFixed(decPlaces)
          .slice(2)
      : '')
  );
};
export const roundNumber = x => {
  return Math.round((x + Number.EPSILON) * 100) / 100;
};
export const formatMoney = x => {
  if (!x && x !== 0) {
    return;
  }
  const amount = roundNumber(roundNumber(x));
  const commaFormatted = formatNumberWithCommas(amount);
  if (commaFormatted.startsWith('-')) {
    return commaFormatted.replace('-', '-$');
  } else {
    return '$' + commaFormatted;
  }
};

function base64decode(data) {
  while (data.length % 4 !== 0) {
    data += '=';
  }
  data = data.replace(/-/g, '+').replace(/_/g, '/');
  return new Buffer(data, 'base64').toString('utf-8');
}

export function parseFacebookSignedRequest(signedRequest, secret) {
  const encodedData = signedRequest.split('.', 2);
  // decode the data
  const sig = encodedData[0];
  const json = base64decode(encodedData[1]);
  const data = JSON.parse(json);
  if (!data.algorithm || data.algorithm.toUpperCase() != 'HMAC-SHA256') {
    throw Error(
      'Unknown algorithm: ' + data.algorithm + '. Expected HMAC-SHA256',
    );
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedData[1])
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace('=', '');
  if (sig !== expectedSig) {
    throw Error('Invalid signature: ' + sig + '. Expected ' + expectedSig);
  }
  return data;
}

export function getAgreement(leads = [], affiliate) {
  if (leads && leads.length) {
    return (
      leads.find(lead => lead.affiliate?.email === affiliate?.email)
        ?.agreement || {}
    );
  }
  return {};
}

export const getAffilaiteChargeForItem = (
  item,
  isVal = false,
): number | string => {
  if (isVal === true) {
    let charge = 0;
    if (item.affiliateCommissionCharge) {
      charge += item.amount * (item.affiliateCommissionCharge / 100);
    }

    if (item.affiliateCommissionCharge) {
      charge += item.affiliateFlatFeeCharge;
    }
    return charge;
  }

  return [
    {
      text: `${formatMoney(
        item.amount * (item.affiliateCommissionCharge / 100),
      )} (${item.affiliateCommissionCharge}% Commission)`,
      display: !!item.affiliateCommissionCharge,
    },
    {
      text: `${formatMoney(item.affiliateFlatFeeCharge)} (Flat Fee)`,
      display: !!item.affiliateFlatFeeCharge,
    },
  ]
    .filter(dt => dt.display)
    .map(dt => dt.text)
    .join(' + ');
};

export const getClientCutForItem = (item, isVal) => {
  const afCharge = getAffilaiteChargeForItem(item, true);
  if (isVal) {
    return item.amount - +afCharge;
  }
  return formatMoney(item.amount - +afCharge);
};
