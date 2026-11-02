// Mes recettes : recherche, critères actifs, liste, et la feuille de filtres (sections repliables).
import {
  appliquerFiltre, filtreVide, criteresActifs, etiquettesIngredients, etiquettesTags, cleTag, rayonIng, duree,
  REGIMES, MENUS, TRIS,
} from './coeur.js';
import { reglages } from './store.js';
import { h, svg, bouton, vider, puce, point, champRecherche, ouvrirVoile, demander, aujourdhui } from './ui.js';

const lireFiltre = () => {
  try {
    return { ...filtreVide(), ...JSON.parse(sessionStorage.getItem('cuisine.filtre') ?? '{}') };
  } catch {
    return filtreVide();
  }
};
const sauverFiltre = (f) => {
  try { sessionStorage.setItem('cuisine.filtre', JSON.stringify(f)); } catch { /* sans importance */ }
};

const plage = (min, max, format) =>
  min > 0 && max > 0 ? (min === max ? format(min) : `${format(min)} – ${format(max)}`) : max > 0 ? `≤ ${format(max)}` : min > 0 ? `≥ ${format(min)}` : '–';

/** Les critères actifs sous forme de puces à retirer : { texte, etat, retirer(filtre) }. */
export function listeCriteres(f, ingredients, tags) {
  const nomIng = (k) => ingredients.find((i) => i.cle === k)?.nom ?? k;
  const nomTag = (k) => tags.find((t) => t.cle === k)?.nom ?? k;
  const l = [];
  for (const [k, e] of Object.entries(f.ingredients)) l.push({ texte: nomIng(k), etat: e, retirer: (x) => { delete x.ingredients[k]; } });
  for (const [k, e] of Object.entries(f.tags)) l.push({ texte: '#' + nomTag(k), etat: e, retirer: (x) => { delete x.tags[k]; } });
  if (f.minutesMin > 0 || f.minutesMax > 0) l.push({ texte: plage(f.minutesMin, f.minutesMax, duree), etat: null, retirer: (x) => { x.minutesMin = x.minutesMax = 0; } });
  if (f.portionsMin > 0 || f.portionsMax > 0) l.push({ texte: plage(f.portionsMin, f.portionsMax, (n) => `${n} pers.`), etat: null, retirer: (x) => { x.portionsMin = x.portionsMax = 0; } });
  if (f.ingredientsMax > 0) l.push({ texte: `≤ ${f.ingredientsMax} ingr.`, etat: null, retirer: (x) => { x.ingredientsMax = 0; } });
  for (const r of f.regimes) l.push({ texte: REGIMES[r], etat: null, retirer: (x) => { x.regimes = x.regimes.filter((y) => y !== r); } });
  if (f.menu !== 'Tous') l.push({ texte: MENUS[f.menu], etat: null, retirer: (x) => { x.menu = 'Tous'; } });
  return l;
}

