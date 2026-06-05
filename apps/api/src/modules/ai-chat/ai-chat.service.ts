import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';

const OWNER_EMAILS = [
  'ashwani@nexgenpharmasolutions.com',
  'pratham.s@nexgenpharmasolutions.com',
];

@Injectable()
export class AIChatService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

  private assertOwner(email: string) {
    if (!OWNER_EMAILS.includes(email.toLowerCase())) {
      throw new ForbiddenException('AI Chat is restricted to owners only');
    }
  }

  // Context builder — uses only models that exist in the current schema
  private async buildContext(): Promise<string> {
    const now = new Date();
    const lines: string[] = ['=== NEXGEN EMS LIVE DATA ===', `Date: ${now.toISOString().split('T')[0]}`, ''];

    try {
      // Employees summary
      const employees = await this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { firstName: true, lastName: true, designation: true, role: true },
        take: 50,
      });
      lines.push('--- ACTIVE EMPLOYEES ---');
      for (const e of employees) {
        lines.push(`• ${e.firstName} ${e.lastName} | ${e.designation ?? 'N/A'} | ${e.role}`);
      }

      // Recent attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAttendance = await this.prisma.attendanceRecord.count({
        where: { date: { gte: today } },
      });
      lines.push('', `--- TODAY'S ATTENDANCE ---`);
      lines.push(`• ${todayAttendance} employees have marked attendance today`);

    } catch {
      lines.push('(Live data temporarily unavailable)');
    }

    return lines.join('\n');
  }

  async sendMessage(sessionId: string, question: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);

    const context = await this.buildContext();

    const prompt = `You are an intelligent assistant for Nexgen Pharma Solutions, a pharma consultancy.
You have access to live EMS data shown below. Answer the owner's question using ONLY this data.
Be concise, direct, and actionable. If the data doesn't contain the answer, say so clearly.

${context}

OWNER'S QUESTION: ${question}`;

    const answer = await this.gemini.generateText(prompt);

    // Store in chatMessage table (using the existing schema model)
    await this.prisma.chatMessage.createMany({
      data: [
        { channelId: sessionId, senderId: userId, content: `[USER] ${question}` },
        { channelId: sessionId, senderId: userId, content: `[AI] ${answer}` },
      ],
    });

    return { answer, sessionId };
  }

  async getHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    return this.prisma.chatMessage.findMany({
      where: { channelId: sessionId, senderId: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async clearHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    await this.prisma.chatMessage.deleteMany({
      where: { channelId: sessionId, senderId: userId },
    });
    return { cleared: true };
  }
}
