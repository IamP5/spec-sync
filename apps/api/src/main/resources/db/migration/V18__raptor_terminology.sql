-- Linguistic aliases for the attribute definitions introduced by the Ford Brasil
-- catalog dataset v2 (selectable modes, paddle shifters, headlights, shock absorbers).
-- The join yields nothing until the dataset is imported; apps/ai/data re-runs this
-- file after seeding, exactly like V4.
INSERT INTO catalog.attribute_alias(id,attribute_id,term,language)
SELECT md5(a.id::text || ':' || terms.term)::uuid,a.id,terms.term,'pt-BR'
FROM catalog.attribute_definition a JOIN (VALUES
 ('damper_modes','modos de amortecedor'),('damper_modes','modos de amortecedores'),
 ('damper_modes','modos de suspensão'),('damper_modes','damper modes'),
 ('steering_modes','modos de direção'),('steering_modes','modos de volante'),
 ('steering_modes','modos de direcao'),('steering_modes','steering modes'),
 ('exhaust_modes','modos de escapamento'),('exhaust_modes','modos de escape'),
 ('exhaust_modes','exhaust modes'),
 ('paddle_shifters','paddle shifters'),('paddle_shifters','paddle shifter'),
 ('paddle_shifters','borboletas no volante'),('paddle_shifters','trocas de marcha no volante'),
 ('headlights','faróis'),('headlights','farois'),('headlights','farol'),('headlights','headlights'),
 ('shock_absorbers','amortecedores'),('shock_absorbers','amortecedor'),
 ('shock_absorbers','shock absorbers'),('shock_absorbers','dampers')
) AS terms(code,term) ON a.code=terms.code
ON CONFLICT DO NOTHING;
