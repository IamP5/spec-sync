import sourceMetadata from './source-metadata.mjs';
import sourceDefinitions from './source-sources.mjs';

const capturedOn = '2026-09-12';
const sources = sourceDefinitions.map((source) => ({
  key: source.key,
  title: source.title,
  path: new URL(source.url).pathname,
  sha256: sourceMetadata.get(source.key),
  provenance: source.provenance,
  upstreamUrls: [source.url],
  capturedOn: source.capturedOn,
  publishedOn: source.publishedOn,
}));

const attribute = (code, label, description, valueType, unit = null) => ({
  code,
  label,
  description,
  valueType,
  unit,
});

const attributes = [
  attribute(
    'body_style',
    'Carroceria',
    'Manufacturer-reported body style.',
    'TEXT',
  ),
  attribute(
    'fuel_type',
    'Combustível',
    'Manufacturer-reported energy carriers.',
    'LIST',
  ),
  attribute(
    'power_max',
    'Potência máxima',
    'Maximum manufacturer-reported power.',
    'NUMBER',
    'cv',
  ),
  attribute(
    'torque_max',
    'Torque máximo',
    'Maximum manufacturer-reported torque.',
    'NUMBER',
    'Nm',
  ),
  attribute(
    'transmission',
    'Transmissão',
    'Manufacturer-reported transmission.',
    'TEXT',
  ),
  attribute(
    'drivetrain',
    'Tração',
    'Manufacturer-reported driven-wheel system.',
    'TEXT',
  ),
  attribute(
    'passenger_capacity',
    'Ocupantes',
    'Maximum occupant capacity.',
    'NUMBER',
  ),
  attribute(
    'battery_usable_capacity',
    'Bateria útil',
    'Manufacturer-reported usable battery capacity.',
    'NUMBER',
    'kWh',
  ),
  attribute(
    'gross_vehicle_weight',
    'Peso bruto total',
    'Maximum gross vehicle weight.',
    'NUMBER',
    'kg',
  ),
];

const specification = (source, attributeCode, value, excerpt) => ({
  attribute: attributeCode,
  value,
  source,
  locator: 'Official current Brazilian product/version material',
  excerpt,
});

const configuration = (
  name,
  modelYear,
  source,
  bodyStyle,
  fuelType,
  extraSpecifications = [],
) => ({
  name,
  market: 'BR',
  modelYear,
  identity: {
    source,
    locator: 'Current Brazilian version/configuration listing',
    excerpt: name,
    note: `Current Brazilian configuration captured on ${capturedOn}; identity and applicability are backed by the cited official manufacturer source.`,
  },
  specifications: [
    specification(source, 'body_style', bodyStyle, bodyStyle),
    specification(source, 'fuel_type', fuelType, fuelType.join(' / ')),
    ...extraSpecifications,
  ],
});

const model = (name, competesWithFord, competitionScope, configurations) => ({
  name,
  competesWithFord,
  competitionScope,
  configurations,
});

const dieselPickup = (name, year, source = 'chevrolet_s10') =>
  configuration(name, year, source, 'Picape cabine dupla', ['Diesel']);
const flexPickup = (name, year, source) =>
  configuration(name, year, source, 'Picape cabine dupla', [
    'Gasolina',
    'Etanol',
  ]);
const suv = (name, year, source, fuelType = ['Gasolina', 'Etanol']) =>
  configuration(name, year, source, 'SUV', fuelType);

const s10Configurations = [
  configuration(
    'Cabine Simples',
    2027,
    'chevrolet_s10',
    'Picape cabine simples',
    ['Diesel'],
  ),
  ...['WT MT', 'WT AT', 'Z71', 'LTZ', 'Trail Boss', 'High Country'].map(
    (name) => dieselPickup(name, 2027),
  ),
];

