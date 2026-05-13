// Données structurelles du chantier — typologies, unités, éléments à vérifier

export const CUISINE_ITEMS = [
  'Caisson Haut Posé',
  'Caisson Bas Posé',
  'Crédence Posée',
  'Façades Posées'
];

export const MENUISERIE_BY_TYPE = {
  studio: [
    'Porte Entrée',
    'Porte SDB',
    'Porte Chambre',
    'Dressing'
  ],
  appt2c: [
    'Porte Entrée',
    'Porte Cuisine',
    'Porte CH1',
    'Porte CH2',
    'Porte SDB1',
    'Porte SDB2',
    'Dressing Suite Parentale',
    'Dressing CH2'
  ],
  appt3c: [
    'Porte Entrée',
    'Porte Cuisine',
    'Porte CH1',
    'Porte CH2',
    'Porte CH3',
    'Porte SDB1',
    'Porte SDB2',
    'Porte SDB3',
    'Dressing CH1',
    'Dressing CH2',
    'Dressing Suite Parentale'
  ]
};

export const TYPOLOGIES = [
  {
    id: 'studio',
    label: 'Studio 1C',
    short: 'Studio',
    units: [
      'S01', 'S02', 'S03', 'S04', 'S05', 'S06',
      'S11', 'S12', 'S13', 'S14', 'S15',
      'S21', 'S22', 'S23', 'S24', 'S25',
      'S31', 'S32', 'S33', 'S34',
      'S41', 'S42', 'S43',
      'S51', 'S52'
    ]
  },
  {
    id: 'appt2c',
    label: 'Appartement 2C',
    short: 'Appt 2C',
    units: [
      'A01', 'A12', 'A14', 'A22', 'A24', 'A32', 'A34', 'A42', 'A44', 'A52', 'A54'
    ]
  },
  {
    id: 'appt3c',
    label: 'Appartement 3C',
    short: 'Appt 3C',
    units: [
      'A11', 'A13', 'A21', 'A23', 'A31', 'A33', 'A41', 'A43', 'A51', 'A53'
    ]
  }
];

export function itemsForTypology(typoId) {
  return {
    cuisine: CUISINE_ITEMS,
    menuiserie: MENUISERIE_BY_TYPE[typoId]
  };
}

export function totalItemsFor(typoId) {
  const { cuisine, menuiserie } = itemsForTypology(typoId);
  return cuisine.length + menuiserie.length;
}
