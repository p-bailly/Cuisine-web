// La fiche d'une recette, son éditeur (la fiche qui s'édite sur place), l'historique des versions et l'aperçu d'Explorer.
import {
  texteIngredient, rayonIng, duree, recetteVide, recetteVersTexte, recetteDepuisTexte, recetteDepuisJson,
  parseIngredient, etiquettesIngredients, cleTag, diffLignes, minutesDe,
} from './coeur.js';
import { h, svg, bouton, vider, point, couleurRayon, confirmer, toast } from './ui.js';

const lier = (texte) => {
  const frag = document.createDocumentFragment();
  let reste = texte;
  for (let m; (m = /https?:\/\/[^\s)]+/.exec(reste)); ) {
    frag.append(reste.slice(0, m.index), h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
    reste = reste.slice(m.index + m[0].length);
  }
  frag.append(reste);
  return frag;
};

/** Le corps d'une fiche : titre, portions réglables, étiquettes, ingrédients colorés par rayon, étapes, notes. */
export function corpsFiche(r, { portionsChoisies = r.portions, onPortions } = {}) {
  const facteur = portionsChoisies / Math.max(r.portions, 1);
  const compteur = h('div', { class: 'compteur' },
    h('button', { 'aria-label': 'Moins', onclick: () => portionsChoisies > 1 && onPortions?.(portionsChoisies - 1) }, '−'),
    h('span', null, `${portionsChoisies} pers.`),
    h('button', { 'aria-label': 'Plus', onclick: () => onPortions?.(portionsChoisies + 1) }, '+'),
  );
  return h('div', { class: 'fiche' },
    h('h1', null, r.titre),
    h('div', { class: 'meta' }, onPortions ? compteur : h('span', null, `${r.portions} pers.`), r.minutes > 0 ? h('span', null, duree(r.minutes)) : null,
      r.tags.map((t) => h('span', { class: 'puce' }, t))),
    r.ingredients.length ? h('h2', null, 'Ingrédients') : null,
    r.ingredients.map((ing) => {
      const q = texteIngredient({ ...ing, nom: '' }, facteur).trim();
      return h('div', { class: 'ing' }, point(rayonIng(ing)), h('span', { class: 'q' }, q), h('span', { style: { color: couleurRayon(rayonIng(ing)), fontWeight: 600 } }, ing.nom));
    }),
    r.etapes.length ? h('h2', null, 'Étapes') : null,
    r.etapes.map((e, i) => h('div', { class: 'etape' }, h('i', null, String(i + 1)), h('span', null, e))),
    r.notes.trim() ? h('h2', null, 'Notes') : null,
    r.notes.trim() ? h('div', { class: 'notes' }, lier(r.notes)) : null,
  );
}

export function ecranFiche(app, id) {
  const d = app.donnees;
  let portions = null;
  const racine = h('div');
  function dessiner() {
    vider(racine);
    const r = d.recettes.find((x) => x.id === id);
    if (!r) {
      racine.append(h('div', { class: 'barre' }, bouton('retour', () => app.retour(), { titre: 'Retour' })), h('div', { class: 'vide' }, svg('livre')));
      return;
    }
    racine.append(
      h('div', { class: 'barre' },
        bouton('retour', () => app.retour(), { titre: 'Retour' }), h('span', { class: 'espace' }),
        bouton('copie', () => { app.brouillon = { ...r, id: '', titre: r.titre + ' (variante)' }; app.naviguer('editer/nouveau'); }, { titre: 'Variante' }),
        bouton('historique', () => app.naviguer('historique/' + id), { titre: 'Historique' }),
        bouton('crayon', () => app.naviguer('editer/' + id), { titre: 'Modifier', classe: 'plein' }),
      ),
      corpsFiche(r, { portionsChoisies: portions ?? r.portions, onPortions: (n) => { portions = n; dessiner(); } }),
    );
  }
  dessiner();
  return { el: racine, rafraichir: dessiner };
}

/** Une recette d'Explorer en aperçu : « + » l'ouvre dans l'éditeur, à relire avant de l'enregistrer. */
export function ecranApercu(app) {
  const r = app.apercu;
  const racine = h('div');
  if (!r) {
    racine.append(h('div', { class: 'barre' }, bouton('retour', () => app.retour('explorer'), { titre: 'Retour' })), h('div', { class: 'vide' }, svg('livre')));
    return { el: racine };
  }
  let portions = r.portions;
  const dessiner = () => {
    vider(racine);
    racine.append(
      h('div', { class: 'barre' },
        bouton('retour', () => app.retour('explorer'), { titre: 'Retour' }), h('span', { class: 'espace' }),
        bouton('plus', () => { app.brouillon = r; app.naviguer('editer/nouveau'); }, { titre: 'Ajouter à mes recettes', classe: 'plein' }),
      ),
      corpsFiche(r, { portionsChoisies: portions, onPortions: (n) => { portions = n; dessiner(); } }),
    );
  };
  dessiner();
  return { el: racine };
}

