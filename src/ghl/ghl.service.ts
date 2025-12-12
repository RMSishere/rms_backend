import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://rest.gohighlevel.com/v1',   // ✅ OFFICIAL BASE URL
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`, // API KEY (not JWT)
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('🔗 GHL Client initialized → https://rest.gohighlevel.com/v1');
  }

  // ================================================
  // LOGGING HELPERS
  // ================================================
  private logRequest(method: string, url: string, payload?: any) {
    this.logger.debug(
      `📤 [GHL REQUEST]
➡️  ${method.toUpperCase()} ${url}
📝 Payload: ${payload ? JSON.stringify(payload) : '—'}`
    );
  }

  private logResponse(url: string, ms: number, data: any) {
    this.logger.debug(
      `📥 [GHL RESPONSE]
⬅️  ${url}
⏱️  ${ms}ms
📦 ${JSON.stringify(data)}`
    );
  }

  private logError(url: string, ms: number, error: any) {
    this.logger.error(
      `❌ [GHL ERROR]
❗ URL: ${url}
⏱️  ${ms}ms
💥 ${JSON.stringify(error?.response?.data || error.message)}
🧾 ${error.stack || 'N/A'}`
    );
  }

  // ================================================
  // CONTACTS (Upsert)
  // ================================================
  async createOrUpdateContact(user: any) {
    const url = `/contacts/`;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phoneNumber,
      postalCode: user.zipCode,
      tags: user.tags || [],
      source: 'app',
    };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      const res = await this.client.post(url, payload);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);

      return res.data?.contact?.id || res.data?.id || null;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return null;
    }
  }

  // ================================================
  // OPPORTUNITIES
  // ================================================
  async createOpportunity(contactId: string, pipelineId: string, stageId: string, extra: any = {}) {
    const url = `/opportunities/`;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      pipelineId,
      stageId,
      status: 'active',
      name: extra.name || `Lead ${contactId}`,
      ...extra,
    };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      const res = await this.client.post(url, payload);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);

      return res.data?.id || null;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return null;
    }
  }

  async updateOpportunity(opportunityId: string, updates: any) {
    const url = `/opportunities/${opportunityId}`;

    this.logRequest('put', url, updates);
    const start = Date.now();

    try {
      const res = await this.client.put(url, updates);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);
      return res.data;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return null;
    }
  }

  async moveStage(opportunityId: string, stageId: string) {
    const url = `/opportunities/${opportunityId}`;
    const payload = { stageId };

    this.logRequest('put', url, payload);
    const start = Date.now();

    try {
      const res = await this.client.put(url, payload);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);
      return true;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return false;
    }
  }

  // ================================================
  // TAGS
  // ================================================
  async addTag(contactId: string, tag: string) {
    const url = `/contacts/${contactId}/tags/`;
    const payload = { tags: [tag] };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      const res = await this.client.post(url, payload);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);
      return true;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return false;
    }
  }

  async removeTag(contactId: string, tag: string) {
    const url = `/contacts/${contactId}/tags/${tag}`;

    this.logRequest('delete', url);
    const start = Date.now();

    try {
      const res = await this.client.delete(url);
      const ms = Date.now() - start;

      this.logResponse(url, ms, res.data);
      return true;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return false;
    }
  }
}
