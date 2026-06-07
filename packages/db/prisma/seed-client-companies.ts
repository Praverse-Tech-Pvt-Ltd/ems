import { CompanyBusinessStatus, CompanyCriticality, PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

type ClientSeed = {
  name: string;
  address?: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  businessStatus: CompanyBusinessStatus;
  criticality: CompanyCriticality;
  currentStage: string;
  notes: string;
  riskScore: number;
};

const CLIENT_COMPANIES: ClientSeed[] = [
  {
    name: 'Bhageria Industries Limited',
    address: 'Plot No. 12, Phase II, GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat 382445',
    city: 'Ahmedabad',
    contactEmail: 'compliance@bhageria.com',
    contactPhone: '+91-79-25830000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'Annual regulatory audit preparation',
    notes: 'Key client in dyes & specialty chemicals sector with pharma-grade intermediates. Annual WHO-GMP audit scheduled. Document gap identified in SOP revision log. High engagement priority.',
    riskScore: 52,
  },
  {
    name: 'Unimark Remedies Limited',
    address: '3rd Floor, Unimark House, Judges Bungalow Road, Bodakdev, Ahmedabad, Gujarat 380054',
    city: 'Ahmedabad',
    contactEmail: 'regulatory@unimarkremedies.com',
    contactPhone: '+91-79-40080000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'WHO-GMP compliance dossier review',
    notes: 'Unimark is a major API and formulation manufacturer exporting to regulated markets. Requires quarterly compliance reporting and WHO-GMP gap analysis. Strong relationship maintained with QA head.',
    riskScore: 40,
  },
  {
    name: 'Almon Healthcare Pvt Ltd',
    address: 'B-12, Siddhivinayak Complex, Akota, Vadodara, Gujarat 390020',
    city: 'Vadodara',
    contactEmail: 'info@almonhealthcare.com',
    contactPhone: '+91-265-2320000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'Post-audit compliance rectification',
    notes: 'Almon is a Vadodara-based formulation company with focus on generic OSD products. Recently cleared an FDCA audit. Currently tracking CAPA closure for 3 minor observations. Next visit due in 30 days.',
    riskScore: 35,
  },
  {
    name: 'Bills Biotech Pvt Ltd',
    address: '23, Shreeji Industrial Park, Makarpura GIDC, Vadodara, Gujarat 390010',
    city: 'Vadodara',
    contactEmail: 'qa@billsbiotech.com',
    contactPhone: '+91-265-2640000',
    businessStatus: CompanyBusinessStatus.DELAYED,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'Regulatory dossier delayed — escalated',
    notes: 'Biotechnology client with delayed DCGI submission. Dossier was due in April 2026 but client is awaiting bioequivalence study results. Risk of penalty if not filed by July 2026. Escalated to Ashwani.',
    riskScore: 68,
  },
  {
    name: 'Vemed Pharmaceuticals Pvt Ltd',
    address: 'Survey No. 247, Rania Road, Kadi, Mehsana, Gujarat 382715',
    city: 'Mehsana',
    contactEmail: 'quality@vemedpharma.com',
    contactPhone: '+91-2764-220000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'EU-GMP readiness assessment',
    notes: 'Vemed is pursuing EU-GMP certification for European market entry. NexGen engaged for gap assessment and documentation support. Preliminary gaps identified in batch record traceability. Timeline: 9 months.',
    riskScore: 30,
  },
  {
    name: 'West Coast Pharma',
    address: 'Plot B-56, Naroda Industrial Estate, Naroda, Ahmedabad, Gujarat 382330',
    city: 'Ahmedabad',
    contactEmail: 'director@westcoastpharma.in',
    contactPhone: '+91-79-22820000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'Ongoing quality system review',
    notes: 'Mid-size pharma company focused on bulk generics for institutional supply. Engaged NexGen for quality system overhaul and internal audit schedule. SOP library being restructured. Quarterly billing cycle.',
    riskScore: 28,
  },
  {
    name: 'Romano Drugs',
    address: 'Office No. 5, Shree Complex, Waghodia Road, Vadodara, Gujarat 390019',
    city: 'Vadodara',
    contactEmail: 'compliance@romanodrugs.com',
    contactPhone: '+91-265-2780000',
    businessStatus: CompanyBusinessStatus.AT_RISK,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'FDCA show cause response — urgent',
    notes: 'Romano received an FDCA show cause notice in May 2026. NexGen is supporting response documentation and root cause analysis. Urgent timeline — response due by June 15, 2026. High touch engagement.',
    riskScore: 82,
  },
  {
    name: 'Cohesion Biotec',
    address: 'A-302, BIRAC Supported Incubator, Savli, Vadodara, Gujarat 391770',
    city: 'Vadodara',
    contactEmail: 'ceo@cohesionbiotec.com',
    contactPhone: '+91-265-2590000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.LOW,
    currentStage: 'New client — onboarding',
    notes: 'Early-stage biotech startup focusing on biosimilar development. NexGen engaged as regulatory strategy advisor. Currently mapping regulatory pathway. Initial engagement phase — long-term partnership expected.',
    riskScore: 18,
  },
  {
    name: 'Peak Lifeline',
    address: '12, Anand Nagar Society, Productivity Road, Akota, Vadodara, Gujarat 390020',
    city: 'Vadodara',
    contactEmail: 'info@peaklifeline.in',
    contactPhone: '+91-265-2340000',
    businessStatus: CompanyBusinessStatus.DORMANT,
    criticality: CompanyCriticality.LOW,
    currentStage: 'Dormant — last contact March 2026',
    notes: 'Peak Lifeline account has been quiet since March 2026. No invoice raised in Q1. Follow-up call scheduled but no response. Account marked dormant. Possible churn risk — requires executive outreach.',
    riskScore: 45,
  },
  {
    name: 'Siddharth Interchem',
    address: 'Plot No. 33, GIDC Chemicals Zone, Panoli, Ankleshwar, Gujarat 394116',
    city: 'Ankleshwar',
    contactEmail: 'quality@siddharthinterchem.com',
    contactPhone: '+91-2646-220000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'API manufacturer — ICH Q7 review',
    notes: 'Chemical and API manufacturer engaged for ICH Q7 compliance gap analysis. Strong potential for multi-year engagement. Site visit completed in May 2026. Gap report under preparation — delivery expected June 20.',
    riskScore: 22,
  },
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

  for (const seed of CLIENT_COMPANIES) {
    const { name, address, city, contactEmail, contactPhone, website, businessStatus, criticality, currentStage, notes, riskScore } = seed;

    const existing = await prisma.clientCompany.findFirst({
      where: { name: { equals: name, mode: 'insensitive' as any } },
    });

    const data = {
      shortName: shortName(name),
      industry: 'Pharma',
      address: address ?? null,
      contactEmail: contactEmail ?? null,
      contactPhone: contactPhone ?? null,
      website: website ?? null,
      businessStatus,
      criticality,
      currentStage,
      responsibleEmployeeId: owner.id,
      notes,
      riskScore,
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
          companyId:   company.id,
          entryType:   'STATUS_CHANGE',
          title:       'Client added for AI operations tracking',
          description: 'Client added to EMS so owner AI can analyze updates, meeting notes, alerts, follow-ups, and service gaps.',
          employeeId:  owner.id,
          entryDate:   new Date(),
        },
      });
    }

    console.log(`${existing ? 'Updated' : 'Created'} → ${name} [${businessStatus}, risk ${riskScore}]`);
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