// --- L'éditeur : la fiche qui s'édite sur place ---

const UNITES = ['g', 'kg', 'cl', 'l', 'c. à s.', 'c. à c.', '½', '¼'];

function texteDepuisEtat(e) {
  return `# ${e.titre.trim()}\nportions: ${e.portions}\nminutes: ${e.minutes}\ntags: ${e.tags.join(', ')}\n\n## ingredients\n` +
    e.ings.map((l) => `- ${l}\n`).join('') + '\n## etapes\n' + e.etapes.map((l) => `- ${l.replace(/\n/g, ' ')}\n`).join('') + `\n## notes\n${e.notes}\n`;
}

function etatDepuisRecette(r) {
  return {
    titre: r.titre, portions: String(r.portions), minutes: r.minutes > 0 ? String(r.minutes) : '', tags: [...r.tags],
    ings: r.ingredients.length ? r.ingredients.map((i) => texteIngredient(i)) : [''], etapes: r.etapes.length ? [...r.etapes] : [''], notes: r.notes,
  };
}

const grandir = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

export function ecranEditeur(app, arg) {
  const d = app.donnees;
  const existante = arg && arg !== 'nouveau' ? d.recettes.find((r) => r.id === arg) : null;
  const base = existante ?? app.brouillon ?? recetteVide();
  const nouvelle = !existante && !app.brouillon;
  app.brouillon = null;
  const e = etatDepuisRecette(base);
  const catalogue = etiquettesIngredients(d.recettes);
  let brut = false;
  let focusIng = -1;

  const racine = h('div');
  const corps = h('div');
  const enregistrer = h('button', { class: 'ic plein', 'aria-label': 'Enregistrer', onclick: sauver }, svg('coche'));
  const barreTouches = h('div', { class: 'touches' });

  const recette = () => recetteDepuisTexte(texteDepuisEtat(e), base);
  const majSauver = () => { enregistrer.disabled = !e.titre.trim(); };

  async function sauver() {
    const r = brut ? recetteDepuisTexte(textarea.value, base) : recette();
    if (!r.titre.trim()) return;
    enregistrer.disabled = true;
    try {
      const id = await d.enregistrer(r);
      location.replace('#/recette/' + id);
    } catch (err) {
      toast(err.message);
      enregistrer.disabled = false;
    }
  }

  const textarea = h('textarea', { class: 'brut', spellcheck: 'false' });
  textarea.addEventListener('input', () => { enregistrer.disabled = !recetteDepuisTexte(textarea.value, base).titre.trim(); });

  function basculer() {
    if (!brut) {
      textarea.value = texteDepuisEtat(e);
    } else {
      Object.assign(e, etatDepuisRecette(recetteDepuisTexte(textarea.value, base)));
    }
    brut = !brut;
    dessiner();
  }

  racine.append(
    h('div', { class: 'barre' },
      bouton('fermer', () => app.retour(existante ? 'recette/' + existante.id : 'recettes'), { titre: 'Fermer' }), h('span', { class: 'espace' }),
      bouton('code', basculer, { titre: 'Texte brut' }),
      existante ? bouton('corbeille', () => confirmer(`Supprimer « ${existante.titre} » ?`, { onOui: async () => { try { await d.supprimer(existante.id); location.replace('#/recettes'); } catch (err) { toast(err.message); } } }), { titre: 'Supprimer' }) : null,
      enregistrer,
    ),
    corps,
  );

  function nb(valeur, suffixe, surChangement) {
    const input = h('input', { type: 'text', inputMode: 'numeric', value: valeur, 'aria-label': suffixe });
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); surChangement(input.value); });
    return h('label', { class: 'nb' }, input, suffixe);
  }

  /** Les unités ou les noms proches, sous la ligne d'ingrédient qui a le focus. */
  function majTouches(input, i) {
    vider(barreTouches);
    const texte = input.value;
    const nom = parseIngredient(texte).nom;
    const q = cleTag(nom);
    const propositions = nom.length >= 2 ? catalogue.filter((c) => cleTag(c.nom).includes(q) && cleTag(c.nom) !== q).slice(0, 6) : [];
    const garder = (ev) => ev.preventDefault();
    if (propositions.length) {
      const pos = texte.lastIndexOf(nom);
      propositions.forEach((c) => barreTouches.append(h('button', { class: 'accent', onmousedown: garder, onclick: () => { input.value = texte.slice(0, pos) + c.nom.toLowerCase(); e.ings[i] = input.value; majTouches(input, i); input.focus(); } }, c.nom.toLowerCase())));
    } else {
      UNITES.forEach((u) => barreTouches.append(h('button', { onmousedown: garder, onclick: () => {
        const a = input.selectionStart ?? input.value.length;
        const b = input.selectionEnd ?? a;
        const avant = input.value.slice(0, a);
        const ins = (avant.endsWith(' ') || !avant ? '' : ' ') + u + ' ';
        input.value = avant + ins + input.value.slice(b);
        input.setSelectionRange(a + ins.length, a + ins.length);
        e.ings[i] = input.value;
        majTouches(input, i);
        input.focus();
      } }, u)));
    }
  }

  function dessiner() {
    vider(corps);
    majSauver();
    if (brut) {
      corps.append(textarea);
      enregistrer.disabled = !recetteDepuisTexte(textarea.value, base).titre.trim();
      return;
    }
    const titre = h('input', { class: 'titre-champ', type: 'text', value: e.titre, autocomplete: 'off', 'aria-label': 'Titre', placeholder: '…' });
    titre.addEventListener('input', () => { e.titre = titre.value; majSauver(); });

    const tags = h('div', { class: 'rang' });
    const dessinerTags = () => {
      vider(tags);
      e.tags.forEach((t) => tags.append(h('button', { class: 'puce', onclick: () => { e.tags = e.tags.filter((x) => x !== t); dessinerTags(); } }, t, h('span', { class: 'x' }, svg('fermer')))));
      const champ = h('input', { class: 'tag-champ', type: 'text', placeholder: '+', 'aria-label': 'Nouvelle étiquette' });
      const ajouter = () => { const t = champ.value.replace(/[,\n]/g, '').trim(); if (t && !e.tags.includes(t)) { e.tags.push(t); dessinerTags(); tags.querySelector('input')?.focus(); } };
      champ.addEventListener('input', () => champ.value.endsWith(',') && ajouter());
      champ.addEventListener('keydown', (ev) => ev.key === 'Enter' && (ev.preventDefault(), ajouter()));
      champ.addEventListener('blur', () => champ.value.trim() && ajouter());
      tags.append(champ);
    };
    dessinerTags();

    const ings = h('div');
    const etapes = h('div');
    const dessinerIngs = (focus = -1) => {
      vider(ings);
      e.ings.forEach((l, i) => {
        const rayon = rayonIng(parseIngredient(l));
        const input = h('input', { type: 'text', value: l, autocomplete: 'off', 'aria-label': `Ingrédient ${i + 1}` });
        const rang = h('div', { class: 'lg-ing' }, h('span', { class: 'point', style: { background: couleurRayon(rayon) } }), input);
        input.addEventListener('input', () => { e.ings[i] = input.value; rang.firstChild.style.background = couleurRayon(rayonIng(parseIngredient(input.value))); majTouches(input, i); });
        input.addEventListener('focus', () => { focusIng = i; rang.after(barreTouches); majTouches(input, i); });
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); e.ings.splice(i + 1, 0, ''); dessinerIngs(i + 1); }
          else if (ev.key === 'Backspace' && input.value === '' && e.ings.length > 1) { ev.preventDefault(); e.ings.splice(i, 1); dessinerIngs(Math.max(i - 1, 0), true); }
        });
        ings.append(rang);
        if (i === focus) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
    };
    const dessinerEtapes = (focus = -1) => {
      vider(etapes);
      e.etapes.forEach((l, i) => {
        const ta = h('textarea', { rows: 1, 'aria-label': `Étape ${i + 1}` });
        ta.value = l;
        ta.addEventListener('input', () => { e.etapes[i] = ta.value.replace(/\n/g, ' '); grandir(ta); });
        ta.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); e.etapes.splice(i + 1, 0, ''); dessinerEtapes(i + 1); }
          else if (ev.key === 'Backspace' && ta.value === '' && e.etapes.length > 1) { ev.preventDefault(); e.etapes.splice(i, 1); dessinerEtapes(Math.max(i - 1, 0)); }
        });
        etapes.append(h('div', { class: 'lg-etape' }, h('i', null, String(i + 1)), ta));
        setTimeout(() => grandir(ta), 0);
        if (i === focus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      });
    };
    dessinerIngs();
    dessinerEtapes();

    const notes = h('textarea', { class: 'notes-champ', 'aria-label': 'Notes' });
    notes.value = e.notes;
    notes.addEventListener('input', () => { e.notes = notes.value; grandir(notes); });
    setTimeout(() => grandir(notes), 0);

    corps.append(h('div', { class: 'edition' },
      titre,
      h('div', { class: 'rang' }, nb(e.portions, 'pers.', (v) => { e.portions = v; }), nb(e.minutes, 'min', (v) => { e.minutes = v; })),
      tags,
      h('h2', null, 'Ingrédients'), ings,
      h('button', { class: 'ajout', 'aria-label': 'Ajouter un ingrédient', onclick: () => { e.ings.push(''); dessinerIngs(e.ings.length - 1); } }, svg('plus')),
      h('h2', null, 'Étapes'), etapes,
      h('button', { class: 'ajout', 'aria-label': 'Ajouter une étape', onclick: () => { e.etapes.push(''); dessinerEtapes(e.etapes.length - 1); } }, svg('plus')),
      h('h2', null, 'Notes'), notes,
    ));
    if (nouvelle && !e.titre) setTimeout(() => titre.focus(), 0);
  }
  dessiner();
  return { el: racine };
}

