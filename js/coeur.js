// Le cœur de l'appli web : les mêmes règles que l'appli Android (ingrédients, rayons, recettes, courses, filtres,
// statistiques), sans rien qui touche au navigateur, pour pouvoir les tester avec Node.
import { RAYONS, RAYON_NOMS, CATEGORIES_OFF, PIECES } from './donnees.js';

export const sansAccents = (s) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

// --- Rayons ---

export const RAYON_ORDRE = Object.keys(RAYON_NOMS);

const REGLES_RAYONS = RAYONS.map(([rayon, mots]) => [
  rayon,
  new RegExp('(?<![a-z])(' + mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?:s|x)?(?![a-z])'),
]);

/** Le rayon d'un ingrédient d'après son nom : le premier rayon qui reconnaît un mot entier l'emporte. */
export function rayonDe(nom) {
  const n = sansAccents(nom).replace(/œ/g, 'oe');
  for (const [rayon, re] of REGLES_RAYONS) if (re.test(n)) return rayon;
  return 'Autre';
}

/** Le rayon enregistré dans l'ingrédient, ou déduit de son nom s'il est vide. */
export const rayonIng = (ing) => (ing.rayon && RAYON_NOMS[ing.rayon] ? ing.rayon : ing.rayon ? 'Autre' : rayonDe(ing.nom));

// --- Quantités et ingrédients ---

