-- Dedup de respuestas de formularios públicos por email.
-- 1) Nueva columna "email" (extraída del primer campo tipo "email" del form).
-- 2) Backfill desde answers JSON.
-- 3) Borra respuestas duplicadas (conserva la aceptada/invitada, si no la más antigua).
-- 4) Índice único (formId, email). NULLs no colisionan (Postgres).

ALTER TABLE "form_responses" ADD COLUMN "email" TEXT;

-- Backfill: primer campo type='email' de cada form
WITH email_fields AS (
  SELECT DISTINCT ON (f.id)
    f.id AS form_id,
    elem->>'id' AS field_id
  FROM "forms" f,
       jsonb_array_elements(f."fields") WITH ORDINALITY AS t(elem, ord)
  WHERE elem->>'type' = 'email'
  ORDER BY f.id, t.ord
)
UPDATE "form_responses" fr
SET "email" = lower(trim(fr."answers"->>ef.field_id))
FROM email_fields ef
WHERE ef.form_id = fr."formId"
  AND nullif(trim(fr."answers"->>ef.field_id), '') IS NOT NULL;

-- Borrar duplicados: conservar la mejor respuesta por (formId, email).
-- Prioridad: aceptada > invitación enviada > la más antigua.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "formId", "email"
           ORDER BY ("status" = 'accepted') DESC,
                    ("invitationSentAt" IS NOT NULL) DESC,
                    "createdAt" ASC
         ) AS rn
  FROM "form_responses"
  WHERE "email" IS NOT NULL
)
DELETE FROM "form_responses"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "form_responses_formId_email_key" ON "form_responses"("formId", "email");