// --- L'historique : avant / après ---

export function ecranHistorique(app, id) {
  const d = app.donnees;
  const racine = h('div');
  const chemin = `recipes/${id}.json`;
  let versions = null;
  let erreur = '';
  let avant = 1;
  let apres = 0;
  const contenus = new Map();

  const date = (v) => new Date(v.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function contenu(sha) {
    if (!contenus.has(sha)) contenus.set(sha, await d.depot.contenuA(chemin, sha));
    return contenus.get(sha);
  }

  const versTexte = (json) => (json == null ? '' : recetteVersTexte(recetteDepuisJson(json), undefined, false));

  async function dessiner() {
    vider(racine);
    racine.append(h('div', { class: 'barre' }, bouton('retour', () => app.retour('recette/' + id), { titre: 'Retour' })));
    if (erreur) return void racine.append(h('div', { class: 'erreur' }, erreur));
    if (!versions) return void racine.append(h('div', { class: 'vide' }, svg('historique')));
    if (versions.length < 2) return void racine.append(h('div', { class: 'vide' }, svg('historique')));
    const rang = (titre, courant, choisir) => h('div', null,
      h('div', { class: 'etiquette-rayon', style: { color: 'var(--discret)' } }, titre),
      h('div', { class: 'puces' }, versions.map((v, i) => h('button', { class: `puce${i === courant ? ' choisie' : ''}`, title: v.message, onclick: () => { choisir(i); dessiner(); } }, date(v)))));
    racine.append(rang('Avant', avant, (i) => { avant = i; }), rang('Après', apres, (i) => { apres = i; }));
    const zone = h('div', { class: 'deux' });
    racine.append(zone);
    let a;
    let b;
    try {
      [a, b] = await Promise.all([contenu(versions[avant].sha), contenu(versions[apres].sha)]);
    } catch (err) {
      return void racine.append(h('div', { class: 'erreur' }, err.message));
    }
    const lignes = diffLignes(versTexte(a), versTexte(b));
    const col = (titre, garde) => h('div', null, h('h3', null, titre),
      lignes.filter((l) => l.marque === 'commun' || l.marque === garde).map((l) => h('div', { class: `df ${l.marque}-l` }, l.texte || ' ')));
    zone.append(col('Avant', 'retrait'), col('Après', 'ajout'));
    racine.append(h('div', { class: 'pied', style: { display: 'flex', gap: '10px', padding: '12px 16px' } },
      h('button', { class: 'bouton large', 'aria-label': 'Restaurer cette version', onclick: async () => {
        try {
          await d.enregistrer({ ...recetteDepuisJson(a), id });
          toast('Version restaurée');
          location.replace('#/recette/' + id);
        } catch (err) { toast(err.message); }
      } }, svg('annuler'))));
  }

  d.depot.versions(chemin).then((v) => { versions = v; dessiner(); }).catch((err) => { erreur = err.message; dessiner(); });
  dessiner();
  return { el: racine };
}
