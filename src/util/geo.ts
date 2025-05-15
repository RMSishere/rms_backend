import { Client } from '@googlemaps/google-maps-services-js';

export const geoClient = new Client({});

export const getLatLongFromZipcode = (
  zipCode: string,
): Promise<{ lat: number; lng: number }> => {
  return geoClient
    .geocode({
      params: {
        components: `postal_code:${zipCode}`,
        key: process.env.GOOGLE_MAP_KEY,
      },
      timeout: 10000, // milliseconds
    })
    .then(r => {
      return r.data.results[0].geometry.location;
    })
    .catch(e => {
      return Promise.reject(e);
    });
};
