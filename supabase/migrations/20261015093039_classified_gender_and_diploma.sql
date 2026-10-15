-- Zoekertjes store the team's gender and the trainer diploma (issue #71,
-- J-04, J-08). The create form asked for gender since v0 but never stored it,
-- and kept the trainer's diploma in `position`.
--
-- gender           'heren' or 'dames'. Every senior division is one or the
--                  other, so the two must agree.
-- trainer_diploma  the trainer's diploma, or the minimum a team asks for.

ALTER TABLE public.classifieds
  ADD COLUMN gender text
    CONSTRAINT classifieds_gender_check CHECK (gender IN ('heren', 'dames')),
  ADD COLUMN trainer_diploma text
    CONSTRAINT classifieds_trainer_diploma_check CHECK (trainer_diploma IN (
      'initiator', 'instructeur', 'trainer_c', 'trainer_b', 'trainer_a'
    )),
  ADD CONSTRAINT classifieds_trainer_diploma_type_check CHECK (
    trainer_diploma IS NULL
    OR type IN ('trainer_seeks_team', 'team_seeks_trainer')
  ),
  -- 'nat2_dames' belongs to 'dames'.
  ADD CONSTRAINT classifieds_gender_matches_division CHECK (
    gender IS NULL OR division IS NULL OR split_part(division, '_', 2) = gender
  );

-- Senior divisions only (D-003). NOT VALID: the check applies to every new or
-- changed row, without failing on whatever older rows hold. Keep in sync with
-- RUMOUR_DIVISIONS in lib/rumours.ts.
ALTER TABLE public.classifieds
  ADD CONSTRAINT classifieds_division_check CHECK (division IS NULL OR division IN (
    'liga_heren', 'liga_dames',
    'nat1_heren', 'nat2_heren', 'nat3_heren',
    'nat1_dames', 'nat2_dames', 'nat3_dames',
    'promo1_heren', 'promo2_heren', 'promo3_heren', 'promo4_heren',
    'promo1_dames', 'promo2_dames', 'promo3_dames', 'promo4_dames'
  )) NOT VALID;

-- Move diplomas the old form put in `position` to their own column.
UPDATE public.classifieds
SET trainer_diploma = position, position = NULL
WHERE type = 'trainer_seeks_team'
  AND position IN ('initiator', 'instructeur', 'trainer_c', 'trainer_b', 'trainer_a');

-- Owners set both when they post and when they edit their ad (#72).
GRANT INSERT (gender, trainer_diploma) ON public.classifieds TO authenticated;
GRANT UPDATE (gender, trainer_diploma) ON public.classifieds TO authenticated;