export function ecranRecettes(app) {
  const d = app.donnees;
  let filtre = lireFiltre();
  const entete = h('div', { class: 'entete' });
  const recherche = champRecherche('Rechercher', filtre.texte, (v) => {
    filtre.texte = v;
    sauverFiltre(filtre);
    majListe();
  });
  const rangee = h('div', { class: 'rangee' });
  const zoneCriteres = h('div');
  const zoneListe = h('div');
  const racine = h('div', null, entete, h('div', { id: 'erreur' }), rangee, zoneCriteres, zoneListe);

  const catalogue = () => ({ ingredients: etiquettesIngredients(d.recettes), tags: etiquettesTags(d.recettes) });

  function appliquer() {
    sauverFiltre(filtre);
    majCriteres();
    majListe();
  }

  function majEntete() {
    vider(entete);
    const charge = d.etat === 'charge';
    const actu = bouton('actualiser', () => d.actualiser(), { titre: 'Actualiser' });
    if (charge) actu.firstChild.classList.add('tourne');
    if (d.etat === 'erreur') actu.style.color = 'var(--erreur)';
    entete.append(h('h1', null, 'Mes recettes'), actu, bouton('reglages', () => app.reglages(), { titre: 'Réglages' }));
    const err = racine.querySelector('#erreur');
    vider(err);
    if (d.etat === 'erreur') err.append(h('div', { class: 'erreur' }, d.erreur));
  }

  function majRangee() {
    vider(rangee);
    const sansTexte = criteresActifs(filtre) - (filtre.texte.trim() ? 1 : 0);
    rangee.append(recherche.racine, bouton('filtre', ouvrirFeuille, { titre: 'Filtres', pastille: sansTexte, classe: sansTexte ? 'doux' : '' }));
  }

  function majCriteres() {
    vider(zoneCriteres);
    const { ingredients, tags } = catalogue();
    const criteres = listeCriteres({ ...filtre, texte: '' }, ingredients, tags);
    if (!criteres.length) return;
    zoneCriteres.append(
      h('div', { class: 'puces' },
        h('button', { class: 'puce carre', 'aria-label': 'Tout retirer', onclick: () => { filtre = { ...filtreVide(), texte: filtre.texte, tri: filtre.tri }; appliquer(); majRangee(); } }, svg('fermer')),
        criteres.map((c) => puce(c.texte, { choisie: c.etat == null, etat: c.etat, onclick: () => { c.retirer(filtre); appliquer(); majRangee(); } })),
      ),
    );
  }

  function resultats() {
    return appliquerFiltre(d.recettes, d.plan, filtre, aujourdhui());
  }

  function majListe() {
    vider(zoneListe);
    if (!reglages.jeton && !d.recettes.length) {
      zoneListe.append(h('div', { class: 'vide bouton' }, h('button', { onclick: () => app.reglages(), 'aria-label': 'Réglages' }, svg('reglages'))));
      return;
    }
    if (!d.recettes.length) {
      zoneListe.append(h('div', { class: 'vide bouton' }, h('button', { onclick: nouvelle, 'aria-label': 'Nouvelle recette' }, svg('plus'))));
      return;
    }
    const liste = resultats();
    if (!liste.length) zoneListe.append(h('div', { class: 'vide' }, svg('filtre')));
    zoneListe.append(
      h('div', { class: 'liste' }, liste.map((r) => {
        const rayons = [...r.ingredients.map(rayonIng).filter((x) => x !== 'Autre').reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())]
          .sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
        return h('div', { class: 'ligne', role: 'link', tabindex: 0, onclick: () => app.naviguer('recette/' + r.id), onkeydown: (e) => e.key === 'Enter' && app.naviguer('recette/' + r.id) },
          h('div', { class: 'corps' }, h('b', null, r.titre), h('span', { class: 'sous' }, [r.minutes > 0 ? duree(r.minutes) : null, `${r.portions} pers.`].filter(Boolean).join(' · '))),
          h('div', { class: 'points' }, rayons.map(point)),
        );
      })),
    );
  }

  function nouvelle() {
    app.brouillon = null;
    app.naviguer('editer/nouveau');
  }

  function ouvrirFeuille() {
    const fermer = feuilleFiltres(app, () => filtre, (f) => { filtre = f; appliquer(); majRangee(); }, resultats, catalogue());
    return fermer;
  }

  racine.append(h('button', { class: 'fab', 'aria-label': 'Nouvelle recette', onclick: nouvelle }, svg('plus')));
  majEntete(); majRangee(); majCriteres(); majListe();
  return {
    el: racine,
    rafraichir() { majEntete(); majCriteres(); majListe(); },
  };
}

// --- La feuille de filtres ---

function plageDouble({ debut, fin, pas, min, max, onInput }) {
  const lo = h('input', { type: 'range', min: debut, max: fin, step: pas, value: min || debut, 'aria-label': 'Minimum' });
  const hi = h('input', { type: 'range', min: debut, max: fin, step: pas, value: max || fin, 'aria-label': 'Maximum' });
  const rempli = h('div', { class: 'rempli' });
  const racine = h('div', { class: 'plage' }, rempli, lo, hi);
  const pct = (v) => ((v - debut) / (fin - debut)) * 100;
  function maj(source) {
    let a = +lo.value;
    let b = +hi.value;
    if (a > b) {
      if (source === lo) lo.value = a = b;
      else hi.value = b = a;
    }
    rempli.style.left = pct(a) + '%';
    rempli.style.width = pct(b) - pct(a) + '%';
    onInput(a <= debut ? 0 : a, b >= fin ? 0 : b);
  }
  lo.addEventListener('input', () => maj(lo));
  hi.addEventListener('input', () => maj(hi));
  rempli.style.left = pct(+lo.value) + '%';
  rempli.style.width = pct(+hi.value) - pct(+lo.value) + '%';
  return racine;
}