/** 200 → « 200 », 1.2 → « 1,2 », 0.333 → « 0,33 » (virgule française, deux décimales au plus). */
export function formatQte(q) {
  if (Math.abs(q - Math.round(q)) < 0.005) return String(Math.round(q));
  return q.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

/** 35 → « 35 min », 75 → « 1 h 15 », 120 → « 2 h ». */
export function duree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function texteIngredient(ing, facteur = 1) {
  let s = '';
  if (ing.qte != null) s += formatQte(ing.qte * facteur);
  if (ing.unite) s += ' ' + ing.unite;
  if (s) s += ' ';
  return s + ing.nom;
}

const UNITES = { g: 'g', gr: 'g', kg: 'kg', mg: 'mg', ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', cs: 'c. à s.', cc: 'c. à c.' };
const QUANTITE = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*([\s\S]*)$/;
const CUILLERE = /^(c\.?\s*à\.?\s*(soupe|café|s|c)\.?|cuill?[eè]res?\s+à\s+(soupe|café))\s+/i;
const DE_LIAISON = /^(de |du |des |d')/i;

function nombre(texte) {
  const t = texte.replace(/ /g, '');
  if (t.includes('/')) {
    const [a, b] = t.split('/');
    return parseFloat(a.replace(',', '.')) / parseFloat(b);
  }
  return parseFloat(t.replace(',', '.'));
}

/** Lit une ligne d'ingrédient saisie à la main : « 200 g farine », « 1,2 kg pommes de terre », « 1/2 citron », « sel ». */
export function parseIngredient(brut) {
  let reste = brut.trim().replace('½', '1/2').replace('¼', '1/4').replace('¾', '3/4');
  const q = QUANTITE.exec(reste);
  if (!q) return { qte: null, unite: '', nom: reste, rayon: '' };
  const qte = nombre(q[1]);
  reste = q[2];
  let unite = '';
  const c = CUILLERE.exec(reste);
  if (c) {
    const t = c[1].toLowerCase();
    unite = t.includes('soupe') || /à\.?\s*s\.?$/.test(t) ? 'c. à s.' : 'c. à c.';
    reste = reste.slice(c[0].length);
  } else {
    const m = /^(\S+)\s+([\s\S]*)$/.exec(reste);
    if (m) {
      const u = UNITES[m[1].toLowerCase().replace(/\.+$/, '')];
      if (u && m[2].trim()) {
        unite = u;
        reste = m[2];
      }
    }
  }
  if (unite) reste = reste.replace(DE_LIAISON, '');
  return { qte, unite, nom: reste.trim(), rayon: '' };
}

/** Comme parseIngredient, avec le rayon rempli (c'est ainsi que l'appli enregistre un ingrédient). */
export function ingredientRange(brut) {
  const ing = parseIngredient(brut);
  return { ...ing, rayon: rayonDe(ing.nom) };
}

// --- Clé normalisée d'un ingrédient ---

const ARTICLES = /^(de la |de l'|de |du |des |d'|la |le |les |l'|un |une )/;
const MESURES =
  /^(gousses?|brins?|bottes?|tranches?|pincees?|feuilles?|branches?|zestes?|filets?|blancs?|cuisses?|morceaux?|boites?|sachets?|paquets?|verres?|tasses?|pots?|bouquets?|pieces?|rondelles?) (de la |de l'|de |du |des |d')/;
const DESCRIPTEURS = new Set([
  'frais', 'fraiche', 'hache', 'hachee', 'emince', 'emincee', 'gros', 'grosse', 'petit', 'petite', 'bio', 'fondu',
  'fondue', 'ramolli', 'ramollie', 'rape', 'rapee', 'moyen', 'moyenne', 'nouveau', 'nouvelle', 'entier', 'entiere',
  'cuit', 'cuite', 'nature',
]);
const SYNONYMES = {
  patate: 'pomme de terre',
  yogourt: 'yaourt',
  lime: 'citron vert',
  'farine de ble': 'farine',
  'sucre en poudre': 'sucre',
  'sucre semoule': 'sucre',
};
// Mots qui se terminent par s ou x au singulier aussi : « noix » ne devient pas « noi ».
const INVARIABLES = new Set(['noix', 'pois', 'ananas', 'mais', 'anis', 'jus', 'couscous', 'bois', 'brebis']);

const estDescripteur = (m) => DESCRIPTEURS.has(m) || DESCRIPTEURS.has(m.replace(/s$/, '')) || DESCRIPTEURS.has(m.replace(/es$/, ''));
const singulier = (m) => (!INVARIABLES.has(m) && m.length > 3 && (m.endsWith('s') || m.endsWith('x')) ? m.slice(0, -1) : m);

/** « Pommes de terre », « patates » et « de la pomme de terre » donnent la même clé. */
export function cleIngredient(nom) {
  let s = sansAccents(nom).replace(/œ/g, 'oe').replace(/’/g, "'").replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  let avant;
  do {
    avant = s;
    s = s.replace(ARTICLES, '').replace(MESURES, '');
  } while (s !== avant);
  const mots = [];
  for (const m of s.split(' ').filter(Boolean)) {
    const creme = mots[mots.length - 1] === 'creme';
    if (estDescripteur(m) && !(creme && m.startsWith('fraiche'))) continue;
    mots.push(singulier(m));
  }
  const k = mots.join(' ');
  return SYNONYMES[k] ?? k;
}

export const clesRecette = (r) => new Set(r.ingredients.map((i) => cleIngredient(i.nom)).filter(Boolean));

/** Les ingrédients de toutes les recettes, du plus fréquent au moins fréquent : { cle, nom, recettes }. */
export function etiquettesIngredients(recettes) {
  const noms = new Map();
  const comptes = new Map();
  for (const r of recettes) {
    for (const ing of r.ingredients) {
      const k = cleIngredient(ing.nom);
      if (!k) continue;
      if (!noms.has(k)) noms.set(k, []);
      noms.get(k).push(ing.nom.trim());
    }
    for (const k of clesRecette(r)) comptes.set(k, (comptes.get(k) ?? 0) + 1);
  }
  const res = [];
  for (const [k, n] of comptes) {
    const freq = new Map();
    for (const nom of noms.get(k)) freq.set(nom.toLowerCase(), (freq.get(nom.toLowerCase()) ?? 0) + 1);
    const nom = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    res.push({ cle: k, nom: nom.charAt(0).toUpperCase() + nom.slice(1), recettes: n });
  }
  return res.sort((a, b) => b.recettes - a.recettes || a.nom.localeCompare(b.nom, 'fr'));
}

// --- Recettes ---

export const slug = (titre) =>
  sansAccents(titre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recette';

export const nouvelId = (titre) => slug(titre) + '-' + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');

export const recetteVide = () => ({ id: '', titre: '', portions: 4, minutes: 0, tags: [], ingredients: [], etapes: [], notes: '' });

export function recetteDepuisJson(texte) {
  const o = JSON.parse(texte);
  return {
    id: o.id,
    titre: o.titre ?? '',
    portions: o.portions ?? 4,
    minutes: o.minutes ?? 0,
    tags: o.tags ?? [],
    ingredients: (o.ingredients ?? []).map((g) => ({ qte: g.qte ?? null, unite: g.unite ?? '', nom: g.nom ?? '', rayon: g.rayon ?? '' })),
    etapes: o.etapes ?? [],
    notes: o.notes ?? '',
  };
}

const citer = (s) => JSON.stringify(s);
const lignes = (l) => (l.length ? '[\n    ' + l.join(',\n    ') + '\n  ]' : '[]');
const nombreJson = (q) => (Math.abs(q - Math.round(q)) < 1e-9 ? String(Math.round(q)) : String(q));

/** Le fichier JSON d'une recette, dans le même format que l'appli Android (une ligne par ingrédient et par étape). */
export function recetteVersJson(r) {
  const ing = r.ingredients.map(
    (g) => `{"qte": ${g.qte == null ? 'null' : nombreJson(g.qte)}, "unite": ${citer(g.unite)}, "nom": ${citer(g.nom)}, "rayon": ${citer(g.rayon)}}`,
  );
  return (
    '{\n' +
    `  "id": ${citer(r.id)},\n  "titre": ${citer(r.titre)},\n  "portions": ${r.portions},\n  "minutes": ${r.minutes},\n` +
    `  "tags": [${r.tags.map(citer).join(', ')}],\n  "ingredients": ${lignes(ing)},\n  "etapes": ${lignes(r.etapes.map(citer))},\n` +
    `  "notes": ${citer(r.notes)}\n}\n`
  );
}

// --- La recette comme un petit document texte ---

export const MODELE = '# \nportions: 4\nminutes: \ntags: \n\n## ingredients\n- \n\n## etapes\n1. \n\n## notes\n';

export function minutesDe(valeur) {
  const h = /(\d+)\s*h\s*(\d+)?/.exec(valeur.toLowerCase());
  if (h) return parseInt(h[1], 10) * 60 + (parseInt(h[2], 10) || 0);
  return parseInt(valeur.replace(/\D/g, ''), 10) || 0;
}

export function recetteVersTexte(r, portions = r.portions, pourEdition = true) {
  const facteur = portions / Math.max(r.portions, 1);
  let s = `# ${r.titre}\nportions: ${portions}\nminutes: ${r.minutes > 0 ? r.minutes : ''}\ntags: ${r.tags.join(', ')}\n\n## ingredients\n`;
  r.ingredients.forEach((i) => (s += `- ${texteIngredient(i, facteur)}\n`));
  if (pourEdition && !r.ingredients.length) s += '- \n';
  s += '\n## etapes\n';
  r.etapes.forEach((e, i) => (s += `${i + 1}. ${e}\n`));
  if (pourEdition && !r.etapes.length) s += '1. \n';
  if (pourEdition || r.notes.trim()) {
    s += '\n## notes\n';
    if (r.notes.trim()) s += r.notes + '\n';
  }
  return s;
}

/** Relit le document : les lignes vides et les puces sans contenu sont ignorées, l'identifiant de base est gardé. */
export function recetteDepuisTexte(texte, base = recetteVide()) {
  let titre = '';
  let portions = base.portions;
  let minutes = 0;
  let tags = [];
  const ingredients = [];
  const etapes = [];
  const notes = [];
  let section = '';
  for (const ligne of texte.split('\n')) {
    const t = ligne.trim();
    if (t.startsWith('##')) section = sansAccents(t.replace(/^##/, '').trim());
    else if (t.startsWith('#')) titre = t.replace(/^#/, '').trim();
    else if (section === '') {
      const i = t.indexOf(':');
      if (i > 0) {
        const cle = sansAccents(t.slice(0, i).trim());
        const valeur = t.slice(i + 1).trim();
        if (cle === 'portions') {
          const n = parseInt(valeur.replace(/\D/g, ''), 10);
          if (n > 0) portions = n;
        } else if (cle === 'minutes' || cle === 'temps') minutes = minutesDe(valeur);
        else if (cle === 'tags') tags = valeur.split(',').map((x) => x.trim()).filter(Boolean);
      }
    } else if (section.startsWith('ingr')) {
      const corps = t.replace(/^-/, '').trim();
      if (corps) ingredients.push(ingredientRange(corps));
    } else if (section.startsWith('etape')) {
      const corps = t.replace(/^(\d+[.)]|-)\s*/, '').trim();
      if (corps) etapes.push(corps);
    } else notes.push(ligne.trimEnd());
  }
  return { ...base, titre, portions, minutes, tags, ingredients, etapes, notes: notes.join('\n').trim() };
}

// --- Diff ligne à ligne (plus longue sous-suite commune) ---

export function diffLignes(avant, apres) {
  const a = avant.replace(/\s+$/, '').split('\n');
  const b = apres.replace(/\s+$/, '').split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const res = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) res.push({ marque: 'commun', texte: a[i++] }), j++;
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) res.push({ marque: 'retrait', texte: a[i++] });
    else res.push({ marque: 'ajout', texte: b[j++] });
  }
  while (i < a.length) res.push({ marque: 'retrait', texte: a[i++] });
  while (j < b.length) res.push({ marque: 'ajout', texte: b[j++] });
  return res;
}

// --- Planning et courses ---

export const CRENEAUX = ['midi', 'soir'];
export const cleCreneau = (jour, creneau) => `${jour}/${creneau}`;

/** Combien de fois chaque recette est prévue à partir de `depuis` (« AAAA-MM-JJ », inclus). */
export function planAPartirDe(plan, depuis) {
  const fois = {};
  for (const [cle, id] of Object.entries(plan)) {
    const jour = cle.split('/')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(jour) && jour >= depuis) fois[id] = (fois[id] ?? 0) + 1;
  }
  return fois;
}

export const planVersJson = (plan) => {
  const cles = Object.keys(plan).sort();
  return cles.length ? '{\n' + cles.map((k) => `  ${citer(k)}: ${citer(plan[k])}`).join(',\n') + '\n}\n' : '{}\n';
};

export const boutiqueVersJson = (s) => {
  const liste = (l) => (l.length ? '[\n    ' + l.map(citer).join(',\n    ') + '\n  ]' : '[]');
  return `{\n  "manuels": ${liste(s.manuels)},\n  "coches": ${liste([...s.coches].sort())}\n}\n`;
};

export const boutiqueDepuisJson = (texte) => {
  const o = JSON.parse(texte);
  return { manuels: o.manuels ?? [], coches: o.coches ?? [] };
};

const MASSE = { mg: 0.001, g: 1, kg: 1000 };
const VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000 };
const normaliser = (nom) => sansAccents(nom.trim()).replace(/œ/g, 'oe').replace(/[sx]+$/, '');

function texteCumul(c) {
  const q = c.qte;
  if (q == null) return c.nom;
  if (c.famille === 'masse') return q >= 1000 ? `${formatQte(q / 1000)} kg ${c.nom}` : `${formatQte(q)} g ${c.nom}`;
  if (c.famille === 'volume') {
    if (q >= 1000) return `${formatQte(q / 1000)} l ${c.nom}`;
    return q >= 100 ? `${formatQte(q / 10)} cl ${c.nom}` : `${formatQte(q)} ml ${c.nom}`;
  }
  if (c.famille === '') return `${formatQte(q)} ${c.nom}`;
  return `${formatQte(q)} ${c.famille} ${c.nom}`;
}

/**
 * Additionne les ingrédients des recettes prévues (`recettes` : [recette, fois]). Les grammes et kilos se cumulent,
 * comme les millilitres, centilitres et litres ; une unité différente reste une ligne à part.
 */
export function agregerCourses(recettes) {
  const cumuls = new Map();
  for (const [r, fois] of recettes) {
    for (const ing of r.ingredients) {
      let famille;
      let facteur = 1;
      if (ing.unite in MASSE) [famille, facteur] = ['masse', MASSE[ing.unite]];
      else if (ing.unite in VOLUME) [famille, facteur] = ['volume', VOLUME[ing.unite]];
      else famille = ing.unite;
      const cle = (cleIngredient(ing.nom) || normaliser(ing.nom)) + '|' + famille;
      if (!cumuls.has(cle)) cumuls.set(cle, { nom: ing.nom, rayon: rayonIng(ing), famille, qte: null });
      const c = cumuls.get(cle);
      if (ing.qte != null) c.qte = (c.qte ?? 0) + ing.qte * facteur * fois;
    }
  }
  return [...cumuls].map(([cle, c]) => ({ cle, nom: c.nom, texte: texteCumul(c), rayon: c.rayon, manuel: false }));
}

export const coursesManuelles = (textes) =>
  textes.map((t) => ({ cle: 'm:' + t.toLowerCase(), nom: t, texte: t, rayon: rayonDe(t), manuel: true }));

export const trierCourses = (lignes) =>
  [...lignes].sort((a, b) => RAYON_ORDRE.indexOf(a.rayon) - RAYON_ORDRE.indexOf(b.rayon) || normaliser(a.nom).localeCompare(normaliser(b.nom)));

// --- Filtres de Mes recettes ---

export const REGIMES = { Vegetarien: 'Végétarien', SansViande: 'Sans viande', SansPoisson: 'Sans poisson' };
export const MENUS = { Tous: 'Tous', Prevu: 'Au menu', DejaFait: 'Déjà fait', Jamais: 'Jamais' };
export const TRIS = { Titre: 'A–Z', Duree: 'Durée', Simple: 'Simples', Souvent: 'Souvent' };

export const filtreVide = () => ({
  texte: '', ingredients: {}, unIngredient: false, tags: {}, minutesMin: 0, minutesMax: 0, portionsMin: 0, portionsMax: 0,
  ingredientsMax: 0, regimes: [], menu: 'Tous', tri: 'Titre',
});

const bornes = (a, b) => a > 0 || b > 0;

/** Combien de critères sont actifs (le tri n'en est pas un). */
export const criteresActifs = (f) =>
  (f.texte.trim() ? 1 : 0) + Object.keys(f.ingredients).length + Object.keys(f.tags).length +
  (bornes(f.minutesMin, f.minutesMax) ? 1 : 0) + (bornes(f.portionsMin, f.portionsMax) ? 1 : 0) +
  (f.ingredientsMax > 0 ? 1 : 0) + f.regimes.length + (f.menu !== 'Tous' ? 1 : 0);

export const cleTag = (t) => sansAccents(t.trim());

export function etiquettesTags(recettes) {
  const groupes = new Map();
  for (const r of recettes) {
    const vus = new Set();
    for (const t of r.tags) {
      const k = cleTag(t);
      if (!t.trim() || vus.has(k)) continue;
      vus.add(k);
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(t);
    }
  }
  return [...groupes].map(([cle, noms]) => {
    const freq = new Map();
    noms.forEach((n) => freq.set(n, (freq.get(n) ?? 0) + 1));
    return { cle, nom: [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0], recettes: noms.length };
  }).sort((a, b) => b.recettes - a.recettes || (a.cle < b.cle ? -1 : 1));
}

function contient(demandes, presents, un) {
  const avec = Object.keys(demandes).filter((k) => demandes[k] === 'Avec');
  const sans = Object.keys(demandes).filter((k) => demandes[k] === 'Sans');
  if (sans.some((k) => presents.has(k))) return false;
  if (!avec.length) return true;
  return un ? avec.some((k) => presents.has(k)) : avec.every((k) => presents.has(k));
}

const dans = (v, min, max) => (min === 0 && max === 0) || (v > 0 && v >= min && (max === 0 || v <= max));

function accepte(regime, rayons) {
  if (regime === 'Vegetarien') return !rayons.has('Viande') && !rayons.has('Poisson');
  if (regime === 'SansViande') return !rayons.has('Viande');
  return !rayons.has('Poisson');
}

/** Les recettes qui passent tous les critères du filtre, triées. `plan` : « jour/créneau » → identifiant de recette. */
export function appliquerFiltre(recettes, plan, f, aujourdhui) {
  const mots = f.texte.split(/\s+/).map(cleTag).filter(Boolean);
  const voulus = mots.filter((m) => !m.startsWith('-'));
  const refuses = mots.filter((m) => m.startsWith('-') && m.length > 1).map((m) => m.slice(1));
  const jours = {};
  for (const [k, id] of Object.entries(plan)) {
    const j = k.split('/')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(j)) (jours[id] ??= []).push(j);
  }
  const gardees = recettes.filter((r) => {
    if (mots.length) {
      const foin = cleTag(r.titre + ' ' + r.tags.join(' ') + ' ' + r.ingredients.map((i) => i.nom).join(' '));
      if (voulus.some((m) => !foin.includes(m)) || refuses.some((m) => foin.includes(m))) return false;
    }
    if (!contient(f.ingredients, clesRecette(r), f.unIngredient)) return false;
    if (!contient(f.tags, new Set(r.tags.map(cleTag)), false)) return false;
    if (!dans(r.minutes, f.minutesMin, f.minutesMax)) return false;
    if (!dans(r.portions, f.portionsMin, f.portionsMax)) return false;
    if (f.ingredientsMax > 0 && r.ingredients.length > f.ingredientsMax) return false;
    if (f.regimes.length) {
      const ray = new Set(r.ingredients.map(rayonIng));
      if (!f.regimes.every((x) => accepte(x, ray))) return false;
    }
    const js = jours[r.id] ?? [];
    if (f.menu === 'Prevu') return js.some((j) => j >= aujourdhui);
    if (f.menu === 'DejaFait') return js.some((j) => j < aujourdhui);
    if (f.menu === 'Jamais') return js.length === 0;
    return true;
  });
  const titre = (a, b) => cleTag(a.titre).localeCompare(cleTag(b.titre));
  const tris = {
    Titre: titre,
    Duree: (a, b) => (a.minutes > 0 ? a.minutes : Infinity) - (b.minutes > 0 ? b.minutes : Infinity) || titre(a, b) || 0,
    Simple: (a, b) => a.ingredients.length - b.ingredients.length || titre(a, b),
    Souvent: (a, b) => (jours[b.id]?.length ?? 0) - (jours[a.id]?.length ?? 0) || titre(a, b),
  };
  return [...gardees].sort((a, b) => {
    const r = tris[f.tri](a, b);
    return Number.isNaN(r) ? 0 : r;
  });
}

// --- Nutrition et statistiques ---

const CLES_OFF = Object.keys(CATEGORIES_OFF).sort((a, b) => b.length - a.length);

/** La catégorie Open Food Facts d'un ingrédient : l'entrée la plus longue qui est la clé ou son début. */
export function categorieOff(cle) {
  const k = CLES_OFF.find((x) => cle === x || cle.startsWith(x + ' '));
  return k && CATEGORIES_OFF[k] ? CATEGORIES_OFF[k] : null;
}

/** Le poids en grammes d'une ligne d'ingrédient ; null si la quantité ne se convertit pas. */
export function grammes(ing) {
  const q = ing.qte;
  if (q == null) return null;
  if (ing.unite in MASSE) return q * MASSE[ing.unite];
  if (ing.unite in VOLUME) return q * VOLUME[ing.unite];
  if (ing.unite === 'c. à s.') return q * 15;
  if (ing.unite === 'c. à c.') return q * 5;
  if (ing.unite === '') {
    const p = PIECES[cleIngredient(ing.nom)];
    return p != null ? q * p : null;
  }
  return null;
}

const mediane = (l) => {
  const s = [...l].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Les valeurs pour 100 g d'une réponse Open Food Facts : médiane des produits complets ; null s'il y en a moins de 3. */
export function valeursOff(reponse) {
  const lignes = [];
  for (const p of reponse.products ?? []) {
    const n = p.nutriments;
    if (!n) continue;
    const v = ['energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g'].map((k) => (typeof n[k] === 'number' ? n[k] : NaN));
    if (v.some(Number.isNaN) || v[0] < 0 || v[0] > 900) continue;
    lignes.push(v);
  }
  if (lignes.length < 3) return null;
  const m = [0, 1, 2, 3].map((c) => mediane(lignes.map((l) => l[c])));
  return { kcal: m[0], proteines: m[1], glucides: m[2], lipides: m[3] };
}

const ZERO = { kcal: 0, proteines: 0, glucides: 0, lipides: 0 };
const plus = (a, b) => ({ kcal: a.kcal + b.kcal, proteines: a.proteines + b.proteines, glucides: a.glucides + b.glucides, lipides: a.lipides + b.lipides });
const pour = (v, g) => ({ kcal: (v.kcal * g) / 100, proteines: (v.proteines * g) / 100, glucides: (v.glucides * g) / 100, lipides: (v.lipides * g) / 100 });

/**
 * Chaque repas du planning (jusqu'à `jusqua`, depuis `depuis` si donné) compte comme une portion de la recette.
 * `banque` : catégorie Open Food Facts → valeurs pour 100 g.
 */
export function statistiques(plan, recettes, banque, depuis, jusqua) {
  const parId = new Map(recettes.map((r) => [r.id, r]));
  const cumuls = new Map();
  const jours = new Set();
  let repas = 0;
  let total = ZERO;
  for (const [cle, id] of Object.entries(plan)) {
    const jour = cle.split('/')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour > jusqua || (depuis && jour < depuis)) continue;
    const r = parId.get(id);
    if (!r) continue;
    jours.add(jour);
    repas++;
    for (const ing of r.ingredients) {
      const k = cleIngredient(ing.nom);
      if (!k) continue;
      if (!cumuls.has(k)) cumuls.set(k, { cle: k, nom: ing.nom, rayon: rayonIng(ing), repas: 0, grammes: 0, valeurs: null });
      const c = cumuls.get(k);
      c.repas++;
      const g0 = grammes(ing);
      if (g0 == null) continue;
      const g = g0 / Math.max(r.portions, 1);
      c.grammes += g;
      const cat = categorieOff(k);
      const base = cat ? banque[cat] : null;
      if (!base) continue;
      const v = pour(base, g);
      c.valeurs = plus(c.valeurs ?? ZERO, v);
      total = plus(total, v);
    }
  }
  const aliments = [...cumuls.values()].sort((a, b) => b.repas - a.repas || b.grammes - a.grammes || a.nom.localeCompare(b.nom));
  const n = jours.size;
  const parJour = n ? { kcal: total.kcal / n, proteines: total.proteines / n, glucides: total.glucides / n, lipides: total.lipides / n } : null;
  return { jours: n, repas, total, parJour, aliments };
}

// --- Le Livre de cuisine de Wikibooks ---

export const PREFIXE_LIVRE = 'Livre de cuisine/';

export const CATEGORIES_LIVRE = [
  ['Pâtisseries', 'Pâtisseries'], ['Desserts', 'Desserts'], ['Recettes de tartes', 'Tartes'], ['Soupes', 'Soupes'],
  ['Salades', 'Salades'], ['Recettes végétariennes', 'Végétarien'], ['Recettes végétaliennes', 'Végétalien'],
  ['Poissons', 'Poissons'], ['Recettes sans gluten', 'Sans gluten'], ['Recettes sans lactose', 'Sans lactose'],
  ['Biscuits', 'Biscuits'], ['Pains', 'Pains'], ['Petits-déjeuners', 'Petit-déjeuner'], ['Entrées', 'Entrées'],
  ['Plat principal', 'Plats'], ['Accompagnements', 'Accompagnements'], ['Galettes', 'Galettes'],
  ['Pâtes alimentaires', 'Pâtes'], ['Confitures', 'Confitures'],
];
export const ACCUEIL_LIVRE = ['Pâtisseries', 'Desserts', 'Recettes de tartes'];

/** « Livre de cuisine/Brownies » → « Brownies » ; null si ce n'est pas une page de recette. */
export function nomPageLivre(titre) {
  if (!titre.startsWith(PREFIXE_LIVRE)) return null;
  const nom = titre.slice(PREFIXE_LIVRE.length).trim();
  return nom && !nom.includes('/') ? nom : null;
}

/** Du wikitexte à du texte lisible : sans modèles, liens, images, balises ni mise en forme. */
export function nettoyerWikitexte(s) {
  let t = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<gallery[\s\S]*?<\/gallery>/g, '').replace(/<br\s*\/?>/gi, ' ');
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\{\{\s*[iI]\s*\|([^{}]*)\}\}/g, (_, g) => g.split('|').filter((x) => !x.includes('=')).pop() ?? '');
    t = t.replace(/\{\{[^{}]*\}\}/g, '');
  }
  return t
    .replace(/\[\[:?(?:Image|Fichier|File|Catégorie|Category):[^\]]*\]\]/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\[https?:\/\/[^\]\s]*\]/g, '')
    .replace(/<[^>]+>/g, '').replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

