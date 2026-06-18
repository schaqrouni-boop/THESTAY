// Données structurelles du chantier — typologies, unités, lots et éléments à contrôler.
// Un item peut être :
//   - une string (item simple)
//   - un objet { group: 'Nom du groupe', items: [...] } pour les regroupements visuels
//
// La clé d'état d'un item groupé est préfixée par le nom du groupe : "Group — Item",
// ce qui rend uniques des libellés identiques sous des groupes différents (ex : "Porte"
// sous "Chambre Enfant" et "Porte" sous "Cuisine").

export const LOTS = [
  { id: 'cuisine_woodymar',         label: 'Cuisine Woodymar',         short: 'Cuisine',  icon: '🍳' },
  { id: 'boiserie_bibancom',        label: 'Boiserie Bibancom',        short: 'Boiserie', icon: '🚪' },
  { id: 'parquet',                  label: 'Parquet',                  short: 'Parquet',  icon: '🪵' },
  { id: 'electricien_sobimel',      label: 'Électricien Sobimel',      short: 'Élec.',    icon: '⚡' },
  { id: 'plomberie_climasec',       label: 'Plomberie Climasec',       short: 'Plomb.',   icon: '🚿' },
  { id: 'climatisation_climasec',   label: 'Climatisation Climasec',   short: 'Clim.',    icon: '❄️' },
  { id: 'peinture',                 label: 'Peinture',                 short: 'Peinture', icon: '🎨' },
  { id: 'marbre_carreaux',          label: 'Marbre et Carreaux',       short: 'Marbre',   icon: '🪨' },
  { id: 'cabines_miroirs',          label: 'Cabines et Miroirs',       short: 'Cabines',  icon: '🪞' }
];

// Cuisine Woodymar — identique pour toutes les typologies
const CUISINE_WOODYMAR = [
  'Caissons Hauts posés',
  'Caissons Bas posés',
  'Portes Hautes posées',
  'Portes Basses posées',
  'Electroménager posé',
  'LEDs Caissons posés',
  'Crédence Posée',
  'Plan de travail posé'
];

const PARQUET = ['Parquet', 'Plinthe et Cornière'];

const ELECTRICIEN = [
  'Interrupteurs',
  'Caches',
  'Tableau Électrique',
  'Spots',
  'Vidéophone',
  'LED Niches SDB',
  'Numéro Porte'
];

const CLIMATISATION = [
  'Pose Commande',
  'Pose Groupe Terrasse',
  'Essayage Climatisation',
  'Pose Grille Climatisation'
];

const CABINES_MIROIRS = ['Miroir SDB', 'Cabine SDB'];

// --- Items par lot et par typologie ---

