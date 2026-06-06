import { CompanyBusinessStatus, CompanyCriticality, PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

const CLIENT_COMPANIES = [
  'Bhageria Industries Limited',
  'Unimark Remedies Limited',
  'Almon Healthcare Pvt Ltd',
  'Bills Biotech Pvt Ltd',
  'Vemed Pharmaceuticals Pvt Ltd',
  'West Coast Pharma',
  'Romano Drugs',
  'Cohesion Biotec',
  'Peak Lifeline',
  'Siddharth Interchem',
];

function shortName(name: string) {
  return name
    .replace(/\b(Private|Pvt|Limited|Ltd|Pharmaceuticals|Healthcare|Industries|Remedies|Biotech|Biotec)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const owner =
    (await prisma.employee.findUnique({ where: { email: 'pratham.s@nexgenpharmasolutions.com' } })) ??
    (await prisma.employee.findUnique({ where: { email: 'ashwani@nexgenpharmasolutions.com' } }));

  if (!owner) {
    throw new Error('Cannot seed client companies: Pratham/Ashwani owner account was not found.');
  }

  for (const name of CLIENT_COMPANIES) {
    const existing = await prisma.clientCompany.findFirst({
      where: { name: { equals: name, mode: 'insensitive' as any } },
    });

    const data = {
      shortName: shortName(name),
      industry: 'Pharma',
      businessStatus: CompanyBusinessStatus.ACTIVE,
      criticality: CompanyCriticality.MEDIUM,
      currentStage: 'Client consultation tracking',
      responsibleEmployeeId: owner.id,
      notes:
        'Seeded client account for AI-assisted consultation tracking, work updates, issue analysis, follow-ups, and service monitoring.',
      riskScore: 35,
    };

    const company = existing
      ? await prisma.clientCompany.update({ where: { id: existing.id }, data })
      : await prisma.clientCompany.create({
          data: {
            name,
            ...data,
            createdBy: owner.id,
          },
        });

    const hasSeedEntry = await prisma.companyTimelineEntry.findFirst({
      where: {
        companyId: company.id,
        entryType: 'STATUS_CHANGE',
        title: 'Client added for AI operations tracking',
      },
    });

    if (!hasSeedEntry) {
      await prisma.companyTimelineEntry.create({
        data: {
          companyId: company.id,
          entryType: 'STATUS_CHANGE',
          title: 'Client added for AI operations tracking',
          description:
            'Client added to EMS so owner AI can analyze updates, meeting notes, alerts, follow-ups, and service gaps.',
          employeeId: owner.id,
          entryDate: new Date(),
        },
      });
    }

    console.log(`${existing ? 'Updated' : 'Created'} ${name}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