const hiluxConfigurations = [
  'STD Power Pack 4x4 MT',
  'STD Power Pack 4x4 AT',
  'SR AT',
  'SRV AT',
  'SRX AT',
  'SRX Plus AT',
].map((name) => dieselPickup(name, 2026, 'toyota_hilux'));
hiluxConfigurations.push(
  ...['Cabine Simples 4x4 MT', 'Cabine Simples 4x4 AT'].map((name) =>
    configuration(name, 2026, 'toyota_hilux', 'Picape cabine simples', [
      'Diesel',
    ]),
  ),
  ...['Chassi Cabine Simples 4x4 MT', 'Chassi Cabine Simples 4x4 AT'].map(
    (name) =>
      configuration(name, 2026, 'toyota_hilux', 'Chassi-cabine', ['Diesel']),
  ),
);

const tritonConfigurations = [
  'GL MT',
  'GL AT',
  'GLS 4x4',
  'Tarmac',
  'HPE',
  'HPE-S',
  'Katana',
  'Savana',
].map((name) => dieselPickup(name, 2027, 'mitsubishi_triton'));

const poerConfigurations = [
  'POER P30 Pro',
  'POER P30 Trail',
  'POER P30 Exclusive',
].map((name) => dieselPickup(name, 2026, 'gwm_poer'));

const hunterConfigurations = [
  ['4Work MT', 'jac_hunter_4work'],
  ['4Work AT', 'jac_hunter_4work'],
  ['Heavy Duty HD', 'jac_hunter_heavy_duty'],
  ['Heavy Duty HDX', 'jac_hunter_heavy_duty'],
].map(([name, source]) => dieselPickup(name, 2026, source));

const dakotaConfigurations = [
  ['Big Horn 2.2 Diesel', 2027],
  ['Warlock 2.2 Diesel', 2026],
  ['Laramie 2.2 Diesel', 2026],
  ['Laramie Night Edition 2.2 Diesel', 2026],
].map(([name, year]) => dieselPickup(name, year, 'ram_dakota'));

const frontierConfigurations = [
  'S MT 4x4',
  'SE AT 4x4',
  'Attack AT 4x4',
  'XE AT 4x4',
  'Platinum AT 4x4',
  'PRO-4X AT 4x4',
].map((name) => dieselPickup(name, 2026, 'nissan_frontier'));

const amarokConfigurations = [
  'V6 Comfortline',
  'V6 Highline',
  'V6 Extreme',
].map((name) => dieselPickup(name, 2026, 'vw_amarok'));

