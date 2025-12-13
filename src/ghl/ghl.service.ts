import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface OpportunityExtra {
  name?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  [key: string]: any;
}

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);

  private clientV1: AxiosInstance; // Contacts + Tags
  private clientV2: AxiosInstance; // Opportunities (LeadConnector)

  constructor() {
    const GHL_PIT = 'pit-e5b6c5d7-2704-47f1-acfd-b21f4584367d';

    // ------------------------------------------------
    // V1 CLIENT — Contacts & Tags (API KEY)
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
    // V2 CLIENT — Opportunities (PIT REQUIRED)
    // ------------------------------------------------
    this.clientV2 = axios.create({
      baseURL: 'https://services.leadconnectorhq.com',
      headers: {
        Authorization: `Bearer ${GHL_PIT}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('🔗 GHL Clients initialized → V1(API Key) | V2(PIT)');
  }

  // ------------------------------------------------
  // LOGGING HELPERS
  // ------------------------------------------------
  private logRequest(method: string, url: string, payload?: any) {
    this.logger.debug(
      `📤 [GHL REQUEST]
➡️ ${method.toUpperCase()} ${url}
📝 ${payload ? JSON.stringify(payload) : '—'}`
    );
  }

  private logResponse(url: string, ms: number, data: any) {
    this.logger.debug(
      `📥 [GHL RESPONSE]
⬅️ ${url}
⏱️ ${ms}ms
📦 ${JSON.stringify(data)}`
    );
  }

  private logError(url: string, ms: number, error: any) {
    this.logger.error(
      `❌ [GHL ERROR]
❗ URL: ${url}
⏱️ ${ms}ms
💥 ${JSON.stringify(error?.response?.data || error.message)}`
    );
  }

  // =====================================================
  // CONTACTS (V1)
  // =====================================================
  async createOrUpdateContact(user: any): Promise<string | null> {
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
  // OPPORTUNITIES (V2) — CREATE (NO stageId)
  // =====================================================
  async createOpportunity(
    contactId: string,
    pipelineId: string,
    extra: OpportunityExtra = {}
  ): Promise<string | null> {
    // Check if opportunity already exists for the contact
    const existingOpportunity = await this.getOpportunityByContactId(contactId);
    if (existingOpportunity) {
      this.logger.warn(`⚠️ Opportunity already exists for contact: ${contactId}`);
      return existingOpportunity.id; // Return existing opportunity id to avoid duplication
    }

    const url = `/opportunities/`;
    const { name, status, ...rest } = extra;

    const payload = {
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      pipelineId,
      status: status ?? 'open', // ✅ VALID VALUES ONLY
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

  // =====================================================
  // OPPORTUNITIES (V2) — GET OPPORTUNITY BY CONTACT ID
  // =====================================================
  async getOpportunityByContactId(contactId: string): Promise<any | null> {
    const url = `/opportunities/?contactId=${contactId}`;
    this.logRequest('get', url);

    const start = Date.now();

    try {
      const res = await this.clientV2.get(url);
      this.logResponse(url, Date.now() - start, res.data);
      return res.data?.[0] || null; // Assuming GHL API returns an array of opportunities
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return null;
    }
  }

  // =====================================================
  // OPPORTUNITIES (V2) — UPDATE / MOVE STAGE
  // =====================================================
  async updateOpportunity(
    opportunityId: string,
    updates: any
  ): Promise<any | null> {
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

  async moveStage(opportunityId: string, stageId: string) {
    return this.updateOpportunity(opportunityId, { stageId });
  }

  // =====================================================
  // TAGS (V1)
  // =====================================================
  async addTag(contactId: string, tag: string): Promise<boolean> {
    const url = `/contacts/${contactId}/tags/`;
    const payload = { tags: [tag] };

    this.logRequest('post', url, payload);
    const start = Date.now();

    try {
      await this.clientV1.post(url, payload);
      return true;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return false;
    }
  }

  async removeTag(contactId: string, tag: string): Promise<boolean> {
    const url = `/contacts/${contactId}/tags/${tag}`;

    this.logRequest('delete', url);
    const start = Date.now();

    try {
      await this.clientV1.delete(url);
      return true;
    } catch (error) {
      this.logError(url, Date.now() - start, error);
      return false;
    }
  }
}
