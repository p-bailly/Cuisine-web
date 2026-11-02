// Le planning de la semaine : deux repas par jour.
import { CRENEAUX, cleCreneau, cleTag } from './coeur.js';
import { h, svg, bouton, vider, champRecherche, ouvrirVoile, aujourdhui } from './ui.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Le lundi de la semaine de `d`. */
export function lundiDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

let decalage = 0;

function choisirRecette(app, cle) {
  const d = app.donnees;
  let q = '';
  const liste = h('div', { class: 'liste' });
  const dessiner = () => {
    vider(liste);
    const mots = cleTag(q).split(/\s+/).filter(Boolean);
    d.recettes.filter((r) => mots.every((m) => cleTag(r.titre + ' ' + r.tags.join(' ')).includes(m))).forEach((r) =>
      liste.append(h('div', { class: 'ligne', role: 'button', tabindex: 0, onclick: () => { d.planifier(cle, r.id); fermer(); } }, h('div', { class: 'corps' }, h('b', null, r.titre)))));
    if (!liste.firstChild) liste.append(h('div', { class: 'vide' }, svg('recherche')));
  };
  const champ = champRecherche('Rechercher', '', (v) => { q = v; dessiner(); });
  const fermer = ouvrirVoile(h('div', { class: 'feuille', role: 'dialog' }, h('div', { class: 'rangee', style: { padding: '8px 16px' } }, champ.racine), h('div', { class: 'defile', style: { padding: 0 } }, liste)));
  dessiner();
  setTimeout(() => champ.input.focus(), 0);
}

export function ecranPlan(app) {
  const d = app.donnees;
  const racine = h('div');
  function dessiner() {
    vider(racine);
    const lundi = lundiDe(new Date());
    lundi.setDate(lundi.getDate() + decalage * 7);
    const dimanche = new Date(lundi);
    dimanche.setDate(dimanche.getDate() + 6);
    const fmt = (x, o) => x.toLocaleDateString('fr-FR', o);
    const titre = `${lundi.getDate()} – ${dimanche.getDate()} ${fmt(dimanche, { month: 'short' })}`;
    const parId = new Map(d.recettes.map((r) => [r.id, r]));
    racine.append(
      h('div', { class: 'barre' },
        bouton('retour', () => { decalage--; dessiner(); }, { titre: 'Semaine précédente' }),
        h('button', { class: 'entete', style: { flex: 1, justifyContent: 'center', padding: '4px' }, onclick: () => { decalage = 0; dessiner(); } }, h('h1', { style: { flex: 'none', fontSize: '22px' } }, titre)),
        bouton('retour', () => { decalage++; dessiner(); }, { titre: 'Semaine suivante', classe: 'suivant' }),
        bouton('stats', () => app.naviguer('stats'), { titre: 'Statistiques' }),
      ),
      h('div', { class: 'entetes-c' }, CRENEAUX.map((c) => h('span', null, c.charAt(0).toUpperCase() + c.slice(1)))),
    );
    racine.querySelector('.suivant svg').style.transform = 'scaleX(-1)';
    for (let i = 0; i < 7; i++) {
      const j = new Date(lundi);
      j.setDate(j.getDate() + i);
      const jour = iso(j);
      racine.append(
        h('div', { class: `jour${jour === aujourdhui() ? ' auj' : ''}`, style: { marginBottom: '8px' } },
          h('div', { class: 'date' }, fmt(j, { weekday: 'short' }).replace('.', ''), h('b', null, String(j.getDate()))),
          CRENEAUX.map((c) => {
            const cle = cleCreneau(jour, c);
            const r = parId.get(d.plan[cle]);
            if (!r) return h('button', { class: 'creneau vide-c', 'aria-label': `Ajouter un repas, ${c} du ${jour}`, onclick: () => choisirRecette(app, cle) }, svg('plus'));
            return h('div', { class: 'creneau' },
              h('button', { style: { flex: 1, textAlign: 'left', fontWeight: 700, minWidth: 0 }, onclick: () => app.naviguer('recette/' + r.id) }, h('span', null, r.titre)),
              h('button', { class: 'ic', style: { width: '30px', height: '30px' }, 'aria-label': 'Retirer', onclick: () => d.planifier(cle, null) }, svg('fermer')));
          }),
        ),
      );
    }
  }
  dessiner();
  return { el: racine, rafraichir: dessiner };
}
