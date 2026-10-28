import { mergeVideoProgress } from './video-progress';

describe('mergeVideoProgress', () => {
  it('primera vista: calcula el porcentaje', () => {
    expect(mergeVideoProgress(null, 300, 600, false)).toEqual({
      watchedSeconds: 300,
      progress: 50,
      completed: false,
    });
  });

  it('avanza cuando el reporte es mayor', () => {
    const prev = { watchedSeconds: 100, progress: 17, completed: false };
    expect(mergeVideoProgress(prev, 580, 600, true)).toEqual({
      watchedSeconds: 580,
      progress: 97,
      completed: true,
    });
  });

  it('un video completo no vuelve a 0 si lo reabre y sale al segundo', () => {
    const prev = { watchedSeconds: 580, progress: 97, completed: true };
    expect(mergeVideoProgress(prev, 1, 609, false)).toEqual(prev);
  });

  it('un video a medias tampoco retrocede', () => {
    const prev = { watchedSeconds: 400, progress: 66, completed: false };
    expect(mergeVideoProgress(prev, 30, 609, false)).toEqual(prev);
  });

  it('sin duración no inventa porcentaje', () => {
    expect(mergeVideoProgress(null, 30, null, false).progress).toBe(0);
  });
});