function feuilleFiltres(app, lire, ecrire, resultats, catalogue) {
  let f = lire();
  let ouverte = null;
  let rechIng = '';
  let rechTags = '';
  const defile = h('div', { class: 'defile' });
  const nombre = h('span');
  const reinit = bouton('actualiser', () => { changer(() => Object.assign(f, { ...filtreVide(), tri: f.tri, texte: f.texte })); dessiner(); }, { titre: 'Tout effacer' });
  const ok = h('button', { class: 'bouton large', onclick: () => fermer() }, svg('coche'), nombre);
  const feuille = h('div', { class: 'feuille', role: 'dialog' }, defile, h('div', { class: 'pied' }, reinit, ok));
  const fermer = ouvrirVoile(feuille);
  const resumes = [];

  function changer(modif) {
    modif(f);
    ecrire(f);
    f = lire();
    majResumes();
  }

  const cycle = (m, k) => { if (!m[k]) m[k] = 'Avec'; else if (m[k] === 'Avec') m[k] = 'Sans'; else delete m[k]; };
  const resumeEtats = (m) => {
    const a = Object.values(m).filter((x) => x === 'Avec').length;
    const s = Object.values(m).length - a;
    return [a ? `+${a}` : '', s ? `−${s}` : ''].filter(Boolean).join(' ') || null;
  };

  function majResumes() {
    resumes.forEach((fn) => fn());
    const n = resultats().length;
    nombre.textContent = String(n);
    reinit.disabled = criteresActifs(f) === 0;
  }

  const FlowChips = () => h('div', { class: 'puces libre' });

  const sections = [
    { id: 'duree', icone: 'horloge', titre: 'Durée', resume: () => (f.minutesMin > 0 || f.minutesMax > 0 ? plage(f.minutesMin, f.minutesMax, duree) : null),
      contenu: () => plageDouble({ debut: 0, fin: 180, pas: 5, min: f.minutesMin, max: f.minutesMax, onInput: (a, b) => changer((x) => { x.minutesMin = a; x.minutesMax = b; }) }) },
    { id: 'portions', icone: 'personne', titre: 'Portions', resume: () => (f.portionsMin > 0 || f.portionsMax > 0 ? plage(f.portionsMin, f.portionsMax, (n) => `${n} pers.`) : null),
      contenu: () => plageDouble({ debut: 1, fin: 12, pas: 1, min: f.portionsMin, max: f.portionsMax, onInput: (a, b) => changer((x) => { x.portionsMin = a; x.portionsMax = b; }) }) },
    { id: 'simple', icone: 'liste', titre: 'Simplicité', resume: () => (f.ingredientsMax > 0 ? `≤ ${f.ingredientsMax} ingr.` : null),
      contenu: () => {
        const r = h('input', { type: 'range', min: 1, max: 20, step: 1, value: f.ingredientsMax || 20, 'aria-label': 'Nombre maximum d\'ingrédients' });
        r.addEventListener('input', () => changer((x) => { x.ingredientsMax = +r.value >= 20 ? 0 : +r.value; }));
        return h('div', { class: 'plage simple' }, r);
      } },
    { id: 'ingredients', icone: 'feuille', titre: 'Ingrédients', resume: () => { const r = resumeEtats(f.ingredients); return r && f.unIngredient ? r + ' · un seul' : r; },
      contenu: () => {
        const zone = FlowChips();
        const dessiner = () => {
          vider(zone);
          const q = cleTag(rechIng);
          catalogue.ingredients
            .filter((i) => i.cle in f.ingredients || !q || cleTag(i.nom).includes(q))
            .sort((a, b) => (b.cle in f.ingredients) - (a.cle in f.ingredients))
            .slice(0, 50)
            .forEach((i) => zone.append(puce(i.nom, { compte: i.recettes, etat: f.ingredients[i.cle], onclick: () => { changer((x) => cycle(x.ingredients, i.cle)); dessiner(); } })));
        };
        const champ = champRecherche('Ingrédients', rechIng, (v) => { rechIng = v; dessiner(); });
        const mode = h('div', { class: 'puces libre' });
        const dessinerMode = () => {
          vider(mode);
          mode.append(puce('Tous', { choisie: !f.unIngredient, onclick: () => { changer((x) => { x.unIngredient = false; }); dessinerMode(); } }),
            puce('Un', { choisie: f.unIngredient, onclick: () => { changer((x) => { x.unIngredient = true; }); dessinerMode(); } }));
        };
        dessiner(); dessinerMode();
        return h('div', { class: 'contenu', style: { padding: 0 } }, h('div', { class: 'rangee', style: { padding: 0 } }, champ.racine, mode), zone);
      } },
    { id: 'tags', icone: 'etiquette', titre: 'Étiquettes', resume: () => resumeEtats(f.tags),
      contenu: () => {
        const zone = FlowChips();
        const dessiner = () => {
          vider(zone);
          const q = cleTag(rechTags);
          catalogue.tags
            .filter((t) => t.cle in f.tags || !q || t.cle.includes(q))
            .sort((a, b) => (b.cle in f.tags) - (a.cle in f.tags))
            .slice(0, 40)
            .forEach((t) => zone.append(puce(t.nom, { compte: t.recettes, etat: f.tags[t.cle], onclick: () => { changer((x) => cycle(x.tags, t.cle)); dessiner(); } })));
        };
        dessiner();
        return h('div', { class: 'contenu', style: { padding: 0 } }, champRecherche('Étiquettes', rechTags, (v) => { rechTags = v; dessiner(); }).racine, zone);
      } },
    { id: 'regime', icone: 'feuille', titre: 'Régime', resume: () => f.regimes.map((r) => REGIMES[r]).join(', ') || null,
      contenu: () => {
        const zone = FlowChips();
        const dessiner = () => {
          vider(zone);
          Object.entries(REGIMES).forEach(([k, nom]) => zone.append(puce(nom, { choisie: f.regimes.includes(k), onclick: () => { changer((x) => { x.regimes = x.regimes.includes(k) ? x.regimes.filter((y) => y !== k) : [...x.regimes, k]; }); dessiner(); } })));
        };
        dessiner();
        return zone;
      } },
    { id: 'menu', icone: 'calendrier', titre: 'Menu', resume: () => (f.menu !== 'Tous' ? MENUS[f.menu] : null),
      contenu: () => {
        const zone = FlowChips();
        const dessiner = () => {
          vider(zone);
          Object.entries(MENUS).forEach(([k, nom]) => zone.append(puce(nom, { choisie: f.menu === k, onclick: () => { changer((x) => { x.menu = k; }); dessiner(); } })));
        };
        dessiner();
        return zone;
      } },
    { id: 'tri', icone: 'tri', titre: 'Tri', resume: () => TRIS[f.tri],
      contenu: () => {
        const zone = FlowChips();
        const dessiner = () => {
          vider(zone);
          Object.entries(TRIS).forEach(([k, nom]) => zone.append(puce(nom, { choisie: f.tri === k, onclick: () => { changer((x) => { x.tri = k; }); dessiner(); } })));
        };
        dessiner();
        return zone;
      } },
  ];

  function dessiner() {
    const haut = defile.scrollTop;
    vider(defile);
    resumes.length = 0;
    // Vues enregistrées
    const vues = h('div', { class: 'puces', style: { padding: '4px 0 8px', alignItems: 'center' } });
    const dessinerVues = () => {
      vider(vues);
      vues.append(h('button', { class: 'ic', 'aria-label': 'Enregistrer la vue', disabled: criteresActifs(f) === 0, onclick: () => demander('Nom', { onValider: (nom) => { reglages.vues = [...reglages.vues.filter((v) => v[0] !== nom), [nom, JSON.stringify(f)]]; dessinerVues(); } }) }, svg('signet')));
      reglages.vues.forEach(([nom, json]) => vues.append(
        h('span', { class: 'puce vue' },
          h('button', { onclick: () => { changer((x) => Object.assign(x, { ...filtreVide(), ...JSON.parse(json), texte: x.texte })); dessiner(); } }, nom),
          h('button', { class: 'x', 'aria-label': 'Supprimer la vue', onclick: () => { reglages.vues = reglages.vues.filter((v) => v[0] !== nom); dessinerVues(); } }, svg('fermer')),
        ),
      ));
    };
    dessinerVues();
    defile.append(vues);
    for (const s of sections) {
      const valeur = h('span', { class: 'valeur' });
      const contenu = h('div', { class: 'contenu' });
      const bloc = h('div', { class: 'section' });
      const maj = () => {
        const v = s.resume();
        valeur.textContent = v ?? '';
        bloc.classList.toggle('active', v != null);
      };
      resumes.push(maj);
      const ouvrir = () => {
        ouverte = ouverte === s.id ? null : s.id;
        dessiner();
      };
      bloc.append(h('button', { class: 'tete', onclick: ouvrir, 'aria-expanded': String(ouverte === s.id) },
        svg(s.icone), h('span', { class: 'titre' }, s.titre), valeur, (() => { const c = svg('bas'); c.classList.add('chevron'); return c; })()));
      if (ouverte === s.id) {
        bloc.classList.add('ouverte');
        contenu.append(s.contenu());
        bloc.append(contenu);
      }
      defile.append(bloc);
    }
    majResumes();
    defile.scrollTop = haut;
  }

  dessiner();
  return fermer;
}
