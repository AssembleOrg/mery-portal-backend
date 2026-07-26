/**
 * Definición del examen final. Es **uno solo para todos los cursos**: al
 * terminar cualquier categoría el alumno rinde este mismo examen y recién
 * ahí se le desbloquea el chat.
 *
 * IMPORTANTE: las respuestas correctas viven SOLO acá (server-side).
 * Al frontend únicamente se le mandan id + texto de cada pregunta, y el
 * resultado nunca dice qué preguntas estuvieron mal.
 */

export interface QuizQuestionDef {
  id: string;
  text: string;
  /** true = Verdadero, false = Falso */
  correct: boolean;
}

export interface QuizDefinition {
  /** Cantidad máxima de respuestas incorrectas para aprobar */
  maxWrong: number;
  /**
   * Horas de espera entre intentos fallidos. 0 = puede reintentar cuando
   * quiera (el alumno puede volver a ver el curso las veces que necesite).
   */
  cooldownHours: number;
  questions: QuizQuestionDef[];
}

/** Examen único, común a todos los cursos. */
export const GLOBAL_QUIZ: QuizDefinition = {
  maxWrong: 2,
  cooldownHours: 0,
  questions: [
    {
      id: 'q1',
      text: 'Siempre debemos quitar la pelusa cuando realizamos Modelado de Cejas.',
      correct: true,
    },
    {
      id: 'q2',
      text: 'No existen productos que estimulen el crecimiento del vello de las cejas.',
      correct: false,
    },
    {
      id: 'q3',
      text: 'Para que el vello crezca más grueso lo debo cortar.',
      correct: false,
    },
    {
      id: 'q4',
      text: 'Un hueco en la ceja significa que ahí no volverá a crecer más pelo.',
      correct: false,
    },
    {
      id: 'q5',
      text: 'No es posible recuperar el vello en una cicatriz.',
      correct: true,
    },
    {
      id: 'q6',
      text: 'Maquillar las cejas en tonos suaves hará que luzcan más naturales y orgánicas.',
      correct: false,
    },
    {
      id: 'q7',
      text: 'Al igual que en el cuero cabelludo, las cejas pueden tener remolinos.',
      correct: true,
    },
    {
      id: 'q8',
      text: 'El alisado de cejas se puede realizar en todos los casos porque deja el pelo peinado hacia arriba.',
      correct: false,
    },
    {
      id: 'q9',
      text: 'Cuando la capacidad hormonal disminuye, también lo hace la calidad del vello, el cual se afina y pueden llegar a aparecer huecos.',
      correct: true,
    },
    {
      id: 'q10',
      text: 'En todos los casos que veamos falta de vello estaremos frente a algún tipo de alopecia.',
      correct: false,
    },
  ],
};

/** Todos los cursos exigen examen: siempre devuelve el examen global. */
export function getQuizForSlug(_slug?: string): QuizDefinition {
  return GLOBAL_QUIZ;
}

/** Todos los cursos exigen aprobar el examen para desbloquear el chat. */
export function isQuizRequiredForSlug(_slug?: string): boolean {
  return true;
}
