/**
 * Definición de los exámenes finales. Hay un examen POR FORMACIÓN (mapa por
 * slug); los cursos sin examen propio caen al examen global.
 *
 * IMPORTANTE: las respuestas correctas (y las explicaciones) viven SOLO acá
 * (server-side). Al frontend únicamente se le mandan id + texto de cada
 * pregunta, en orden mezclado, y el resultado nunca dice qué preguntas
 * estuvieron mal.
 */

export interface QuizQuestionDef {
  id: string;
  text: string;
  /** true = Verdadero, false = Falso */
  correct: boolean;
  /** Justificación (solo referencia interna, NUNCA se envía al alumno). */
  explanation?: string;
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

/** Examen genérico (cejas) — cursos sin examen propio todavía. */
export const GLOBAL_QUIZ: QuizDefinition = {
  maxWrong: 2,
  cooldownHours: 0,
  questions: [
    { id: 'q1', text: 'Siempre debemos quitar la pelusa cuando realizamos Modelado de Cejas.', correct: true },
    { id: 'q2', text: 'No existen productos que estimulen el crecimiento del vello de las cejas.', correct: false },
    { id: 'q3', text: 'Para que el vello crezca más grueso lo debo cortar.', correct: false },
    { id: 'q4', text: 'Un hueco en la ceja significa que ahí no volverá a crecer más pelo.', correct: false },
    { id: 'q5', text: 'No es posible recuperar el vello en una cicatriz.', correct: true },
    { id: 'q6', text: 'Maquillar las cejas en tonos suaves hará que luzcan más naturales y orgánicas.', correct: false },
    { id: 'q7', text: 'Al igual que en el cuero cabelludo, las cejas pueden tener remolinos.', correct: true },
    { id: 'q8', text: 'El alisado de cejas se puede realizar en todos los casos porque deja el pelo peinado hacia arriba.', correct: false },
    { id: 'q9', text: 'Cuando la capacidad hormonal disminuye, también lo hace la calidad del vello, el cual se afina y pueden llegar a aparecer huecos.', correct: true },
    { id: 'q10', text: 'En todos los casos que veamos falta de vello estaremos frente a algún tipo de alopecia.', correct: false },
  ],
};

/** Examen de Estilismo de Cejas (aplica también a Auto Styling). */
export const ESTILISMO_QUIZ: QuizDefinition = {
  maxWrong: 0,
  cooldownHours: 0,
  questions: [
    {
      id: 'est1',
      text: 'El modelado de las cejas es solo para clientas que quieren afinarlas.',
      correct: false,
      explanation:
        'El modelado de cejas, valiéndonos del corte, a veces el entresacado y la depilación pelo por pelo, permite rediseñar proporciones que pueden dar sensación de cejas más tupidas, más largas e incluso más anchas. (Capítulo 2)',
    },
    {
      id: 'est2',
      text: 'Una correcta densidad en el diseño de las cejas puede generar sensación de "lifting" y mayor elegancia en la mirada. Por el contrario, una densidad opuesta genera expresión estática de "enojo" y falta de naturalidad.',
      correct: true,
      explanation:
        'Valernos del peso en la trama con más densidad ayuda a lograr elegancia y armonía sin necesidad de maquillar, depilar o tatuar de más las cejas. (Capítulo 2)',
    },
    {
      id: 'est3',
      text: 'El laminado de cejas se puede realizar sin modelado ni Refill siempre que se quiera lucir las cejas peinadas para arriba (fluffy brows).',
      correct: false,
      explanation:
        'El laminado no es un pedido estético de la clienta sino una herramienta para mejorar la estructura de las cejas, ganar ancho o usar pelos con direcciones que no cubren la piel. No es recomendable para cejas muy anchas, gruesas y enruladas; se ve natural en cejas menos pobladas y de pelo fino. El modelado es fundamental en el 90% de los casos. (Capítulo 2)',
    },
    {
      id: 'est4',
      text: 'El corte en cejas se realiza en línea recta con total control para que los vellos queden del mismo largo y altura.',
      correct: false,
      explanation:
        'El corte SIEMPRE se hace uno a uno, con la punta de la tijera y acomodando los vellos para ir revisando el resultado constantemente.',
    },
  ],
};

/** Examen de Microblading (Módulo II). */
export const MICROBLADING_QUIZ: QuizDefinition = {
  maxWrong: 0,
  cooldownHours: 0,
  questions: [
    {
      id: 'mb1',
      text: 'El error más sencillo a la hora de tatuar es generar una profundidad mayor a la dermis superficial.',
      correct: false,
      explanation:
        'Es la razón más habitual por la que el pigmento explota, vira el color y se vuelve irreversible.',
    },
    {
      id: 'mb2',
      text: 'Una misma combinación de pigmentos garantiza los resultados.',
      correct: false,
      explanation:
        'Depende de la temperatura de la piel, retención de tinta, estilo de vida y cuidados posteriores.',
    },
    {
      id: 'mb3',
      text: 'Mientras más oscuro es el color del pigmento, más posibilidad de que se revele frío y azulado.',
      correct: true,
      explanation:
        'Los marrones oscuros tienen en su composición más cantidad de azul por cada parte de amarillo y rojo. Por eso es fundamental comenzar con combinaciones medias de intensidad y temperatura.',
    },
    {
      id: 'mb4',
      text: 'En la primera y la segunda sesión siempre se deben utilizar dos combinaciones de pigmentos diferentes para que al cicatrizar no se genere una mancha.',
      correct: true,
      explanation:
        'Para lograr un resultado 3D debe haber una figura y un fondo, para que no se empaste el diseño.',
    },
    {
      id: 'mb5',
      text: 'El Microblading bien realizado estimula el crecimiento del pelo.',
      correct: true,
      explanation:
        'Siempre que no haya anomalías en el ciclo vital del pelo y la implantación del pigmento no genere cicatriz por profundidad exagerada, se espera mayor cantidad y calidad de pelo. Por eso se recomienda hacer los retoques pasados los 30 o 40 días.',
    },
    {
      id: 'mb6',
      text: 'Puedo realizar retoques a los 15 días si la clienta es joven.',
      correct: false,
      explanation:
        'No se recomienda realizar una nueva sesión de microblading antes de los 30 días bajo ninguna circunstancia.',
    },
  ],
};

/** Examen por slug. Los cursos sin entrada usan el examen global. */
const QUIZ_BY_SLUG: Record<string, QuizDefinition> = {
  'estilismo-de-cejas': ESTILISMO_QUIZ,
  'auto-styling-estilismo-de-cejas': ESTILISMO_QUIZ,
  'modulo-ii-microblading-mg': MICROBLADING_QUIZ,
};

export function getQuizForSlug(slug?: string): QuizDefinition {
  return (slug && QUIZ_BY_SLUG[slug]) || GLOBAL_QUIZ;
}

/** Todos los cursos exigen aprobar el examen para desbloquear la mentoría/chat. */
export function isQuizRequiredForSlug(_slug?: string): boolean {
  return true;
}
