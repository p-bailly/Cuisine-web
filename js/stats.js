// Les statistiques de consommation : ce que les repas du planning ont fait manger, aliment par aliment.
import { statistiques, categorieOff, cleIngredient } from './coeur.js';
import { valeursCategorie } from './api.js';
import { reglages } from './store.js';
import { h, svg, bouton, vider, puce, aujourdhui } from './ui.js';

let periode = 7;
const vides = new Set(); // catégories sans assez de produits : on ne redemande pas pendant cette session
let enCours = false;

function debut(jours) {
  if (jours === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - (jours - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ecranStats(app) {
  const d = app.donnees;
  const racine = h('div');
  let actif = true;

  function dessiner() {
    vider(racine);
    const b = statistiques(d.plan, d.recettes, reglages.banque, debut(periode), aujourdhui());
    racine.append(
      h('div', { class: 'barre' }, bouton('retour', () => app.retour('plan'), { titre: 'Retour' }), svg('stats')),
      h('div', { class: 'puces' }, [[7, '7 j'], [30, '30 j'], [0, 'Tout']].map(([j, nom]) => puce(nom, { choisie: periode === j, onclick: () => { periode = j; dessiner(); } }))),
    );
    if (b.parJour) {
      const p = b.parJour.proteines * 4;
      const g = b.parJour.glucides * 4;
      const l = b.parJour.lipides * 9;
      const somme = Math.max(p + g + l, 1);
      const macro = (lettre, grammes, couleur) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, fontSize: '14px' } },
        h('span', { class: 'point', style: { background: couleur } }), `${lettre} ${Math.round(grammes)} g`);
      racine.append(h('div', { style: { padding: '8px 20px' } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } }, h('span', { class: 'gros' }, String(Math.round(b.parJour.kcal))), h('span', { style: { color: 'var(--discret)' } }, 'kcal / jour')),
        h('div', { class: 'macros' },
          h('i', { style: { flex: String(p / somme || 0.001), background: 'var(--r-Viande)' } }),
          h('i', { style: { flex: String(g / somme || 0.001), background: 'var(--r-Epicerie)' } }),
          h('i', { style: { flex: String(l / somme || 0.001), background: 'var(--r-Cremerie)' } })),
        h('div', { style: { display: 'flex', gap: '14px' } }, macro('P', b.parJour.proteines, 'var(--r-Viande)'), macro('G', b.parJour.glucides, 'var(--r-Epicerie)'), macro('L', b.parJour.lipides, 'var(--r-Cremerie)'))));
    }
    if (!b.aliments.length) return void racine.append(h('div', { class: 'vide' }, svg('stats')));
    const max = Math.max(...b.aliments.map((a) => a.grammes), 1);
    const poids = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1).replace('.', ',')} kg` : `${Math.round(g)} g`);
    b.aliments.forEach((a) => racine.append(
      h('div', { class: 'stat-ligne' },
        h('div', { class: 'tete' },
          h('span', { class: 'point', style: { background: `var(--r-${a.rayon})` } }),
          h('b', { style: { flex: 1 } }, a.nom.charAt(0).toUpperCase() + a.nom.slice(1)),
          h('span', { style: { color: 'var(--discret)', fontSize: '14px' } }, `×${a.repas}`),
          a.grammes > 0 ? h('span', { style: { color: 'var(--discret)', fontSize: '14px' } }, poids(a.grammes)) : null,
          h('b', { style: { color: a.valeurs ? 'var(--accent)' : 'var(--discret)', fontSize: '14px' } }, a.valeurs ? `${Math.round(a.valeurs.kcal)} kcal` : '?')),
        h('div', { class: 'barre-fond' }, h('i', { style: { width: Math.max((a.grammes / max) * 100, 2) + '%', background: `var(--r-${a.rayon})` } })))));
  }

  /** Télécharge, une catégorie à la fois et sans se presser, les valeurs des aliments mangés qui manquent. */
  async function completer() {
    if (enCours) return;
    enCours = true;
    try {
      const tout = statistiques(d.plan, d.recettes, {}, null, aujourdhui());
      const cats = [...new Set(tout.aliments.map((a) => categorieOff(a.cle)).filter(Boolean))];
      for (const c of cats) {
        if (!actif) break;
        if (c in reglages.banque || vides.has(c)) continue;
        let v;
        try { v = await valeursCategorie(c); } catch { break; }
        if (v) reglages.banque = { ...reglages.banque, [c]: v };
        else vides.add(c);
        if (actif) dessiner();
        await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      enCours = false;
    }
  }

  dessiner();
  completer();
  return { el: racine, rafraichir: dessiner, detruire() { actif = false; } };
}
