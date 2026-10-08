import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MentorshipService } from './mentorship.service';

const ID = 'm1';
const P = 'mentorships/u1/c1/';

function setup(over: Record<string, unknown> = {}) {
  const row = {
    id: ID,
    userId: 'u1',
    categoryId: 'c1',
    status: 'SCHEDULED',
    scheduledStart: new Date(Date.now() + 86_400_000),
    scheduledEnd: new Date(Date.now() + 90_000_000),
    rescheduleCount: 0,
    meetingEmail: 'a@b.c',
    googleMeetLink: null,
    material: { box: [{ key: `${P}old`, url: 'x' }], sheet: [], dislike: [], like: [], notStaff: false },
    category: { slug: 'estilismo-de-cejas' },
    ...over,
  };
  const prisma = {
    mentorship: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn(({ data }) => Promise.resolve({ ...row, ...data })),
    },
  };
  const storage = { publicUrl: (k: string) => `https://cdn/${k}`, deleteKey: jest.fn() };
  const svc = new MentorshipService(prisma as never, {} as never, {} as never, {} as never, {} as never, storage as never);
  return { svc, storage };
}

const dto = (o: Record<string, unknown> = {}) => ({
  box: [`${P}a`, `${P}b`],
  sheet: [`${P}c`],
  dislike: [],
  like: [],
  notStaff: false,
  ...o,
});

describe('MentorshipService material', () => {
  it('guarda, arma URLs y borra del bucket lo que se quitó', async () => {
    const { svc, storage } = setup();
    const res = await svc.saveMaterial('u1', ID, dto());
    expect(res.material?.box[0].url).toBe(`https://cdn/${P}a`);
    expect(res.materialRequired).toBe(true);
    expect(res.materialComplete).toBe(false);
    expect(storage.deleteKey).toHaveBeenCalledWith(`${P}old`);
  });

  it('completo con 2+1+3+3 y notStaff', async () => {
    const { svc } = setup();
    const three = [`${P}1`, `${P}2`, `${P}3`];
    const res = await svc.saveMaterial('u1', ID, dto({ dislike: three, like: three, notStaff: true }));
    expect(res.materialComplete).toBe(true);
  });

  it.each([
    ['key de otra carpeta', dto({ box: ['chats/x/evil'] })],
    ['key de otra alumna', dto({ box: ['mentorships/u2/c1/x'] })],
    ['path traversal', dto({ box: [`${P}../other`] })],
    ['más del máximo', dto({ like: [`${P}1`, `${P}2`, `${P}3`, `${P}4`], notStaff: true })],
    ['referencias sin notStaff', dto({ like: [`${P}1`] })],
  ])('rechaza: %s', async (_, body) => {
    const { svc } = setup();
    await expect(svc.saveMaterial('u1', ID, body)).rejects.toThrow(BadRequestException);
  });

  it('rechaza mentoría ajena, curso sin material y mentoría ya empezada', async () => {
    await expect(setup().svc.saveMaterial('otra', ID, dto())).rejects.toThrow(ForbiddenException);
    await expect(
      setup({ category: { slug: 'microblading' } }).svc.saveMaterial('u1', ID, dto()),
    ).rejects.toThrow(BadRequestException);
    await expect(
      setup({ scheduledStart: new Date(Date.now() - 1000) }).svc.saveMaterial('u1', ID, dto()),
    ).rejects.toThrow(BadRequestException);
  });
});
