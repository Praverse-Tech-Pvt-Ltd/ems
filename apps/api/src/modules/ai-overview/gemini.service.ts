import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelName = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    if (apiKey && apiKey !== 'AIzaSy_your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('Gemini API key not configured — AI features will return stubs');
    }
  }

  private get model() {
    if (!this.genAI) return null;
    return this.genAI.getGenerativeModel({ model: this.modelName });
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.model) return '[AI summary unavailable — configure GEMINI_API_KEY]';
    try {
      const result = await this.generateWithFallback(prompt);
      return result.response.text();
    } catch (err) {
      this.logger.error('Gemini generation failed', err);
      return '[AI generation error]';
    }
  }

  private async generateWithFallback(prompt: string) {
    const candidateModels = [
      this.modelName,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
    ].filter((model, index, models) => model && models.indexOf(model) === index);

    let lastError: unknown;
    for (const modelName of candidateModels) {
      try {
        const model = this.genAI!.getGenerativeModel({ model: modelName });
        return await model.generateContent(prompt);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('404') && !message.includes('not found') && !message.includes('not supported')) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async extractMeetingNote(rawText: string): Promise<Record<string, string>> {
    const prompt = `You are an assistant for a pharma consultancy EMS. Extract structured data from this meeting note.

Meeting note: "${rawText}"

Extract and return ONLY a valid JSON object with these fields (use null if not found):
{
  "companyName": "company/client name mentioned",
  "employeeName": "employee/person discussed",
  "workDiscussed": "what work was discussed",
  "assignedTo": "who is responsible",
  "deadline": "deadline date in YYYY-MM-DD format or null",
  "currentStatus": "current work status",
  "pendingGap": "what is pending or incomplete",
  "followUpAction": "what should be done next",
  "priorityLevel": "HIGH or MEDIUM or LOW",
  "ownerNote": "any note visible to owner/management"
}

Return only the JSON, no explanation.`;

    const text = await this.generateText(prompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : {};
    } catch {
      return {};
    }
  }

  async structureWorkUpdate(rawText: string, companyHint?: string): Promise<Record<string, string>> {
    const prompt = `You are an assistant for a pharma consultancy EMS. Structure this employee work update.

Update: "${rawText}"
${companyHint ? `Company context: ${companyHint}` : ''}

Return ONLY a valid JSON object:
{
  "companyName": "company name from the update or null",
  "taskCompleted": "what was completed",
  "pendingTask": "what is still pending",
  "progress": "Partial / Complete / Not Started",
  "contribution": "brief description of the contribution",
  "workStatus": "In Progress / Completed / Blocked",
  "nextAction": "suggested next step",
  "needsAdminReview": false
}

Return only the JSON, no explanation.`;

    const text = await this.generateText(prompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : {};
    } catch {
      return {};
    }
  }

  /**
   * Detects whether a chat message is asking the assistant to take a concrete
   * EMS action (assign a visit, create a follow-up, schedule an event, or
   * update a company's notes/stage) and extracts the parameters needed to
   * actually perform it — this is what gives the AI chat "write access":
   * recognized actions are executed by AIChatService, not just described.
   */
  async detectActionRequest(question: string): Promise<Record<string, any>> {
    const prompt = `You are an operations assistant for a pharma consultancy EMS that can directly perform actions when asked.

Message: "${question}"

Decide if the message is asking you to DO something actionable in the system (not just answer a question). If so, return ONLY a valid JSON object:
{
  "action": "ASSIGN_VISIT" | "CREATE_FOLLOW_UP" | "SCHEDULE_EVENT" | "UPDATE_COMPANY_NOTE" | null,
  "companyName": "client company name mentioned, or null",
  "employeeName": "team member's first name to assign/notify, or null",
  "date": "ISO date YYYY-MM-DD for the visit/event/deadline, or null",
  "title": "short title for the calendar event/task, or null",
  "reason": "purpose / notes / what to record, or null"
}

Examples of actionable requests: "assign Shifa to visit Romano Drugs next Tuesday", "schedule an audit prep meeting with Bhageria on June 20", "create a follow-up for Dilip on Vemed's batch record gap by Friday", "update Cohesion Biotec's stage to onboarding complete".
If the message is just a question, observation, or update (not a request to schedule/assign/create/update something), return {"action": null}.

Return only the JSON, no explanation.`;

    const text = await this.generateText(prompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : { action: null };
    } catch {
      return { action: null };
    }
  }

  async generateCompanySummary(companyData: {
    name: string;
    businessStatus: string;
    criticality: string;
    lastVisitDate: string | null;
    lastCommunicationDate: string | null;
    nextAuditDate: string | null;
    recentUpdates: string[];
    pendingTasks: string[];
    riskScore: number;
  }): Promise<string> {
    const prompt = `You are an AI assistant for Nexgen Pharma Solutions, a pharma consultancy. Generate a concise 3-4 sentence executive summary for this client company.

Company: ${companyData.name}
Status: ${companyData.businessStatus}
Criticality: ${companyData.criticality}
Risk Score: ${companyData.riskScore}/100
Last Visit: ${companyData.lastVisitDate || 'Not recorded'}
Last Communication: ${companyData.lastCommunicationDate || 'Not recorded'}
Next Audit: ${companyData.nextAuditDate || 'Not scheduled'}
Recent Updates: ${companyData.recentUpdates.join('; ') || 'None'}
Pending Tasks: ${companyData.pendingTasks.join('; ') || 'None'}

Write a clear, professional summary of where this company stands and what needs attention. Focus on action items.`;

    return this.generateText(prompt);
  }

  async generateNextAction(companyData: {
    name: string;
    businessStatus: string;
    criticality: string;
    daysSinceVisit: number | null;
    daysSinceCommunication: number | null;
    nextAuditDate: string | null;
    pendingTasks: string[];
  }): Promise<string> {
    const prompt = `You are an AI assistant for Nexgen Pharma Solutions. Recommend the single most important next action for this client.

Company: ${companyData.name}
Status: ${companyData.businessStatus}
Criticality: ${companyData.criticality}
Days since last visit: ${companyData.daysSinceVisit ?? 'Unknown'}
Days since last communication: ${companyData.daysSinceCommunication ?? 'Unknown'}
Next audit date: ${companyData.nextAuditDate || 'Not scheduled'}
Pending tasks: ${companyData.pendingTasks.join('; ') || 'None'}

Give ONE specific, actionable recommendation in 1-2 sentences.`;

    return this.generateText(prompt);
  }

  async generateWeeklyOwnerSummary(data: {
    totalCompanies: number;
    activeCompanies: number;
    atRiskCompanies: string[];
    dormantCompanies: string[];
    upcomingAudits: Array<{ company: string; date: string }>;
    employeeContributions: Array<{ name: string; updates: number }>;
    noRecentActivity: string[];
    pendingMeetingReviews: number;
  }): Promise<string> {
    const prompt = `Generate a weekly management summary for Nexgen Pharma Solutions (pharma consultancy).

Data:
- Total client companies: ${data.totalCompanies}
- Active: ${data.activeCompanies}
- At Risk: ${data.atRiskCompanies.join(', ') || 'None'}
- Dormant: ${data.dormantCompanies.join(', ') || 'None'}
- Upcoming audits: ${data.upcomingAudits.map(a => `${a.company} on ${a.date}`).join(', ') || 'None'}
- Companies with no recent activity: ${data.noRecentActivity.join(', ') || 'None'}
- Employee updates this week: ${data.employeeContributions.map(e => `${e.name}: ${e.updates}`).join(', ')}
- Meeting notes needing review: ${data.pendingMeetingReviews}

Write a structured weekly summary (5-8 sentences) covering: what needs immediate attention, what is progressing well, what should be discussed in next internal meeting, and key recommendations for this week.`;

    return this.generateText(prompt);
  }

  async interpretRisk(companyData: {
    name: string;
    daysSinceVisit: number | null;
    daysSinceCommunication: number | null;
    nextAuditDate: string | null;
    missedCommitments: boolean;
    pendingDocuments: number;
  }): Promise<string> {
    const prompt = `Briefly explain in 1-2 sentences why this pharma client might be at risk, based on the data:

Company: ${companyData.name}
Days since visit: ${companyData.daysSinceVisit ?? 'Unknown'}
Days since communication: ${companyData.daysSinceCommunication ?? 'Unknown'}
Upcoming audit: ${companyData.nextAuditDate || 'None'}
Missed commitments: ${companyData.missedCommitments ? 'Yes' : 'No'}
Pending documents: ${companyData.pendingDocuments}

Be concise and specific.`;

    return this.generateText(prompt);
  }
}
