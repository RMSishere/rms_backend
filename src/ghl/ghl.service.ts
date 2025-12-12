import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://services.leadconnectorhq.com',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: '2021-07-28',
      },
    });
  }

  // ================================================
  // CONTACTS
  // ================================================

  async createOrUpdateContact(user: any) {
    try {
      const payload: any = {
        locationId: process.env.GHL_LOCATION_ID,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || undefined,
        phone: user.phoneNumber || undefined,
      };

      this.logger.debug(`📩 GHL Contact Upsert Payload → ${JSON.stringify(payload)}`);

      const res = await this.client.post('/contacts/upsert', payload);

      const contactId = res?.data?.contact?.id;
      if (!contactId) {
        this.logger.error(`❌ GHL Upsert returned no contact ID`);
        return null;
      }

      return contactId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOrUpdateContact failed: ${error.response?.data || error.message}`,
      );
      return null;
    }
  }

  // ================================================
  // OPPORTUNITIES
  // ================================================

  /**
   * Correct signature:
   * createOpportunity(contactId, pipelineId, stageId, extra?)
   */
  async createOpportunity(
    contactId: string,
    pipelineId: string,
    stageId: string,
    extra: any = {},
  ) {
    try {
      const payload = {
        contactId,
        pipelineId,
        stageId,
        locationId: process.env.GHL_LOCATION_ID,
        name: extra.name || 'Lead',
        ...extra,
      };

      this.logger.debug(`📩 GHL Create Opportunity Payload → ${JSON.stringify(payload)}`);

      const res = await this.client.post('/opportunities/', payload);
      const oppId = res?.data?.id;

      if (!oppId) {
        this.logger.error('❌ GHL createOpportunity returned no ID');
        return null;
      }

      return oppId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOpportunity failed: ${error.response?.data || error.message}`,
      );
      return null;
    }
  }

  async updateOpportunity(opportunityId: string, updates: any) {
    try {
      if (!opportunityId) {
        this.logger.error(`❌ updateOpportunity called with null opportunityId`);
        return null;
      }

      this.logger.debug(
        `📩 GHL Update Opportunity (${opportunityId}) → ${JSON.stringify(updates)}`,
      );

      const payload: any = {};
      if (updates.name) payload.name = updates.name;
      if (updates.pipelineId) payload.pipelineId = updates.pipelineId;
      if (updates.stageId) payload.stageId = updates.stageId;

      const res = await this.client.put(`/opportunities/${opportunityId}`, payload);
      return res?.data || null;
    } catch (error) {
      this.logger.error(
        `❌ GHL updateOpportunity failed: ${error.response?.data || error.message}`,
      );
      return null;
    }
  }

  async moveStage(opportunityId: string, newStageId: string) {
    try {
      if (!opportunityId) {
        this.logger.error(`❌ moveStage called with NULL opportunityId`);
        return false;
      }

      const payload = { stageId: newStageId };

      this.logger.debug(
        `🔄 GHL Move Stage (${opportunityId}) → Stage: ${newStageId}`,
      );

      await this.client.put(`/opportunities/${opportunityId}`, payload);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL moveStage failed: ${error.response?.data || error.message}`,
      );
      return false;
    }
  }

  // ================================================
  // TAGS
  // ================================================

  async addTag(contactId: string, tag: string) {
    try {
      if (!contactId) {
        this.logger.error('❌ addTag called with NULL contactId');
        return false;
      }

      await this.client.post(`/contacts/${contactId}/tags/${tag}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL addTag failed: ${error.response?.data || error.message}`,
      );
      return false;
    }
  }

  async removeTag(contactId: string, tag: string) {
    try {
      if (!contactId) {
        this.logger.error('❌ removeTag called with NULL contactId');
        return false;
      }

      await this.client.delete(`/contacts/${contactId}/tags/${tag}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL removeTag failed: ${error.response?.data || error.message}`,
      );
      return false;
    }
  }
}
