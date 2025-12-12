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

    this.logger.log('🔗 GHL Client initialized with baseURL = https://rest.gohighlevel.com/v1');
  }

  // =====================================================
  // CONTACTS (Correct Upsert Method)
  // =====================================================

  async createOrUpdateContact(user: any) {
    try {
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

      this.logger.debug(
        `📩 GHL Contact Upsert Payload → ${JSON.stringify(payload)}`
      );

      const res = await this.client.post('/contacts/upsert', payload);

      const contactId =
        res?.data?.contact?.id ||
        res?.data?.id ||
        null;

      if (!contactId) {
        this.logger.error('❌ No contact ID returned by GHL');
        return null;
      }

      this.logger.log(`✅ GHL Contact Saved (ID = ${contactId})`);
      return contactId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOrUpdateContact failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
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
    try {
      if (!contactId) throw new Error('Contact ID missing');

      const payload = {
        locationId: process.env.GHL_LOCATION_ID,
        contactId,
        pipelineId,
        stageId,
        name: extra.name || `Lead #${contactId}`,
        status: extra.status || 'active',
        ...extra,
      };

      this.logger.debug(
        `📩 GHL Create Opportunity Payload → ${JSON.stringify(payload)}`
      );

      const res = await this.client.post('/opportunities/', payload);
      const oppId = res?.data?.id;

      if (!oppId) {
        this.logger.error('❌ GHL createOpportunity returned no ID');
        return null;
      }

      this.logger.log(`✅ Opportunity Created (ID = ${oppId})`);
      return oppId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOpportunity failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
      return null;
    }
  }

  async updateOpportunity(opportunityId: string, updates: any) {
    try {
      if (!opportunityId)
        throw new Error('updateOpportunity called with NULL ID');

      this.logger.debug(
        `📩 GHL Update Opportunity (${opportunityId}) → ${JSON.stringify(
          updates
        )}`
      );

      const res = await this.client.put(
        `/opportunities/${opportunityId}`,
        updates
      );

      return res?.data || null;
    } catch (error) {
      this.logger.error(
        `❌ GHL updateOpportunity failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
      return null;
    }
  }

  async moveStage(opportunityId: string, newStageId: string) {
    try {
      if (!opportunityId) throw new Error('NULL opportunityId');

      const payload = { stageId: newStageId };

      this.logger.debug(
        `🔄 GHL Move Stage (${opportunityId}) → stage=${newStageId}`
      );

      await this.client.put(`/opportunities/${opportunityId}`, payload);

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL moveStage failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
      return false;
    }
  }

  // =====================================================
  // TAGS
  // =====================================================

  async addTag(contactId: string, tag: string) {
    try {
      if (!contactId) throw new Error('NULL contactId');

      this.logger.debug(`🏷️ Adding Tag "${tag}" to contact ${contactId}`);

      await this.client.post(`/contacts/${contactId}/tags/`, {
        tags: [tag],
      });

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL addTag failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
      return false;
    }
  }

  async removeTag(contactId: string, tag: string) {
    try {
      if (!contactId) throw new Error('NULL contactId');

      this.logger.debug(`🗑️ Removing Tag "${tag}" from contact ${contactId}`);

      await this.client.delete(`/contacts/${contactId}/tags/${tag}`);

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL removeTag failed → ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
      return false;
    }
  }
}
