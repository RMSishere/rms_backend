import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://rest.gohighlevel.com/v1',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('🔗 GHL Client initialized → https://rest.gohighlevel.com/v1');
  }

  // Utility method for detailed request logs
  private logRequest(method: string, url: string, payload?: any) {
    this.logger.debug(
      `📤 [GHL REQUEST]
➡️  ${method.toUpperCase()} ${url}
📝 Payload: ${JSON.stringify(payload)}`
    );
  }

  private logResponse(url: string, ms: number, data: any) {
    this.logger.debug(
      `📥 [GHL RESPONSE]
⬅️  ${url}
⏱️  Time: ${ms}ms
📦 Data: ${JSON.stringify(data)}`
    );
  }

  private logError(url: string, ms: number, error: any) {
    this.logger.error(
      `❌ [GHL ERROR]
❗ URL: ${url}
⏱️ Time: ${ms}ms
💥 Error: ${JSON.stringify(error?.response?.data || error.message)}
🧾 Stack: ${error.stack || 'N/A'}`
    );
  }

  // =====================================================
  // CONTACTS (Correct Upsert: POST /contacts/)
  // =====================================================

  async createOrUpdateContact(user: any) {
    const url = `/contacts/`;
    const payload: any = {
      locationId: process.env.GHL_LOCATION_ID,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || undefined,
      phone: user.phoneNumber || undefined,
      postalCode: user.zipCode || undefined,
      tags: user.tags || [],
      source: 'app',
    };

    this.logRequest('post', url, payload);

    const start = Date.now();

    try {
      const res = await this.client.post(url, payload);

      const ms = Date.now() - start;
      this.logResponse(url, ms, res.data);

      const contactId =
        res?.data?.contact?.id ||
        res?.data?.id ||
        null;

      if (!contactId) {
        this.logger.error('❌ No contact ID returned by GHL');
        return null;
      }

      this.logger.log(`✅ Contact Saved → ${contactId}`);
      return contactId;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return null;
    }
  }

  // =====================================================
  // OPPORTUNITIES
  // =====================================================

  async createOpportunity(
    contactId: string,
    pipelineId: string,
    stageId: string,
    extra: any = {}
  ) {
    const url = `/opportunities/`;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      pipelineId,
      stageId,
      name: extra.name || `Lead #${contactId}`,
      status: extra.status || 'active',
      ...extra,
    };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      const res = await this.client.post(url, payload);

      const ms = Date.now() - start;
      this.logResponse(url, ms, res.data);

      const opId = res?.data?.id;
      if (!opId) return null;

      this.logger.log(`🎯 Opportunity Created → ${opId}`);
      return opId;
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

  async moveStage(opportunityId: string, newStageId: string) {
    const url = `/opportunities/${opportunityId}`;
    const payload = { stageId: newStageId };

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

  // =====================================================
  // TAGS
  // =====================================================

  async addTag(contactId: string, tag: string) {
    const url = `/contacts/${contactId}/tags/`;
    const payload = { tags: [tag] };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      await this.client.post(url, payload);

      const ms = Date.now() - start;
      this.logResponse(url, ms, { success: true });

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
      await this.client.delete(url);

      const ms = Date.now() - start;
      this.logResponse(url, ms, { success: true });

      return true;
    } catch (error) {
      const ms = Date.now() - start;
      this.logError(url, ms, error);
      return false;
    }
  }
}
