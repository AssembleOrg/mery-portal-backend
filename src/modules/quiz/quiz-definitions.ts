/**
 * Definiciones de exámenes finales por categoría (keyed por slug).
 *
 * IMPORTANTE: las respuestas correctas viven SOLO acá (server-side).
 * Al frontend únicamente se le mandan id + texto de cada pregunta.
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
  /** Horas de espera entre intentos fallidos */
  cooldownHours: number;
  questions: QuizQuestionDef[];
}

const ESTILISMO_CEJAS_QUIZ: QuizDefinition = {
  maxWrong: 1,
  cooldownHours: 24,
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

/** Categorías (por slug) que exigen aprobar el examen para desbloquear el chat */
const QUIZ_BY_CATEGORY_SLUG: Record<string, QuizDefinition> = {
  'estilismo-de-cejas': ESTILISMO_CEJAS_QUIZ,
  'auto-styling-estilismo-de-cejas': ESTILISMO_CEJAS_QUIZ,
  'brow-essentials-private-sessions': ESTILISMO_CEJAS_QUIZ,
};

export function getQuizForSlug(slug: string): QuizDefinition | null {
  return QUIZ_BY_CATEGORY_SLUG[slug] ?? null;
}

export function isQuizRequiredForSlug(slug: string): boolean {
  return slug in QUIZ_BY_CATEGORY_SLUG;
}
