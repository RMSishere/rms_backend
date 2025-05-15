import { Client } from '@googlemaps/google-maps-services-js';

export const geoClient = new Client({});

export const getLatLongFromZipcode = async (
  zipCode: string,
): Promise<{ lat: number; lng: number }> => {
  const key = process.env.GOOGLE_MAP_KEY;
  console.log('[Google Geocode] Zip Code:', zipCode);
  console.log('[Google Geocode] Using API Key:', key);

  try {
    const response = await geoClient.geocode({
      params: {
        components: `postal_code:${zipCode}`,
        key,
      },
      timeout: 10000,
    });

    console.log('[Google Geocode] API Response:', JSON.stringify(response.data, null, 2));

    return response.data.results[0].geometry.location;
  } catch (error) {
    console.error('[Google Geocode] Request failed:', error.response?.data || error.message);
    throw error;
  }
};

