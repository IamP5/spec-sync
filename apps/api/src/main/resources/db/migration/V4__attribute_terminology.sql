-- Linguistic aliases only. Manufacturer functional equivalences require separate evidence.
INSERT INTO catalog.attribute_alias(id,attribute_id,term,language)
SELECT md5(a.id::text || ':' || terms.term)::uuid,a.id,terms.term,'pt-BR'
FROM catalog.attribute_definition a JOIN (VALUES
 ('power_max','potência'),('power_max','potencia'),('power_max','power'),
 ('torque_max','torque'),('camera_360','câmera 360'),('camera_360','camera 360'),
 ('rear_suspension','suspensão traseira'),('rear_suspension','rear suspension'),
 ('adaptive_cruise','piloto automático adaptativo'),('adaptive_cruise','adaptive cruise'),
 ('stability_control','controle de estabilidade'),('drivetrain','tração'),
 ('transmission','câmbio'),('driving_modes','modos de condução')
) AS terms(code,term) ON a.code=terms.code
ON CONFLICT DO NOTHING;
