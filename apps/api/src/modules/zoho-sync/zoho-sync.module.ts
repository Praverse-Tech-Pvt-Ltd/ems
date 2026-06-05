import { Module } from '@nestjs/common';

/**
 * TIER 3 — Zoho Workplace Integration (NOT YET IMPLEMENTED)
 *
 * Planned integrations:
 * 1. Zoho Mail sync → populate ClientCommunication.zohoEmailId from email threads
 * 2. Zoho Calendar sync → populate CalendarEvent.zohoEventId (two-way sync)
 * 3. Zoho WorkDrive → store CompanyDocument files in WorkDrive instead of R2
 * 4. Zoho CRM → push ClientCompany updates to Zoho CRM pipeline
 *
 * Required env vars (add when ready):
 *   ZOHO_CLIENT_ID=
 *   ZOHO_CLIENT_SECRET=
 *   ZOHO_REDIRECT_URI=
 *   ZOHO_REFRESH_TOKEN=
 *
 * DB table to add (migration tier3_zoho):
 *   model ZohoOAuthToken {
 *     id           String   @id @default(uuid())
 *     service      String   // "calendar" | "mail" | "crm"
 *     accessToken  String
 *     refreshToken String
 *     expiresAt    DateTime
 *     createdAt    DateTime @default(now())
 *   }
 *
 * WhatsApp integration entry point:
 *   ClientCommType.WHATSAPP is already in the enum.
 *   Implement ClientCommunicationsService.sendWhatsapp() when WATI/Twilio key is ready.
 *   Env: WHATSAPP_API_KEY=
 */
@Module({})
export class ZohoSyncModule {}
