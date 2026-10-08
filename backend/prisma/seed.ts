import { PrismaClient, UserRole, ExamStatus, QuestionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@anomalydash.local' }, update: {},
    create: { name: 'Demo Faculty', email: 'faculty@anomalydash.local', role: UserRole.FACULTY },
  });
  const existing = await prisma.exam.findFirst({ where: { title: 'Computer Networks — Mid Term' } });
  if (!existing) {
    await prisma.exam.create({ data: {
      title: 'Computer Networks — Mid Term', subject: 'Computer Networks', durationMin: 60, status: ExamStatus.LIVE, facultyId: faculty.id,
      questions: { create: [
        { type: QuestionType.MCQ, prompt: 'Which protocol provides reliable transport?', marks: 2, options: JSON.stringify(['UDP', 'TCP', 'IP', 'ARP']), answerKey: 'TCP' },
        { type: QuestionType.DESCRIPTIVE, prompt: 'Explain the role of congestion control in computer networks.', marks: 8, answerKey: 'Reference answer stored for semantic comparison.' }
      ] }
    } });
  }
  console.log('AnomalyDash demo database seeded.');
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());