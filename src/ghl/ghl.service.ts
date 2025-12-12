import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface OpportunityExtra {
  name?: string;
  status?: string;
  [key: string]: any;
}

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);

  private clientV1: AxiosInstance; // Contacts + Tags API
  private clientV2: AxiosInstance; // Opportunities API (LeadConnector)

  constructor() {
    // ------------------------------------------------
    // V1 CLIENT (contacts + tags)
    // ------------------------------------------------
    this.clientV1 = axios.create({
      baseURL: 'https://rest.gohighlevel.com/v1',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    // ------------------------------------------------
    // V2 CLIENT (opportunities)
    // *** FIXED: Version header added ***
    // ------------------------------------------------
    this.clientV2 = axios.create({
      baseURL: 'https://services.leadconnectorhq.com',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',  // 🔥 REQUIRED! fixes 401 error
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('🔗 GHL Clients initialized → V1 & V2 ready');
  }

  // ------------------------------------------------
  // LOGGING HELPERS
  // ------------------------------------------------
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

  // =====================================================
  // CONTACTS (V1)
  // =====================================================
  async createOrUpdateContact(user: any) {
    const url = `/contacts/`;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phoneNumber,
      postalCode: user.zipCode,
      tags: user.tags || [],
      source: 'app',
    };

    this.logRequest('post', url, payload);

    const start = Date.now();

    try {
      const res = await this.clientV1.post(url, payload);
      this.logResponse(url, Date.now() - start, res.data);

      return res.data?.contact?.id || res.data?.id || null;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return null;
    }
  }

  // =====================================================
  // OPPORTUNITIES (V2)
  // =====================================================
  async createOpportunity(
    contactId: string,
    pipelineId: string,
    stageId: string,
    extra: OpportunityExtra = {}
  ) {
    const url = `/opportunities/`;

    const { name, status, ...rest } = extra;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      pipelineId,
      stageId,
      status: status ?? 'active',
      name: name ?? `Lead ${contactId}`,
      ...rest,
    };

    this.logRequest('post', url, payload);

    const start = Date.now();

    try {
      const res = await this.clientV2.post(url, payload);
      this.logResponse(url, Date.now() - start, res.data);

      return res.data?.id || null;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return null;
    }
  }

  async updateOpportunity(opportunityId: string, updates: any) {
    const url = `/opportunities/${opportunityId}`;

    this.logRequest('put', url, updates);

    const start = Date.now();

    try {
      const res = await this.clientV2.put(url, updates);
      this.logResponse(url, Date.now() - start, res.data);

      return res.data;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return null;
    }
  }

  async moveStage(opportunityId: string, newStageId: string) {
    return this.updateOpportunity(opportunityId, { stageId: newStageId });
  }

  // =====================================================
  // TAGS (V1)
  // =====================================================
  async addTag(contactId: string, tag: string) {
    const url = `/contacts/${contactId}/tags/`;
    const payload = { tags: [tag] };

    this.logRequest('post', url, payload);

    const start = Date.now();

    try {
      const res = await this.clientV1.post(url, payload);
      this.logResponse(url, Date.now() - start, res.data);

      return true;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return false;
    }
  }

  async removeTag(contactId: string, tag: string) {
    const url = `/contacts/${contactId}/tags/${tag}`;

    this.logRequest('delete', url);

    const start = Date.now();

    try {
      const res = await this.clientV1.delete(url);
      this.logResponse(url, Date.now() - start, res.data);

      return true;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return false;
    }
  }
}
