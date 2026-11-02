// Le squelette de l'appli : routes, barre d'onglets, réglages.
import { Donnees, reglages } from './store.js';
import { h, svg, vider, ouvrirVoile, toast } from './ui.js';
import { ecranRecettes } from './recettes.js';
import { ecranFiche, ecranEditeur, ecranHistorique, ecranApercu } from './fiche.js';
import { ecranPlan } from './plan.js';
import { ecranCourses } from './courses.js';
import { ecranExplorer } from './explorer.js';
import { ecranStats } from './stats.js';

const ONGLETS = [
  ['plan', 'Plan', 'calendrier'],
  ['courses', 'Courses', 'panier'],
  ['explorer', 'Explorer', 'boussole'],
  ['recettes', 'Mes recettes', 'liste'],
];

export const app = {
  donnees: new Donnees(),
  /** Une recette à relire dans l'éditeur avant de l'enregistrer (venue d'Explorer, d'une variante…). */
  brouillon: null,
  /** Une recette d'Explorer affichée en aperçu. */
  apercu: null,
  naviguer(route) { location.hash = '#/' + route; },
  retour(defaut = 'recettes') { history.length > 1 ? history.back() : app.naviguer(defaut); },
  reglages: ouvrirReglages,
};

let courant = null;

function route() {
  const [nom, arg] = location.hash.replace(/^#\//, '').split('/').map(decodeURIComponent);
  return { nom: nom || 'recettes', arg };
}

function rendre() {
  const { nom, arg } = route();
  const racine = document.getElementById('app');
  courant?.detruire?.();
  vider(racine);
  const onglet = ONGLETS.some((o) => o[0] === nom);
  const fabriques = {
    recettes: ecranRecettes, plan: ecranPlan, courses: ecranCourses, explorer: ecranExplorer,
    recette: ecranFiche, editer: ecranEditeur, historique: ecranHistorique, stats: ecranStats, apercu: ecranApercu,
  };
  courant = (fabriques[nom] ?? ecranRecettes)(app, arg);
  const ecran = h('main', { class: 'ecran', id: 'ecran' }, courant.el);
  racine.append(ecran);
  if (onglet) {
    racine.append(
      h('nav', { class: 'onglets' },
        ONGLETS.map(([id, titre, icone]) =>
          h('button', { 'aria-current': id === nom ? 'page' : null, onclick: () => app.naviguer(id) }, svg(icone), titre)),
      ),
    );
  }
  window.scrollTo(0, 0);
}

function ouvrirReglages() {
  const jeton = h('input', { type: 'password', value: reglages.jeton, autocomplete: 'off', placeholder: 'github_pat_…' });
  const cle = h('input', { type: 'password', value: reglages.cleClaude, autocomplete: 'off', placeholder: 'sk-ant-…' });
  const fermer = ouvrirVoile(
    h('div', { class: 'dialogue', role: 'dialog' },
      h('label', null, 'Jeton GitHub', jeton),
      h('label', null, 'Clé API Claude', cle),
      h('div', { class: 'actions' },
        h('button', { class: 'ic', onclick: () => fermer(), 'aria-label': 'Fermer' }, svg('fermer')),
        h('button', {
          class: 'bouton',
          'aria-label': 'Valider',
          onclick: () => {
            reglages.jeton = jeton.value;
            reglages.cleClaude = cle.value;
            fermer();
            app.donnees.actualiser();
          },
        }, svg('coche')),
      ),
    ),
    { centre: true },
  );
}

app.donnees.ecouter(() => courant?.rafraichir?.());
window.addEventListener('hashchange', rendre);
rendre();
if (reglages.jeton) app.donnees.actualiser();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('error', (e) => toast(e.message));
