/** Lo guardado de una vista de video (video_views). */
export interface StoredProgress {
  watchedSeconds: number;
  progress: number;
  completed: boolean;
}

/**
 * Combina el progreso guardado con un reporte nuevo del reproductor. El
 * progreso nunca baja: si la alumna vuelve a abrir un video que ya terminó
 * (arranca desde 0) y sale al segundo, el reporte de "1 segundo" no puede
 * borrarle el video completo. Se queda lo mayor de cada campo.
 */
export function mergeVideoProgress(
  previous: StoredProgress | null,
  watchedSeconds: number,
  duration: number | null,
  completed: boolean,
): StoredProgress {
  const seconds = Math.max(0, Math.floor(watchedSeconds) || 0);
  const reported = duration
    ? Math.min(100, Math.round((seconds / duration) * 100))
    : 0;
  if (!previous) {
    return { watchedSeconds: seconds, progress: reported, completed };
  }
  return {
    watchedSeconds: Math.max(previous.watchedSeconds, seconds),
    progress: Math.max(previous.progress, reported),
    completed: previous.completed || completed,
  };
}