const RUBRIQUES_NOTES = /note|remarque|astuce|conseil|variante|anecdote|histoire|accord|vin |origine/;
const RUBRIQUES_FIN = /voir aussi|reference|lien|galerie|bibliograph|source|photo|image|ustensile|materiel|temps|duree|cout|difficulte/;

function dureeDe(texte, mot) {
  const m = new RegExp(`${mot}\\b[^\\n\\d]{0,25}?(\\d+)\\s*(h|heures?|min\\w*|mn)(?:\\s*(\\d+))?`, 'i').exec(texte);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase().startsWith('h') ? n * 60 + (parseInt(m[3], 10) || 0) : n;
}

/** Range une page du Livre de cuisine en recette : ingrédients (puces), étapes (numérotées ou paragraphes), notes. */
export function recetteDepuisWikitexte(titrePage, texte) {
  const tags = [...new Set([...texte.matchAll(/\[\[Catégorie:([^\]|]+)/g)].map((m) => m[1].trim()).filter(Boolean)
    .map((t) => t.replace(/^Recettes de /, '').replace(/^Recettes /, '')).map((t) => t.charAt(0).toUpperCase() + t.slice(1)))].slice(0, 4);
  const propre = nettoyerWikitexte(texte);
  const pm = /(\d+)\s*(?:à\s*\d+\s*)?(?:personnes?|pers\b|parts?|convives?|portions?)/i.exec(propre);
  const portions = pm && parseInt(pm[1], 10) >= 1 && parseInt(pm[1], 10) <= 50 ? parseInt(pm[1], 10) : 4;
  const mn = dureeDe(propre, 'préparation') + dureeDe(propre, 'cuisson');
  const minutes = mn >= 1 && mn <= 1500 ? mn : 0;
  const ingredients = [];
  const etapes = [];
  const notes = [];
  let mode = 'Intro';
  let niveauIng = 0;
  for (const brute of propre.split('\n')) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const h = /^(={2,6})\s*(.+?)\s*=+\s*$/.exec(ligne);
    if (h) {
      const niveau = h[1].length;
      const nom = sansAccents(h[2]) + ' ';
      if (nom.includes('ingredient')) {
        niveauIng = niveau;
        mode = 'Ingredients';
      } else if (mode === 'Ingredients' && niveau > niveauIng) mode = 'Ingredients';
      else if (RUBRIQUES_FIN.test(nom)) mode = 'Fin';
      else if (RUBRIQUES_NOTES.test(nom)) mode = 'Notes';
      else if (mode === 'Intro') mode = 'Intro';
      else if (mode === 'Fin' || (mode === 'Notes' && niveau <= 2)) mode = 'Etapes';
      else mode = mode === 'Notes' ? 'Notes' : 'Etapes';
      continue;
    }
    if (/^(\{\||\||!|__)/.test(ligne) || /^(Image|Fichier|File):/i.test(ligne)) continue;
    const puce = /^[*#:;]/.test(ligne);
    const contenu = ligne.replace(/^[*#:; ]+/, '').trim();
    if (contenu.length < 2) continue;
    if (mode === 'Ingredients') {
      if (puce && !contenu.endsWith(':')) {
        const l = contenu.replace(/[,;. ]+$/, '');
        if (l) ingredients.push(ingredientRange(l));
      }
    } else if (mode === 'Etapes') {
      if (contenu.length >= 3) etapes.push(contenu);
    } else if (mode === 'Notes') notes.push(contenu);
  }
  notes.push(`Source : Livre de cuisine, Wikibooks (CC BY-SA) — https://fr.wikibooks.org/wiki/${titrePage.replace(/ /g, '_')}`);
  return { id: '', titre: nomPageLivre(titrePage) ?? titrePage, portions, minutes, tags, ingredients, etapes, notes: notes.join('\n') };
}

/** Les titres de pages de recettes d'une réponse « categorymembers » ou « search » de l'API MediaWiki. */
export function titresLivre(o) {
  const q = o.query ?? {};
  return (q.categorymembers ?? q.search ?? []).map((x) => x.title).filter((t) => nomPageLivre(t) !== null);
}
