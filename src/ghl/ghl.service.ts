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
        'Content-Type': 'application/json',
      },
    });
  }

  // =====================================================
  // CONTACTS
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
        tags: user.tags || [], // optional but useful
        source: 'app',
      };

      this.logger.debug(
        `📩 GHL Contact Create/Update Payload → ${JSON.stringify(payload)}`
      );

      // GHL does upsert automatically by email
      const res = await this.client.post('/contacts/', payload);

      const contactId =
        res?.data?.contact?.id || res?.data?.id || null;

      if (!contactId) {
        this.logger.error('❌ No contact ID returned by GHL');
        return null;
      }

      this.logger.debug(`✅ GHL Contact Saved: ${contactId}`);
      return contactId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOrUpdateContact failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
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

      this.logger.debug(`✅ GHL Opportunity Created: ${oppId}`);
      return oppId;
    } catch (error) {
      this.logger.error(
        `❌ GHL createOpportunity failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
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
        `❌ GHL updateOpportunity failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
      );
      return null;
    }
  }

  async moveStage(opportunityId: string, newStageId: string) {
    try {
      if (!opportunityId) throw new Error('NULL opportunityId');

      const payload = { stageId: newStageId };

      this.logger.debug(
        `🔄 GHL Move Stage (${opportunityId}) → ${newStageId}`
      );

      await this.client.put(`/opportunities/${opportunityId}`, payload);

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL moveStage failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
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

      this.logger.debug(`🏷️ Add Tag → ${tag} to ${contactId}`);

      const payload = { tags: [tag] };

      await this.client.post(`/contacts/${contactId}/tags/`, payload);

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL addTag failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
      );
      return false;
    }
  }

  async removeTag(contactId: string, tag: string) {
    try {
      if (!contactId) throw new Error('NULL contactId');

      this.logger.debug(`❌ Remove Tag → ${tag} from ${contactId}`);

      await this.client.delete(`/contacts/${contactId}/tags/${tag}`);

      return true;
    } catch (error) {
      this.logger.error(
        `❌ GHL removeTag failed → ${
          JSON.stringify(error.response?.data || error.message)
        }`
      );
      return false;
    }
  }
}
