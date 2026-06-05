import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { differenceInDays } from 'date-fns';

@Injectable()
export class CompanyDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.companyDocument.findMany({
      where: { companyId },
      include: { uploader: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, dto: {
    docName: string; docType: string; notes?: string; expiresAt?: string;
  }, uploadedBy: string) {
    const company = await this.prisma.clientCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.companyDocument.create({
      data: {
        companyId,
        docName: dto.docName,
        docType: dto.docType,
        notes: dto.notes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        uploadedBy,
      },
    });
  }

  async uploadFile(companyId: string, docId: string, file: Express.Multer.File) {
    const doc = await this.prisma.companyDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');

    const key = `company-documents/${companyId}/${docId}/${file.originalname}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.companyDocument.update({
      where: { id: docId },
      data: { fileS3Key: key, status: 'SUBMITTED' },
    });
  }

  async getDownloadUrl(docId: string): Promise<string> {
    const doc = await this.prisma.companyDocument.findUnique({ where: { id: docId } });
    if (!doc || !doc.fileS3Key) throw new NotFoundException('File not uploaded yet');
    return this.storage.getSignedUrl(doc.fileS3Key);
  }

  async update(docId: string, dto: {
    status?: string; notes?: string; expiresAt?: string; docName?: string;
  }) {
    return this.prisma.companyDocument.update({
      where: { id: docId },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.docName && { docName: dto.docName }),
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
      },
    });
  }

  async remove(docId: string) {
    const doc = await this.prisma.companyDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.fileS3Key) {
      await this.storage.delete(doc.fileS3Key).catch(() => {});
    }
    return this.prisma.companyDocument.delete({ where: { id: docId } });
  }

  async findExpiring(days = 30) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.companyDocument.findMany({
      where: { expiresAt: { lte: cutoff, gte: new Date() }, status: { not: 'EXPIRED' } },
      include: {
        company: { select: { id: true, name: true } },
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runExpiryCheck() {
    const expiring30 = await this.findExpiring(30);
    const now = new Date();

    for (const doc of expiring30) {
      const daysLeft = differenceInDays(doc.expiresAt!, now);
      const isUrgent = daysLeft <= 7;

      await this.notifications.send(
        doc.uploadedBy,
        'GENERAL',
        `Document expiring ${isUrgent ? 'SOON' : 'in 30 days'}`,
        `"${doc.docName}" for ${doc.company.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        doc.id,
        'company_document',
      );

      if (daysLeft <= 0) {
        await this.prisma.companyDocument.update({
          where: { id: doc.id },
          data: { status: 'EXPIRED' },
        });
      }
    }
  }
}
