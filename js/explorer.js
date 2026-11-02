// Explorer : le Livre de cuisine de Wikibooks (en français), et des idées de Claude si la clé est saisie.
import { CATEGORIES_LIVRE, ACCUEIL_LIVRE, duree } from './coeur.js';
import { livreParCategorie, livreChercher, livreRecette, idees } from './api.js';
import { reglages } from './store.js';
import { h, svg, bouton, vider, puce, champRecherche, toast } from './ui.js';

// L'état est gardé d'un passage à l'autre : on revient à Explorer là où on l'avait laissé.
const etat = { requete: '', categorie: null, liste: null, erreur: '', charge: false };

const melanger = (l) => l.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function ecranExplorer(app) {
  const racine = h('div');
  const zone = h('div');
  const puces = h('div', { class: 'puces' });
  const champ = champRecherche('Envie ou plat', etat.requete, (v) => { etat.requete = v; }, () => chercher());

  async function charger(fn) {
    etat.charge = true; etat.erreur = ''; majZone();
    try {
      etat.liste = await fn();
      if (!etat.liste.length) etat.erreur = 'Rien trouvé';
    } catch (e) {
      etat.liste = []; etat.erreur = e.message;
    }
    etat.charge = false;
    majZone();
  }

  const accueil = () => charger(async () => {
    const tous = (await Promise.all(ACCUEIL_LIVRE.map((c) => livreParCategorie(c).catch(() => [])))).flat();
    if (!tous.length) throw new Error('Pas de connexion');
    return melanger([...new Map(tous.map((x) => [x.page, x])).values()]).slice(0, 30).map((x) => ({ ...x, origine: 'livre' }));
  });

  function chercher() {
    const q = etat.requete.trim();
    if (!q || etat.charge) return;
    etat.categorie = null;
    majPuces();
    charger(async () => {
      const cle = reglages.cleClaude;
      const [i, l] = await Promise.all([
        cle ? idees(cle, q).catch((e) => { toast(e.message); return []; }) : [],
        livreChercher(q),
      ]);
      return [...i.map((r) => ({ titre: r.titre, recette: r, origine: 'idee' })), ...l.map((x) => ({ ...x, origine: 'livre' }))];
    });
  }

  function categorie(cle) {
    if (etat.categorie === cle) {
      etat.categorie = null;
      majPuces();
      return accueil();
    }
    etat.categorie = cle;
    majPuces();
    charger(async () => (await livreParCategorie(cle)).map((x) => ({ ...x, origine: 'livre' })));
  }

  async function ouvrir(x) {
    try {
      app.apercu = x.recette ?? (await livreRecette(x.page));
      app.naviguer('apercu');
    } catch (e) {
      toast(e.message);
    }
  }

  function majPuces() {
    vider(puces);
    CATEGORIES_LIVRE.forEach(([cle, nom]) => puces.append(puce(nom, { choisie: etat.categorie === cle, onclick: () => categorie(cle) })));
  }

  function majZone() {
    vider(zone);
    if (etat.charge) return void zone.append(h('div', { class: 'vide' }, (() => { const s = svg('actualiser'); s.classList.add('tourne'); return s; })()));
    if (etat.erreur) zone.append(h('div', { class: 'erreur', style: { padding: '24px 20px', fontSize: '16px', color: 'var(--discret)' } }, etat.erreur));
    zone.append(h('div', { class: 'liste' }, (etat.liste ?? []).map((x) =>
      h('div', { class: 'ligne', role: 'link', tabindex: 0, onclick: () => ouvrir(x), onkeydown: (e) => e.key === 'Enter' && ouvrir(x) },
        h('div', { class: 'corps' }, h('b', null, x.titre),
          x.recette ? h('span', { class: 'sous' }, [x.recette.minutes > 0 ? duree(x.recette.minutes) : null, `${x.recette.ingredients.length} ingr.`].filter(Boolean).join(' · ')) : null),
        svg(x.origine === 'idee' ? 'etoile' : 'livre'),
      ))));
  }

  racine.append(
    h('div', { class: 'entete' }, h('h1', null, 'Explorer'), bouton('reglages', () => app.reglages(), { titre: 'Réglages' })),
    h('div', { class: 'rangee' }, champ.racine, bouton('recherche', chercher, { titre: 'Chercher' })),
    puces, zone,
  );
  majPuces();
  majZone();
  if (etat.liste === null) accueil();
  return { el: racine };
}
