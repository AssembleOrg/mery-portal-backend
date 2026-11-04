import { MentorshipService, parseExtraSlots } from './mentorship.service';

const NOW = new Date('2026-11-04T15:00:00Z');
const hhmm = (d: string) =>
  new Date(d).toLocaleString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short',
  });

const EXTRA =
  '2026-11-10 11:00-12:00, 2026-11-10 13:00-14:00, 2026-11-10 15:00-16:00, 2026-11-10 17:00-18:00';
// Plantilla real: martes 17-18 y 18-19.
const TEMPLATES = [
  { weekday: 2, startMin: 1020, endMin: 1080, isActive: true },
  { weekday: 2, startMin: 1080, endMin: 1140, isActive: true },
];

function setup(extra = EXTRA, templates: unknown[] = TEMPLATES, booked: Date[] = []) {
  const prisma = {
    mentorshipAvailability: { findMany: jest.fn().mockResolvedValue(templates) },
    mentorship: {
      findMany: jest
        .fn()
        .mockResolvedValue(booked.map((scheduledStart) => ({ scheduledStart }))),
    },
  };
  const settings = { getString: jest.fn().mockResolvedValue(extra) };
  return new MentorshipService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    settings as never,
  );
}

describe('horarios de mentorías', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('el 10/11 suma los puntuales sin repetir las 17 y en orden', async () => {
    const slots = await setup().availableSlots();
    const dia = slots.filter((s) => hhmm(s.start).startsWith('2026-11-10')).map((s) => hhmm(s.start).slice(11));
    expect(dia).toEqual(['11:00', '13:00', '15:00', '17:00', '18:00']);
  });

  it('otros martes siguen solo con la plantilla', async () => {
    const slots = await setup().availableSlots();
    const dia = slots.filter((s) => hhmm(s.start).startsWith('2026-11-17')).map((s) => hhmm(s.start).slice(11));
    expect(dia).toEqual(['17:00', '18:00']);
  });

  it('llega hasta el último martes de 2027 y no pasa de ahí', async () => {
    const slots = await setup().availableSlots();
    const last = hhmm(slots[slots.length - 1].start);
    expect(last).toBe('2027-12-28 18:00');
    expect(new Set(slots.map((s) => s.start)).size).toBe(slots.length);
  });

  it('respeta la anticipación de 3 días también en los puntuales', async () => {
    jest.setSystemTime(new Date('2026-11-08T15:00:00Z'));
    const slots = await setup().availableSlots();
    expect(slots.some((s) => hhmm(s.start).startsWith('2026-11-10'))).toBe(false);
  });

  it('un horario puntual se puede reservar y queda ocupado', async () => {
    const start = new Date('2026-11-10T11:00:00-03:00');
    const slots = await setup(EXTRA, TEMPLATES, [start]).availableSlots();
    const s = slots.find((x) => new Date(x.start).getTime() === start.getTime());
    expect(s?.available).toBe(false);
    expect(hhmm(s!.end).slice(11)).toBe('12:00');
  });

  it('sin plantillas activas igual ofrece los puntuales', async () => {
    const slots = await setup(EXTRA, []).availableSlots();
    expect(slots).toHaveLength(4);
  });

  it('el parser ignora lo que no respeta el formato', () => {
    expect(parseExtraSlots('')).toEqual([]);
    expect(parseExtraSlots('mañana 11hs, 2026-11-10 12:00-11:00, 2026-13-40 11:00-12:00')).toEqual([]);
    expect(parseExtraSlots(' 2026-11-10 11:00-12:00 ,')).toHaveLength(1);
  });
});