export const LOT_ITEMS = {
  studio: {
    cuisine_woodymar: CUISINE_WOODYMAR,
    boiserie_bibancom: [
      'Porte Entrée',
      'Porte SDB',
      'Porte Chambre',
      'Dressing chambranle et plinthe',
      'Dressing portes',
      'Dressing LEDs',
      'Dressing étagères et tiroirs',
      {
        group: 'Quincaillerie',
        items: [
          'Poignée Digitale',
          'Canon Bouton SDB',
          'Butoirs portes',
          'Poignées portes intérieur x 2'
        ]
      }
    ],
    parquet: PARQUET,
    electricien_sobimel: ELECTRICIEN,
    plomberie_climasec: [
      'Pose Chauffe-Eau',
      'Pose Mitigeur',
      'Pose WC',
      'Pose Shatafa',
      'Pose Colonne Douche',
      'Pose Vasque et Meuble',
      'Pose Mitigeur Cuisine',
      'Pose Extracteur',
      'Pose Caniveau'
    ],
    climatisation_climasec: CLIMATISATION,
    peinture: [
      'Enduit Murs (INT & EXT)',
      'Finition Garde-Corps',
      'Finition Plafond Salon',
      'Finition Plafond SDB',
      'Finition Plafond Chambre',
      'Finition Murs (INT & EXT)'
    ],
    marbre_carreaux: [
      'Carreaux SDB',
      'Carreaux Salon',
      'Plinthes Salon',
      'Carreaux Terrasse',
      'Plinthes Terrasse',
      'Nettoyage Carreaux SDB'
    ],
    cabines_miroirs: CABINES_MIROIRS
  },

  appt2c: {
    cuisine_woodymar: CUISINE_WOODYMAR,
    boiserie_bibancom: [
      { group: 'Entrée', items: ['Porte Entrée'] },
      {
        group: 'SDB',
        items: ['Porte SDB Enfant', 'Porte SDB Parents', 'Canon SDB Enfant', 'Canon SDB Parents']
      },
      {
        group: 'Chambre Enfant',
        items: ['Porte', 'Dressing porte', 'Dressing chambranle et plinthe', 'Dressing étagères et tiroirs', 'Dressing LEDs']
      },
      {
        group: 'Suite Parentale',
        items: ['Porte', 'Dressing porte', 'Dressing chambranle et plinthe', 'Dressing étagères et tiroirs', 'Dressing LEDs']
      },
      { group: 'Cuisine', items: ['Porte'] },
      {
        group: 'Quincaillerie',
        items: ['Butoirs portes x 5', 'Poignées portes intérieur x 5']
      }
    ],
    parquet: PARQUET,
    electricien_sobimel: ELECTRICIEN,
    plomberie_climasec: [
      'Pose Chauffe-Eau',
      'Pose Mitigeur Cuisine',
      {
        group: 'SDB Enfant',
        items: [
          'Pose Mitigeur',
          'Pose WC',
          'Pose Shatafa',
          'Pose Colonne Douche',
          'Pose Vasque et Meuble',
          'Pose Extracteur',
          'Pose Caniveau'
        ]
      },
      {
        group: 'SDB Suite Parentale',
        items: [
          'Pose Mitigeur',
          'Pose WC',
          'Pose Shatafa',
          'Pose Colonne Douche',
          'Pose Vasque et Meuble',
          'Pose Extracteur',
          'Pose Caniveau'
        ]
      }
    ],
    climatisation_climasec: CLIMATISATION,
    peinture: [
      'Enduit Murs (INT & EXT)',
      'Finition Garde-Corps',
      'Finition Plafond Salon',
      'Finition Plafond SDB 1 et 2',
      'Finition Plafond Chambre 1 et 2',
      'Finition Plafond Cuisine',
      'Finition Murs (INT & EXT)'
    ],
    marbre_carreaux: [
      'Carreau SDB',
      'Marbre Salon',
      'Plinthes Salon',
      'Carreau Terrasse',
      'Plinthes Terrasse',
      'Ponçage Marbre',
      'Lustrage Marbre',
      'Nettoyage Carreaux SDB'
    ],
    cabines_miroirs: CABINES_MIROIRS
  },

  couloirs: {
    boiserie_bibancom: ['Porte Placard'],
    electricien_sobimel: [
      'Interrupteurs',
      'Caches',
      'Détecteurs',
      'Tableau Électrique',
      'Spots',
      'Caméras',
      'Appliques ESC Principaux',
      'Appliques ESC Secours',
      'LEDs Escaliers'
    ],
    peinture: [
      'Enduit Murs',
      'Finition Murs Couloir',
      'Finition Murs ESC Principaux',
      'Finition Murs ESC Secours',
      'Finition Plafonds Couloir',
      'Finition Plafonds ESC Principaux',
      'Finition Plafonds ESC Secours',
      'Finition Porte Coupe-Feu',
      'Finition Garde-Corps'
    ],
    marbre_carreaux: [
      'Pose Marbre',
      'Plinthe Marbre',
      'Ponçage Marbre',
      'Lustrage Marbre'
    ]
  },

  appt3c: {
    cuisine_woodymar: CUISINE_WOODYMAR,
    boiserie_bibancom: [
      { group: 'Entrée', items: ['Porte Entrée'] },
      {
        group: 'SDB',
        items: [
          'Porte SDB Enfant',
          'Porte SDB Parents',
          'Porte SDB Invités',
          'Canon SDB Enfant',
          'Canon SDB Parents',
          'Canon SDB Invités'
        ]
      },
      {
        group: 'Chambre Enfant 1',
        items: ['Porte', 'Dressing porte', 'Dressing chambranle et plinthe', 'Dressing étagères et tiroirs', 'Dressing LEDs']
      },
      {
        group: 'Chambre Enfant 2',
        items: ['Porte', 'Dressing porte', 'Dressing chambranle et plinthe', 'Dressing étagères et tiroirs', 'Dressing LEDs']
      },
      {
        group: 'Suite Parentale',
        items: ['Porte', 'Dressing porte', 'Dressing chambranle et plinthe', 'Dressing étagères et tiroirs', 'Dressing LEDs']
      },
      { group: 'Cuisine', items: ['Porte'] },
      {
        group: 'Quincaillerie',
        items: ['Butoirs portes x 7', 'Poignées portes intérieur x 7']
      }
    ],
    parquet: PARQUET,
    electricien_sobimel: ELECTRICIEN,
    plomberie_climasec: [
      'Pose Chauffe-Eau',
      'Pose Mitigeur Cuisine',
      {
        group: 'SDB Invité',
        items: [
          'Pose Mitigeur',
          'Pose WC',
          'Pose Shatafa',
          'Pose Vasque et Meuble',
          'Pose Extracteur'
        ]
      },
      {
        group: 'SDB Enfant',
        items: [
          'Pose Mitigeur',
          'Pose WC',
          'Pose Shatafa',
          'Pose Colonne Douche',
          'Pose Vasque et Meuble',
          'Pose Extracteur',
          'Pose Caniveau'
        ]
      },
      {
        group: 'SDB Suite Parentale',
        items: [
          'Pose Mitigeur',
          'Pose WC',
          'Pose Shatafa',
          'Pose Colonne Douche',
          'Pose Vasque et Meuble',
          'Pose Extracteur',
          'Pose Caniveau'
        ]
      }
    ],
    climatisation_climasec: CLIMATISATION,
    peinture: [
      'Enduit Murs (INT & EXT)',
      'Finition Garde-Corps',
      'Finition Plafond Salon',
      'Finition Plafond SDB 1, 2 et 3',
      'Finition Plafond Chambre 1, 2 et 3',
      'Finition Plafond Cuisine',
      'Finition Murs (INT & EXT)'
    ],
    marbre_carreaux: [
      'Carreau SDB',
      'Marbre Salon',
      'Plinthes Salon',
      'Carreau Terrasse',
      'Plinthes Terrasse',
      'Ponçage Marbre',
      'Lustrage Marbre',
      'Nettoyage Carreaux SDB'
    ],
    cabines_miroirs: CABINES_MIROIRS
  }
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
    units: ['A01', 'A12', 'A14', 'A22', 'A24', 'A32', 'A34', 'A42', 'A44', 'A52', 'A54']
  },
  {
    id: 'appt3c',
    label: 'Appartement 3C',
    short: 'Appt 3C',
    units: ['A11', 'A13', 'A21', 'A23', 'A31', 'A33', 'A41', 'A43', 'A51', 'A53']
  },
  {
    id: 'couloirs',
    label: 'Couloirs & ESC',
    short: 'Couloirs',
    units: [
      'SS1-APPT', 'SS2-APPT', 'RDC-APPT', '1ER-APPT', '2eme-APPT', '3eme-APPT', '4eme-APPT', '5eme-APPT',
      'SS1-STUDIOS', 'SS2-STUDIOS', 'RDC-STUDIOS', '1ER-STUDIOS', '2eme-STUDIOS', '3eme-STUDIOS', '4eme-STUDIOS', '5eme-STUDIOS'
    ]
  }
];

