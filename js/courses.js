// La liste de courses : les repas prévus à partir d'aujourd'hui, rangés par rayon, plus ce qu'on ajoute à la main.
import { planAPartirDe, agregerCourses, coursesManuelles, trierCourses } from './coeur.js';
import { RAYON_NOMS } from './donnees.js';
import { h, svg, bouton, vider, aujourdhui } from './ui.js';

export function ecranCourses(app) {
  const d = app.donnees;
  const racine = h('div');
  let saisie = '';
  function lignes() {
    const fois = planAPartirDe(d.plan, aujourdhui());
    const prevues = d.recettes.filter((r) => r.id in fois).map((r) => [r, fois[r.id]]);
    return trierCourses([...agregerCourses(prevues), ...coursesManuelles(d.boutique.manuels)]);
  }
  function ajouter(champ) {
    const t = champ.value.trim();
    if (!t) return;
    d.modifierCourses((s) => (s.manuels.some((m) => m.toLowerCase() === t.toLowerCase()) ? s : { ...s, manuels: [...s.manuels, t] }));
    saisie = '';
  }
  function dessiner() {
    const garde = racine.querySelector('input');
    const avait = garde && document.activeElement === garde;
    vider(racine);
    const champ = h('input', { type: 'text', placeholder: 'Ajouter', value: saisie, autocomplete: 'off', enterKeyHint: 'done' });
    champ.addEventListener('input', () => { saisie = champ.value; });
    champ.addEventListener('keydown', (e) => e.key === 'Enter' && ajouter(champ));
    racine.append(
      h('div', { class: 'entete' }, h('h1', null, 'Courses'), d.boutique.coches.size ? bouton('actualiser', () => d.modifierCourses((s) => ({ ...s, coches: new Set() })), { titre: 'Tout décocher' }) : null),
      h('div', { class: 'rangee' }, h('label', { class: 'champ' }, champ, h('button', { class: 'ic', 'aria-label': 'Ajouter', onclick: () => ajouter(champ) }, svg('plus')))),
    );
    const l = lignes();
    if (!l.length) racine.append(h('div', { class: 'vide' }, svg('panier')));
    let rayon = null;
    for (const x of l) {
      if (x.rayon !== rayon) {
        rayon = x.rayon;
        racine.append(h('div', { class: 'etiquette-rayon', style: { color: `var(--r-${rayon})` } }, h('span', { class: 'point', style: { background: `var(--r-${rayon})` } }), RAYON_NOMS[rayon]));
      }
      const cochee = d.boutique.coches.has(x.cle);
      racine.append(
        h('div', { class: `article${cochee ? ' fait' : ''}`, role: 'checkbox', 'aria-checked': String(cochee), tabindex: 0,
          onclick: () => d.modifierCourses((s) => { const c = new Set(s.coches); c.has(x.cle) ? c.delete(x.cle) : c.add(x.cle); return { ...s, coches: c }; }),
          onkeydown: (e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), e.currentTarget.click()) },
          h('span', { class: `case${cochee ? ' cochee' : ''}` }, cochee ? svg('coche') : null),
          h('span', { class: 'texte' }, x.texte),
          x.manuel ? h('button', { class: 'ic', style: { width: '32px', height: '32px' }, 'aria-label': 'Retirer', onclick: (e) => { e.stopPropagation(); d.modifierCourses((s) => ({ manuels: s.manuels.filter((m) => m !== x.nom), coches: new Set([...s.coches].filter((c) => c !== x.cle)) })); } }, svg('fermer')) : null),
      );
    }
    if (avait) racine.querySelector('input').focus();
  }
  dessiner();
  return { el: racine, rafraichir: dessiner };
}
