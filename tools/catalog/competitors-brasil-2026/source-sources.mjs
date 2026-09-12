const capturedOn = '2026-09-12';

const page = (key, title, url, publishedOn = null) => ({
  key,
  title,
  url,
  provenance: 'PRIMARY_SOURCE',
  capturedOn,
  publishedOn,
});

export default [
  page(
    'chevrolet_s10',
    'Chevrolet S10 — linha e versões',
    'https://www.chevrolet.com.br/picapes/s10',
  ),
  page(
    'toyota_hilux',
    'Toyota Hilux MY26 — ficha técnica',
    'https://media.toyota.com.br/d400f124-b3ac-4d73-a885-5d6828812f11.pdf',
  ),
  page(
    'mitsubishi_triton',
    'Mitsubishi Nova Triton — configurador',
    'https://www.mitsubishimotors.com.br/configurador/nova-triton',
  ),
  page(
    'gwm_poer',
    'GWM Poer P30 — linha e versões',
    'https://www.gwmmotors.com.br/pt/modelos/poer-p30-exclusive',
  ),
  page(
    'jac_hunter_4work',
    'JAC Hunter 4Work — produto e versões',
    'https://www.jacmotors.com.br/picapes/hunter-4work/',
  ),
  page(
    'jac_hunter_heavy_duty',
    'JAC Hunter Heavy Duty — produto e versões',
    'https://www.jacmotors.com.br/picapes/hunter/',
  ),
  page(
    'ram_dakota',
    'RAM Dakota — configurador',
    'https://www.ram.com.br/picapes/dakota/monte.html',
  ),
  page(
    'nissan_frontier',
    'Nissan Frontier — versões',
    'https://www.nissan.com.br/veiculos/dst-home/frontier-my24.html',
  ),
  page(
    'nissan_frontier_my26',
    'Nissan Frontier MY26 — promoção oficial',
    'https://www.nissan.com.br/proprietarios/promocoes/juntosdenissan-0626.html',
  ),
  page(
    'vw_amarok',
    'Volkswagen Amarok — variantes',
    'https://www.vw.com.br/pt/carros.html/__app/amarok.app',
  ),
  page(
    'fiat_toro',
    'Fiat Toro — configurador',
    'https://toro.fiat.com.br/monte.html',
  ),
  page(
    'ram_rampage',
    'RAM Rampage MY27 — configurador',
    'https://www.ram.com.br/picapes/rampage/monte.html?year=2027',
  ),
  page(
    'ram_rampage_product',
    'RAM Rampage — produto e séries correntes',
    'https://www.ram.com.br/picapes/rampage.html',
  ),
  page(
    'chevrolet_montana',
    'Chevrolet Montana — linha e versões',
    'https://www.chevrolet.com.br/picapes/chevrolet-montana',
  ),
  page(
    'renault_oroch',
    'Renault Oroch — linha e versões',
    'https://www.renault.com.br/veiculos-de-passeio/oroch.html',
  ),
  page(
    'renault_oroch_offers',
    'Renault Oroch — ofertas e anos-modelo',
    'https://www.renault.com.br/veiculos-de-passeio/oroch/ofertas-oroch.html',
  ),
  page('byd_shark', 'BYD Shark — produto', 'https://www.byd.com/br/car/shark'),
  page(
    'ram_1500',
    'RAM 1500 — configurador',
    'https://www.ram.com.br/picapes/1500/monte.html',
  ),
  page(
    'chevrolet_silverado',
    'Chevrolet Silverado — produto',
    'https://www.chevrolet.com.br/picapes/nova-silverado',
  ),
  page(
    'jeep_compass',
    'Jeep Compass MY26 — configurador',
    'https://www.jeep.com.br/compass/monte.html?year=2026',
  ),
  page(
    'toyota_corolla_cross',
    'Toyota Corolla Cross MY26 — ficha técnica',
    'https://media.toyota.com.br/ec6c63c4-38ae-4b47-a411-28386ed83cb9.pdf',
  ),
  page(
    'toyota_corolla_cross_gr',
    'Toyota Corolla Cross GR-Sport 2026',
    'https://www.toyota.com.br/modelos/corolla-cross-gr-sport',
  ),
  page(
    'gwm_haval_h6',
    'GWM Haval H6 2027 Flex — lançamento e versões',
    'https://www.gwmmotors.com.br/pt/media-center/news/2026/gwm-haval-h6-se-torna-o-primeiro-hibrido-plug-in-flex-fabricado-no-brasil-e-fortalece-o-pioneirismo-da-marca-em-eletrificacao',
    '2026-06-09',
  ),
  page(
    'caoa_chery_tiggo_7_sport',
    'CAOA Chery Novo Tiggo 7 Sport 2027',
    'https://caoachery.com.br/novos/tiggo-7-sport-2027',
  ),
  page(
    'caoa_chery_tiggo_7_pro',
    'CAOA Chery Novo Tiggo 7 Pro 2027',
    'https://caoachery.com.br/novos/tiggo-7-pro-2027',
  ),
  page(
    'caoa_chery_tiggo_7_hybrid',
    'CAOA Chery Tiggo 7 Pro Hybrid Max Drive',
    'https://caoachery.com.br/novos/tiggo-7-pro-hybrid-max-drive',
  ),
  page(
    'caoa_chery_tiggo_7_phev',
    'CAOA Chery Tiggo 7 Pro PHEV',
    'https://caoachery.com.br/novos/tiggo-7-pro-plug-in-hybrid',
  ),
  page(
    'gwm_tank_300',
    'GWM Tank 300 PHEV Flex — produto',
    'https://www.gwmmotors.com.br/pt/modelos/tank-300',
  ),
  page(
    'gwm_tank_300_terraforce',
    'GWM Tank 300 TerraForce — produto',
    'https://www.gwmmotors.com.br/pt/modelos/tank-300-terraforce',
  ),
  page(
    'jeep_wrangler',
    'Jeep Wrangler MY26 — configurador',
    'https://www.jeep.com.br/wrangler/monte.html?year=2026',
  ),
  page(
    'byd_sealion_7',
    'BYD Sealion 7 — produto',
    'https://www.byd.com/br/car/sealion7',
  ),
  page(
    'zeekr_7x',
    'Zeekr 7X Flagship AWD — venda no Brasil',
    'https://www.zeekrlife.com/pt-br/posts/suv-zeekr-7x-chega-ao-mercado-de-eletricos-premium',
  ),
  page(
    'volvo_ex40',
    'Volvo EX40 — produto e versões',
    'https://www.volvocars.com/br/cars/ex40-electric/',
  ),
  page(
    'porsche_macan',
    'Porsche Macan elétrico — modelos',
    'https://models.porsche.com/pt-BR/model-start/macan',
  ),
  page(
    'bmw_m2',
    'BMW M2 Coupé — produto e versões',
    'https://www.bmw.com.br/pt/all-models/m-series/bmw-2-series-m-models/m2-coupe-2024-g87.html',
  ),
  page(
    'bmw_m4',
    'BMW M4 Competition — produto e versões',
    'https://www.bmw.com.br/pt/all-models/m-series/bmw-4-series-m-models/bmw-m4-coupe.html',
  ),
  page(
    'renault_master_minibus',
    'Renault Master Minibus — versões e preços',
    'https://www.renault.com.br/veiculos-utilitarios/master-minibus/versoes-e-precos.html',
  ),
  page(
    'renault_master_furgao',
    'Renault Master Furgão — versões e preços',
    'https://www.renault.com.br/veiculos-utilitarios/master-furgao/versoes-e-precos.html',
  ),
  page(
    'renault_master_pro',
    'Renault Master Pro — versões e preços',
    'https://www.renault.com.br/veiculos-utilitarios/master-pro/versoes-e-precos.html',
  ),
  page(
    'renault_master_chassi',
    'Renault Master Chassi — versões e preços',
    'https://www.renault.com.br/veiculos-utilitarios/master-chassi/versoes-e-precos.html',
  ),
  page(
    'fiat_ducato',
    'Fiat Ducato — configurador',
    'https://ducato.fiat.com.br/monte.html',
  ),
  page(
    'toyota_hiace_minibus',
    'Toyota Hiace Minibus — produto',
    'https://www.toyota.com.br/modelos/hiace',
  ),
  page(
    'toyota_hiace_furgao',
    'Toyota Hiace Furgão — produto',
    'https://www.toyota.com.br/modelos/hiace-furgao',
  ),
  page(
    'mercedes_sprinter',
    'Mercedes-Benz Sprinter — tabela oficial agosto de 2026',
    'https://imprensa.mercedes-benz.com.br/storage/files/TannlpO1the8tNK0oKol3AUAZxq7XVaj1Y0GtGLV.pdf',
    '2026-08-01',
  ),
  page(
    'mercedes_esprinter',
    'Mercedes-Benz eSprinter — tabela oficial maio de 2026',
    'https://imprensa.mercedes-benz.com.br/storage/files/wKPVqBLg0GIhl4UpM5XTqwU2YP4FCpnLwyPT5ybr.pdf',
    '2026-05-01',
  ),
  page(
    'iveco_daily_furgao',
    'Iveco Daily Furgão 2026 — ficha técnica',
    'https://www.iveco.com/brasil/-/media/IVECOdotcom/Brasil/ProductBrochures/iveco_daily_furgao-2026-v1.pdf?rev=e3655fa80a434548b0f2682fe7d68c09',
  ),
  page(
    'iveco_daily_chassi',
    'Iveco Daily Chassi-cabine — produto',
    'https://www.iveco.com/brasil/Daily/Daily-Cabine-chassi',
  ),
  page(
    'iveco_edaily',
    'Iveco eDaily — produto',
    'https://www.iveco.com/brasil/eDaily',
  ),
  page(
    'jac_ejv55',
    'JAC E-JV5.5 — produto',
    'https://www.jacmotors.com.br/vans/e-jv55/',
  ),
  page(
    'jac_ejv7l',
    'JAC E-JV7L — produto',
    'https://www.jacmotors.com.br/vans/e-jv7l/',
  ),
  page(
    'jac_ejv12',
    'JAC E-JV12 — produto',
    'https://www.jacmotors.com.br/vans/e-jv12/',
  ),
  page(
    'jac_ejv12_vip',
    'JAC E-JV12 VIP — produto',
    'https://www.jacmotors.com.br/vans/e-jv12-vip/',
  ),
  page(
    'jac_ejvcc',
    'JAC E-JV CC e CC Plus — produto',
    'https://www.jacmotors.com.br/vans/e-jvcc/',
  ),
];