const toroConfigurations = [
  ['Endurance T270 AT6', ['Gasolina', 'Etanol']],
  ['Freedom T270 AT6', ['Gasolina', 'Etanol']],
  ['Volcano MHEV T270 AT6', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['Ultra MHEV T270 AT6', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['Volcano Turbodiesel 4x4 AT9', ['Diesel']],
  ['Ranch Turbodiesel 4x4 AT9', ['Diesel']],
].map(([name, fuelType]) =>
  configuration(name, 2027, 'fiat_toro', 'Picape cabine dupla', fuelType),
);

const rampageConfigurations = [
  ['Big Horn 2.2 Diesel', ['Diesel']],
  ['Rebel 2.2 Diesel', ['Diesel']],
  ['Laramie 2.2 Diesel', ['Diesel']],
  ['R/T 2.0 Turbo Flex', ['Gasolina', 'Etanol']],
].map(([name, fuelType]) =>
  configuration(name, 2027, 'ram_rampage', 'Picape cabine dupla', fuelType),
);
rampageConfigurations.push(
  configuration(
    'Rebel Ignition 2.0 Turbo Flex',
    2026,
    'ram_rampage_product',
    'Picape cabine dupla',
    ['Gasolina', 'Etanol'],
  ),
  configuration(
    'Laramie Turbo Flex',
    2026,
    'ram_rampage_product',
    'Picape cabine dupla',
    ['Gasolina', 'Etanol'],
  ),
);

const montanaConfigurations = ['MT', 'LT', 'LTZ', 'Premier', 'RS'].map((name) =>
  flexPickup(name, 2027, 'chevrolet_montana'),
);

const orochConfigurations = [
  ['Pro', 2027],
  ['Intense', 2026],
  ['Iconic', 2025],
].map(([name, year]) => flexPickup(name, year, 'renault_oroch'));

const ram1500Configurations = [
  'Big Horn',
  'Laramie',
  'Laramie Night Edition',
].map((name) =>
  configuration(name, 2026, 'ram_1500', 'Picape cabine dupla', ['Gasolina']),
);

const compassConfigurations = [
  'Sport T270',
  'Longitude T270',
  'Série S T270',
  'Blackhawk Flex',
].map((name) => suv(name, 2026, 'jeep_compass'));

const corollaCrossConfigurations = ['XR', 'XRE', 'XRX'].map((name) =>
  suv(name, 2026, 'toyota_corolla_cross'),
);
corollaCrossConfigurations.push(
  suv('XRX Hybrid', 2026, 'toyota_corolla_cross', [
    'Gasolina',
    'Etanol',
    'Eletricidade',
  ]),
  suv('GR-Sport', 2026, 'toyota_corolla_cross_gr'),
);

const havalConfigurations = [
  ['HEV One', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['HEV2', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['PHEV19', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['PHEV35', ['Gasolina', 'Etanol', 'Eletricidade']],
  ['GT', ['Gasolina', 'Etanol', 'Eletricidade']],
].map(([name, fuelType]) => suv(name, 2027, 'gwm_haval_h6', fuelType));

const tiggo7Configurations = [
  ['Novo Tiggo 7 Sport', 'caoa_chery_tiggo_7_sport', ['Gasolina', 'Etanol']],
  ['Novo Tiggo 7 Pro', 'caoa_chery_tiggo_7_pro', ['Gasolina']],
  [
    'Tiggo 7 Pro Hybrid Max Drive',
    'caoa_chery_tiggo_7_hybrid',
    ['Gasolina', 'Eletricidade'],
  ],
  ['Tiggo 7 Pro PHEV', 'caoa_chery_tiggo_7_phev', ['Gasolina', 'Eletricidade']],
].map(([name, source, fuelType]) => suv(name, 2027, source, fuelType));

const tank300Configurations = [
  ['PHEV Flex', 'gwm_tank_300'],
  ['TerraForce', 'gwm_tank_300_terraforce'],
].map(([name, source]) =>
  suv(name, 2027, source, ['Gasolina', 'Etanol', 'Eletricidade']),
);

const masterConfigurations = [
  configuration(
    'Minibus Executive L3H2 16 lugares',
    2026,
    'renault_master_minibus',
    'Minibus',
    ['Diesel'],
  ),
  ...['Furgão L1H1', 'Furgão L2H2', 'Furgão L3H2'].map((name) =>
    configuration(name, 2026, 'renault_master_furgao', 'Furgão', ['Diesel']),
  ),
  ...['Pro L1H1', 'Pro L2H2', 'Pro L3H2'].map((name) =>
    configuration(name, 2026, 'renault_master_pro', 'Furgão', ['Diesel']),
  ),
  configuration(
    'Chassi Cabine L2H1',
    2026,
    'renault_master_chassi',
    'Chassi-cabine',
    ['Diesel'],
  ),
];

const ducatoConfigurations = [
  configuration(
    'Minibus Comfort 18L 2.2 Diesel',
    2026,
    'fiat_ducato',
    'Minibus',
    ['Diesel'],
  ),
  configuration('Minibus Luxo 16L 2.2 Diesel', 2026, 'fiat_ducato', 'Minibus', [
    'Diesel',
  ]),
  configuration('Maxicargo 13M 2.2 Diesel', 2026, 'fiat_ducato', 'Furgão', [
    'Diesel',
  ]),
];

const hiaceConfigurations = [
  configuration('Minibus AT DX 15+1', 2026, 'toyota_hiace_minibus', 'Minibus', [
    'Diesel',
  ]),
  configuration('Furgão AT DX', 2026, 'toyota_hiace_furgao', 'Furgão', [
    'Diesel',
  ]),
];

const dailyConfigurations = [
  'Furgão 30-160',
  'Furgão 45-160 Manual',
  'Furgão 45-180 Hi-Matic',
  'Furgão 55-180 Manual',
  'Furgão 55-180 Hi-Matic',
].map((name) =>
  configuration(name, 2026, 'iveco_daily_furgao', 'Furgão', ['Diesel']),
);
dailyConfigurations.push(
  ...[
    '30-160',
    '35-160',
    '35-180',
    '45-160',
    '45-180',
    '55-180',
    '60-180 Motorhome',
    '65-180',
    '70-180 Motorhome',
  ].map((name) =>
    configuration(
      `Chassi ${name}`,
      2026,
      'iveco_daily_chassi',
      'Chassi-cabine',
      ['Diesel'],
    ),
  ),
);

const eDailyConfigurations = ['3,5 t', '4,2 t', '7,2 t'].flatMap((weight) => [
  configuration(`Furgão ${weight}`, 2026, 'iveco_edaily', 'Furgão', [
    'Eletricidade',
  ]),
  configuration(
    `Chassi-cabine ${weight}`,
    2026,
    'iveco_edaily',
    'Chassi-cabine',
    ['Eletricidade'],
  ),
]);

const eSprinterConfigurations = [
  ['Chassi 320 Street Longo 81 kWh (C32B UP3e)', 'Chassi-cabine'],
  ['Chassi 320 Street Extra-longo 81 kWh (C33B UP3e)', 'Chassi-cabine'],
  ['Chassi 420 Longo 81 kWh (C42B UP3e)', 'Chassi-cabine'],
  ['Furgão 320 Street Longo 113 kWh (F32A UP3e)', 'Furgão'],
  ['Furgão 320 Street Extra-longo 81 kWh (F33A UP3e)', 'Furgão'],
  ['Furgão 420 Longo 81 kWh (F42A UP3e)', 'Furgão'],
  ['Furgão 420 Longo Vidrado 81 kWh (F42A UP5e)', 'Furgão vidrado'],
  ['Furgão 420 Longo Vidrado Metálico 81 kWh (F42A UP6e)', 'Furgão vidrado'],
  ['Furgão 420 Extra-longo 81 kWh (F43A UP3e)', 'Furgão'],
  ['Furgão 420 Extra-longo Vidrado 113 kWh (F43A UP5e)', 'Furgão vidrado'],
  [
    'Furgão 420 Extra-longo Vidrado Metálico 113 kWh (F43A UP6e)',
    'Furgão vidrado',
  ],
].map(([name, bodyStyle]) =>
  configuration(name, 2026, 'mercedes_esprinter', bodyStyle, ['Eletricidade']),
);

const sprinterConfigurations = [
  ...[
    '317 Street 3,5 t Longo',
    '317 Street 3,5 t Extra-longo',
    '417 4,1 t Longo',
    '517 5,0 t Longo',
    '517 5,0 t Extra-longo',
  ].map((name) =>
    configuration(
      `Chassi ${name}`,
      2027,
      'mercedes_sprinter',
      'Chassi-cabine',
      ['Diesel'],
    ),
  ),
  ...[
    '317 Street 3,5 t Longo Teto Alto',
    '317 Street 3,5 t Longo Teto Baixo',
    '317 Street 3,5 t Extra-longo Teto Alto',
    '417 4,1 t Longo Teto Alto',
    '417 4,1 t Longo Teto Baixo',
    '417 4,1 t Extra-longo Teto Alto',
    '517 5,0 t Extra-longo Teto Alto',
    '517 5,0 t Extra-longo Prolongado Teto Alto',
  ].map((name) =>
    configuration(`Furgão ${name}`, 2027, 'mercedes_sprinter', 'Furgão', [
      'Diesel',
    ]),
  ),
  ...[
    '417 4,1 t Longo Teto Alto 15+1 Reclinável',
    '417 4,1 t Longo Teto Alto 15+1 Fixo',
    '417 4,1 t Longo Teto Alto 9+1',
    '417 4,1 t Longo Teto Baixo 15+1',
    '517 5,0 t Extra-longo 17+1',
    '517 5,0 t Extra-longo Prolongado 19+1',
    '517 5,0 t Extra-longo Prolongado 20+1',
  ].map((name) =>
    configuration(`Van ${name}`, 2027, 'mercedes_sprinter', 'Minibus', [
      'Diesel',
    ]),
  ),
];

const jacElectricCommercialModels = [
  model('E-JV5.5', ['E-Transit Furgão'], 'ADJACENT', [
    configuration('E-JV5.5', 2026, 'jac_ejv55', 'Furgão', ['Eletricidade']),
  ]),
  model('E-JV7L', ['Transit Minibus'], 'ADJACENT', [
    configuration('E-JV7L 6+1', 2026, 'jac_ejv7l', 'Minibus', ['Eletricidade']),
  ]),
  model('E-JV12', ['Transit Furgão', 'E-Transit Furgão'], 'DIRECT', [
    configuration('E-JV12', 2026, 'jac_ejv12', 'Furgão', ['Eletricidade']),
  ]),
  model('E-JV12 VIP', ['Transit Minibus'], 'DIRECT_AND_ADJACENT', [
    configuration('E-JV12 VIP 15+1', 2026, 'jac_ejv12_vip', 'Minibus', [
      'Eletricidade',
    ]),
  ]),
  model('E-JV CC', ['Transit Chassi'], 'ADJACENT', [
    configuration('E-JV CC', 2026, 'jac_ejvcc', 'Chassi-cabine', [
      'Eletricidade',
    ]),
    configuration('E-JV CC Plus', 2026, 'jac_ejvcc', 'Chassi-cabine', [
      'Eletricidade',
    ]),
  ]),
];

const brands = [
  {
    name: 'Chevrolet',
    models: [
      model(
        'S10',
        ['Ranger', 'Ranger Raptor'],
        'DIRECT_AND_ADJACENT',
        s10Configurations,
      ),
      model('Montana', ['Maverick'], 'ADJACENT', montanaConfigurations),
      model('Silverado', ['F-150'], 'DIRECT', [
        configuration(
          'High Country',
          2026,
          'chevrolet_silverado',
          'Picape cabine dupla',
          ['Gasolina'],
        ),
      ]),
    ],
  },
  {
    name: 'Toyota',
    models: [
      model('Hilux', ['Ranger'], 'DIRECT', hiluxConfigurations),
      model(
        'Corolla Cross',
        ['Territory'],
        'DIRECT',
        corollaCrossConfigurations,
      ),
      model(
        'Hiace',
        ['Transit Minibus', 'Transit Furgão'],
        'DIRECT_AND_ADJACENT',
        hiaceConfigurations,
      ),
    ],
  },
  {
    name: 'Mitsubishi',
    models: [
      model(
        'Nova Triton',
        ['Ranger', 'Ranger Raptor'],
        'DIRECT_AND_ADJACENT',
        tritonConfigurations,
      ),
    ],
  },
  {
    name: 'GWM',
    models: [
      model(
        'Poer',
        ['Ranger', 'Ranger Raptor'],
        'DIRECT_AND_ADJACENT',
        poerConfigurations,
      ),
      model(
        'Haval H6',
        ['Territory', 'Bronco Sport'],
        'DIRECT_AND_ADJACENT',
        havalConfigurations,
      ),
      model('Tank 300', ['Bronco Sport'], 'ADJACENT', tank300Configurations),
    ],
  },
  {
    name: 'JAC',
    models: [
      model(
        'Hunter',
        ['Ranger', 'Ranger Raptor'],
        'DIRECT_AND_ADJACENT',
        hunterConfigurations,
      ),
      ...jacElectricCommercialModels,
    ],
  },
  {
    name: 'Nissan',
    models: [model('Frontier', ['Ranger'], 'DIRECT', frontierConfigurations)],
  },
  {
    name: 'Volkswagen',
    models: [model('Amarok', ['Ranger'], 'DIRECT', amarokConfigurations)],
  },
  {
    name: 'RAM',
    models: [
      model('Dakota', ['Ranger'], 'DIRECT', dakotaConfigurations),
      model('Rampage', ['Maverick'], 'DIRECT', rampageConfigurations),
      model('1500', ['F-150'], 'DIRECT', ram1500Configurations),
    ],
  },
  {
    name: 'Fiat',
    models: [
      model('Toro', ['Maverick'], 'DIRECT', toroConfigurations),
      model(
        'Ducato',
        ['Transit Minibus', 'Transit Furgão'],
        'DIRECT',
        ducatoConfigurations,
      ),
    ],
  },
  {
    name: 'Renault',
    models: [
      model('Oroch', ['Maverick'], 'ADJACENT', orochConfigurations),
      model(
        'Master',
        ['Transit Minibus', 'Transit Furgão', 'Transit Chassi'],
        'DIRECT',
        masterConfigurations,
      ),
    ],
  },
  {
    name: 'BYD',
    models: [
      model('Shark', ['Maverick', 'Ranger'], 'ADJACENT', [
        configuration(
          'BYD SHARK GS',
          2025,
          'byd_shark',
          'Picape cabine dupla',
          ['Gasolina', 'Eletricidade'],
        ),
      ]),
      model('Sealion 7', ['Mustang Mach-E'], 'DIRECT', [
        configuration('AWD', 2026, 'byd_sealion_7', 'SUV cupê', [
          'Eletricidade',
        ]),
      ]),
    ],
  },
  {
    name: 'CAOA Chery',
    models: [model('Tiggo 7', ['Territory'], 'DIRECT', tiggo7Configurations)],
  },
  {
    name: 'Jeep',
    models: [
      model(
        'Compass',
        ['Territory', 'Bronco Sport'],
        'DIRECT',
        compassConfigurations,
      ),
      model('Wrangler', ['Bronco Sport'], 'ADJACENT', [
        suv('Rubicon', 2026, 'jeep_wrangler', ['Gasolina']),
      ]),
    ],
  },
  {
    name: 'Volvo',
    models: [
      model('EX40', ['Mustang Mach-E'], 'DIRECT', [
        configuration('Plus Single Motor RWD', 2027, 'volvo_ex40', 'SUV', [
          'Eletricidade',
        ]),
        configuration(
          'Ultra Twin Motor Performance AWD',
          2027,
          'volvo_ex40',
          'SUV',
          ['Eletricidade'],
        ),
      ]),
    ],
  },
  {
    name: 'Zeekr',
    models: [
      model('7X', ['Mustang Mach-E'], 'DIRECT', [
        configuration('Flagship AWD', 2026, 'zeekr_7x', 'SUV', [
          'Eletricidade',
        ]),
      ]),
    ],
  },
  {
    name: 'Porsche',
    models: [
      model(
        'Macan',
        ['Mustang Mach-E'],
        'ADJACENT',
        [
          ['Macan 4', 2026],
          ['Macan 4S', 2027],
          ['Macan GTS', 2027],
          ['Macan Turbo', 2027],
        ].map(([name, year]) =>
          configuration(name, year, 'porsche_macan', 'SUV', ['Eletricidade']),
        ),
      ),
    ],
  },
  {
    name: 'BMW',
    models: [
      model(
        'M2',
        ['Mustang Dark Horse'],
        'DIRECT',
        ['M2 Coupé', 'M2 Coupé Track'].map((name) =>
          configuration(name, 2027, 'bmw_m2', 'Coupé', ['Gasolina']),
        ),
      ),
      model(
        'M4',
        ['Mustang Dark Horse'],
        'ADJACENT',
        ['M4 Competition', 'M4 Competition Track'].map((name) =>
          configuration(name, 2027, 'bmw_m4', 'Coupé', ['Gasolina']),
        ),
      ),
    ],
  },
  {
    name: 'Iveco',
    models: [
      model(
        'Daily',
        ['Transit Furgão', 'Transit Chassi'],
        'DIRECT_AND_ADJACENT',
        dailyConfigurations,
      ),
      model(
        'eDaily',
        ['E-Transit Furgão', 'Transit Chassi'],
        'ADJACENT',
        eDailyConfigurations,
      ),
    ],
  },
  {
    name: 'Mercedes-Benz',
    models: [
      model(
        'Sprinter',
        ['Transit Minibus', 'Transit Furgão', 'Transit Chassi'],
        'DIRECT',
        sprinterConfigurations,
      ),
      model(
        'eSprinter',
        ['E-Transit Furgão'],
        'DIRECT',
        eSprinterConfigurations,
      ),
    ],
  },
];

const supersessions = [
  ...[
    'af0df467-683d-48bd-b8b2-b0ed15379380',
    '8b89d0e0-a139-4cda-9282-8db7f9fb9d0b',
    '8355d2e9-49df-4cc3-b8b0-7189a5adda76',
    '4dac3612-a85d-4dfc-925c-e446f9308584',
    '6055a780-a15b-43d1-af84-07d43f8479cd',
    '15432a9a-b079-4621-ac77-0610d8e8fefd',
    '889d3bdc-28d6-48a9-9be4-da87820a13ef',
    '8b894f5a-b36e-42fd-aa8c-b01393825c47',
    '86a0f7b2-b441-4789-ac76-eda2dcb8944e',
    '1b893911-7373-4d04-a473-56bf3de20465',
  ].map((configurationId, index) => ({
    configurationId,
    target: {
      brand: 'Chevrolet',
      model: 'S10',
      name: [
        'WT AT',
        'High Country',
        'LTZ',
        'Trail Boss',
        'High Country',
        'LTZ',
        'Z71',
        'WT AT',
        'WT MT',
        'Z71',
      ][index],
      market: 'BR',
      modelYear: 2027,
    },
  })),
  {
    configurationId: 'c28c64e4-801a-5d29-b4c2-083a888a79f3',
    target: {
      brand: 'Toyota',
      model: 'Hilux',
      name: 'SRX Plus AT',
      market: 'BR',
      modelYear: 2026,
    },
  },
  {
    configurationId: '014f2d31-f3ec-583a-996d-5696020d0c14',
    target: {
      brand: 'Nissan',
      model: 'Frontier',
      name: 'Platinum AT 4x4',
      market: 'BR',
      modelYear: 2026,
    },
  },
  {
    configurationId: '284db245-6895-50c6-a15e-aee0dacaa108',
    target: {
      brand: 'Nissan',
      model: 'Frontier',
      name: 'PRO-4X AT 4x4',
      market: 'BR',
      modelYear: 2026,
    },
  },
];

const configurationCount = brands.reduce(
  (sum, brand) =>
    sum +
    brand.models.reduce(
      (modelSum, item) => modelSum + item.configurations.length,
      0,
    ),
  0,
);
const modelCount = brands.reduce((sum, brand) => sum + brand.models.length, 0);

export default {
  version: 'ford-competitors-brasil-current-2026-09-12-v1',
  capturedOn,
  sources,
  attributes,
  brands,
  expected: {
    brandCount: brands.length,
    modelCount,
    configurationCount,
  },
  supersessions,
};
