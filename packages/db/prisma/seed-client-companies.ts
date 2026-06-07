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
    currentStage: 'WHO-GMP audit — SOP revision in final review (Ashwani-led, Dilip supporting)',
    notes: 'Key client in dyes & specialty chemicals sector with pharma-grade intermediates. WHO-GMP audit date confirmed for July 2026. Ashwani is leading the project with Dilip assisting on documentation and follow-up; pending compliance actions and client responses are being tracked toward updated EMS reporting. SOP revision log gap closed; final document sign-off pending. Priority: Medium to High.',
    riskScore: 46,
  },
  {
    name: 'Unimark Remedies Limited',
    address: '3rd Floor, Unimark House, Judges Bungalow Road, Bodakdev, Ahmedabad, Gujarat 380054',
    city: 'Ahmedabad',
    contactEmail: 'regulatory@unimarkremedies.com',
    contactPhone: '+91-79-40080000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'Compliance action tracking — Ashwani-led, Dilip supporting',
    notes: 'Unimark is a major API and formulation manufacturer exporting to regulated markets. Project is being led by Ashwani with Dilip providing assistance wherever required; project status, documentation gaps and pending action items are being tracked and updated in EMS under Ashwani\'s ownership. Q2 2026 compliance report submitted on schedule; WHO-GMP gap analysis closed with no major findings. Priority: Medium to High.',
    riskScore: 34,
  },
  {
    name: 'Almon Healthcare Pvt Ltd',
    address: 'B-12, Siddhivinayak Complex, Akota, Vadodara, Gujarat 390020',
    city: 'Vadodara',
    contactEmail: 'info@almonhealthcare.com',
    contactPhone: '+91-265-2320000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'USFDA-readiness initiative — SOP gap review underway (Shifa)',
    notes: 'Almon is a Vadodara-based formulation company with focus on generic OSD products, now being prepared for USFDA compliance under Shifa\'s ownership. Existing SOPs are being assessed against USFDA expectations, required QMS improvements are being planned, and identified gaps are being converted into a structured action plan with regular implementation tracking. 2 of 3 CAPA observations from the earlier FDCA audit remain closed; final observation pending lab requalification. Priority: High. Next action: Shifa to complete the SOP gap review and submit the USFDA-readiness action plan.',
    riskScore: 38,
  },
  {
    name: 'Bills Biotech Pvt Ltd',
    address: '23, Shreeji Industrial Park, Makarpura GIDC, Vadodara, Gujarat 390010',
    city: 'Vadodara',
    contactEmail: 'qa@billsbiotech.com',
    contactPhone: '+91-265-2640000',
    businessStatus: CompanyBusinessStatus.DELAYED,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'Dossier filed — penalty risk averted',
    notes: 'Biotechnology client with previously delayed DCGI submission. Bioequivalence study results came through in late May; dossier was filed June 2, 2026, ahead of the penalty deadline. Ashwani is monitoring the DCGI acknowledgment.',
    riskScore: 50,
  },
  {
    name: 'Vemed Pharmaceuticals Pvt Ltd',
    address: 'Survey No. 247, Rania Road, Kadi, Mehsana, Gujarat 382715',
    city: 'Mehsana',
    contactEmail: 'quality@vemedpharma.com',
    contactPhone: '+91-2764-220000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'WHO-readiness drive — QMS/SOP/DMF build-out, target 16 August 2026 (Chandni)',
    notes: 'Vemed is being made WHO-ready under Chandni\'s sole, focused ownership ahead of the 16 August 2026 deadline. Scope covers preparing WHO-compliant QMS documents, developing/reviewing/finalizing and implementing SOPs, progressing DMF-related work wherever applicable, and a critical review of existing third-party job work — which currently appears inadequate and not aligned with expected compliance standards. Chandni remains dedicated to Vemed until WHO-readiness is achieved. Priority: High. Remarks: major compliance-readiness project requiring focused, uninterrupted ownership.',
    riskScore: 42,
  },
  {
    name: 'West Coast Pharma',
    address: 'Plot B-56, Naroda Industrial Estate, Naroda, Ahmedabad, Gujarat 382330',
    city: 'Ahmedabad',
    contactEmail: 'director@westcoastpharma.in',
    contactPhone: '+91-79-22820000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'Audit window 17–19 June 2026 — Dilip on-site, Ashwani to join post-China',
    notes: 'Mid-size pharma company focused on bulk generics for institutional supply. West Coast\'s audit is scheduled for 17–19 June 2026: Dilip is responsible for the on-site visit and audit support, with Ashwani joining/supporting once he returns from China. Audit observations and compliance gaps are to be documented properly and a post-audit action plan prepared. Priority: High. Next action: Dilip to prepare for the audit visit and coordinate with the West Coast team.',
    riskScore: 48,
  },
  {
    name: 'Romano Drugs',
    address: 'Office No. 5, Shree Complex, Waghodia Road, Vadodara, Gujarat 390019',
    city: 'Vadodara',
    contactEmail: 'compliance@romanodrugs.com',
    contactPhone: '+91-265-2780000',
    businessStatus: CompanyBusinessStatus.AT_RISK,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'FDCA show cause response submitted — project ownership now with Shifa',
    notes: 'Romano received an FDCA show cause notice in May 2026; response documentation and root cause analysis were submitted ahead of the June 15, 2026 deadline. Project responsibility has now been assigned to Shifa, who will start the project plan, perform SOP review, ensure SOP implementation, introduce and align the Romano team with project expectations, and identify compliance gaps for structured action planning. Priority: High. Next action: Shifa to prepare the initial project action plan and start SOP review.',
    riskScore: 70,
  },
  {
    name: 'Cohesion Biotec',
    address: 'A-302, BIRAC Supported Incubator, Savli, Vadodara, Gujarat 391770',
    city: 'Vadodara',
    contactEmail: 'ceo@cohesionbiotec.com',
    contactPhone: '+91-265-2590000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.LOW,
    currentStage: 'Onboarding — regulatory pathway mapped',
    notes: 'Early-stage biotech startup focusing on biosimilar development. Regulatory pathway mapping completed; first formal site visit conducted by Shifa in early June 2026. Moving from onboarding into active advisory phase — long-term partnership expected.',
    riskScore: 16,
  },
  {
    name: 'Siddharth Interchem',
    address: 'Plot No. 33, GIDC Chemicals Zone, Panoli, Ankleshwar, Gujarat 394116',
    city: 'Ankleshwar',
    contactEmail: 'quality@siddharthinterchem.com',
    contactPhone: '+91-2646-220000',
    businessStatus: CompanyBusinessStatus.AT_RISK,
    criticality: CompanyCriticality.HIGH,
    currentStage: 'Data-integrity review — Chandni coordinating, Ashwani directly engaged',
    notes: 'Chemical and API manufacturer engaged for ICH Q7 compliance gap analysis (gap report finalized and shared with the client on June 5, 2026). Chandni is the main point of contact while Ashwani is handling the matter directly. Important compliance note: the client appears to be providing questionable or unreliable data for audit purposes — this must be handled carefully. Nexgen will not implement or support any false, fabricated or non-GMP-compliant data; only genuine, traceable and justifiable data will be accepted, and any unsupported data will be escalated internally before proceeding. Priority: High. Risk: high compliance and data-integrity risk. Next action: Chandni to coordinate cautiously and escalate questionable data to Ashwani.',
    riskScore: 68,
  },
  {
    name: 'Anphar Labs',
    address: 'Plot No. 78, Pharma City Industrial Area, Selaqui, Dehradun, Uttarakhand 248197',
    city: 'Dehradun',
    contactEmail: 'quality@anpharlabs.com',
    contactPhone: '+91-135-2699000',
    businessStatus: CompanyBusinessStatus.ACTIVE,
    criticality: CompanyCriticality.MEDIUM,
    currentStage: 'CP document preparation in progress (Shifa)',
    notes: 'Anphar Labs project responsibility has been assigned to Shifa as the point of contact. CP document preparation is underway and already started; pending sections are being tracked through to completion, with the document to be reviewed for technical accuracy and compliance expectations before the final version is prepared. Priority: Medium to High. Next action: Shifa to complete the pending CP document work and submit it for review.',
    riskScore: 35,
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

  const stalePeak = await prisma.clientCompany.findFirst({
    where: { name: { equals: 'Peak Lifeline', mode: 'insensitive' as any } },
  });

  if (stalePeak) {
    await prisma.$transaction([
      prisma.companyTimelineEntry.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyVisit.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.meetingNote.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.workUpdate.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.calendarEvent.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyStatusHistory.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyAlert.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.followUpTask.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyDocument.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.clientCommunication.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyContact.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.companyProject.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.aISummary.deleteMany({ where: { companyId: stalePeak.id } }),
      prisma.clientCompany.delete({ where: { id: stalePeak.id } }),
    ]);
    console.log('Removed → Peak Lifeline (dormant client, no longer QA-tracked)');
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