// --- Helpers ---

// Sépare la définition brute en groupes ordonnés pour l'affichage.
// Renvoie : [{ group: string|null, items: [{ key, label }] }, ...]
export function groupsForLot(typoId, lotId) {
  const config = LOT_ITEMS[typoId]?.[lotId] || [];
  const out = [];
  let ungroupedBucket = null;
  for (const entry of config) {
    if (typeof entry === 'string') {
      if (!ungroupedBucket) {
        ungroupedBucket = { group: null, items: [] };
        out.push(ungroupedBucket);
      }
      ungroupedBucket.items.push({ key: entry, label: entry });
    } else if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
      ungroupedBucket = null; // un groupe nommé clôt le bucket courant
      out.push({
        group: entry.group,
        items: entry.items.map((it) => ({
          key: `${entry.group} — ${it}`,
          label: it
        }))
      });
    }
  }
  return out;
}

// Aplatissement avec clé unique par item — sert au calcul de progression et au PDF.
// Renvoie : [{ key, label, group }]
export function flatItemsForLot(typoId, lotId) {
  const groups = groupsForLot(typoId, lotId);
  const out = [];
  for (const g of groups) {
    for (const it of g.items) {
      out.push({ key: it.key, label: it.label, group: g.group });
    }
  }
  return out;
}

export function totalItemsForLot(typoId, lotId) {
  return flatItemsForLot(typoId, lotId).length;
}

// Retourne uniquement les lots qui ont des items pour la typologie donnée.
// Permet de masquer les lots non applicables (ex : pas de cuisine pour les couloirs).
export function lotsForTypology(typoId) {
  return LOTS.filter((lot) => totalItemsForLot(typoId, lot.id) > 0);
}

export function totalItemsFor(typoId) {
  let total = 0;
  for (const lot of LOTS) {
    total += totalItemsForLot(typoId, lot.id);
  }
  return total;
}
