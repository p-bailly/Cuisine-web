// Petits outils d'interface : création d'éléments, icônes, fenêtres, messages.

export function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (['value', 'checked', 'disabled', 'type', 'placeholder', 'min', 'max', 'step', 'rows', 'title', 'id', 'autocomplete', 'inputMode', 'enterKeyHint'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...enfants.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}

const ICONES = {
  retour: '<path d="M15 5l-7 7 7 7"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  recherche: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  actualiser: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  etiquette: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.2"/>',
  feuille: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-4 6-7 10-9"/>',
  tri: '<path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"/>',
  calendrier: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
  personne: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  liste: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  corbeille: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  copie: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 011-1h9"/>',
  historique: '<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4M12 8v4l3 2"/>',
  annuler: '<path d="M9 7L4.5 11.5 9 16M5 11.5h8.5a5 5 0 010 10H11"/>',
  stats: '<path d="M5 19V10M12 19V5M19 19v-6"/>',
  signet: '<path d="M7 4h10v16l-5-3-5 3z"/>',
  bas: '<path d="M6 9l6 6 6-6"/>',
  panier: '<path d="M3 4h2.5l2 11h10l2-8H7M10 20h.01M17 20h.01"/>',
  boussole: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  livre: '<path d="M5 5h10a4 4 0 014 4v10H9a4 4 0 01-4-4zM5 15h14"/>',
  echange: '<path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>',
  crayon: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  etoile: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"/>',
};

export function svg(nom) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONES[nom] ?? '';
  return s;
}

/** Un bouton rond avec une icône. `titre` n'est que pour les lecteurs d'écran, il ne s'affiche pas. */
export function bouton(nom, onclick, { classe = '', titre = '', pastille = 0, desactive = false } = {}) {
  const b = h('button', { class: `ic ${classe}`, onclick, 'aria-label': titre || nom, disabled: desactive }, svg(nom));
  if (pastille) b.append(h('span', { class: 'pastille' }, String(pastille)));
  return b;
}

export const vider = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/** Un message bref en bas de l'écran. */
export function toast(texte) {
  const t = h('div', { class: 'toast' }, texte);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}

/** Ouvre un voile avec `contenu` ; renvoie une fonction qui le ferme. Un clic à côté ou Échap le ferme aussi. */
export function ouvrirVoile(contenu, { centre = false, surFermer } = {}) {
  const voile = h('div', { class: `voile${centre ? ' centre' : ''}` }, contenu);
  const fermer = () => {
    voile.remove();
    document.removeEventListener('keydown', echap);
    surFermer?.();
  };
  const echap = (e) => e.key === 'Escape' && fermer();
  voile.addEventListener('mousedown', (e) => e.target === voile && fermer());
  document.addEventListener('keydown', echap);
  document.getElementById('calques').append(voile);
  return fermer;
}

/** Une confirmation dans une petite fenêtre ; `onOui` est appelé si on valide. */
export function confirmer(titre, { onOui, danger = true }) {
  const fermer = ouvrirVoile(
    h('div', { class: 'dialogue', role: 'dialog' },
      h('h2', null, titre),
      h('div', { class: 'actions' },
        h('button', { class: 'ic', onclick: () => fermer(), 'aria-label': 'Annuler' }, svg('fermer')),
        h('button', { class: `bouton${danger ? ' danger' : ''}`, onclick: () => { fermer(); onOui(); }, 'aria-label': 'Valider' }, svg(danger ? 'corbeille' : 'coche')),
      ),
    ),
    { centre: true },
  );
}

/** Une petite fenêtre avec un champ de texte ; `onValider(texte)`. */
export function demander(titre, { valeur = '', onValider }) {
  const champ = h('input', { type: 'text', value: valeur, autocomplete: 'off' });
  const valider = () => {
    if (!champ.value.trim()) return;
    fermer();
    onValider(champ.value.trim());
  };
  champ.addEventListener('keydown', (e) => e.key === 'Enter' && valider());
  const fermer = ouvrirVoile(
    h('div', { class: 'dialogue', role: 'dialog' },
      h('h2', null, titre), champ,
      h('div', { class: 'actions' },
        h('button', { class: 'ic', onclick: () => fermer(), 'aria-label': 'Annuler' }, svg('fermer')),
        h('button', { class: 'bouton', onclick: valider, 'aria-label': 'Valider' }, svg('coche')),
      ),
    ),
    { centre: true },
  );
  setTimeout(() => champ.focus(), 0);
}

export const couleurRayon = (r) => `var(--r-${r})`;
export const point = (rayon) => h('span', { class: 'point', style: { background: couleurRayon(rayon) } });

/** Un champ de recherche arrondi avec une loupe ; renvoie { racine, input }. */
export function champRecherche(placeholder, valeur, surChangement, surEntree) {
  const input = h('input', { type: 'text', placeholder, value: valeur, autocomplete: 'off', enterKeyHint: 'search' });
  input.addEventListener('input', () => surChangement?.(input.value));
  input.addEventListener('keydown', (e) => e.key === 'Enter' && surEntree?.(input.value));
  return { racine: h('label', { class: 'champ' }, svg('recherche'), input), input };
}

/** Une puce de filtre : `etat` 'Avec' / 'Sans' (vert / rouge barré), ou `choisie` (orange). */
export function puce(texte, { compte = null, choisie = false, etat = null, onclick } = {}) {
  const classe = ['puce', choisie && 'choisie', etat === 'Avec' && 'avec', etat === 'Sans' && 'sans'].filter(Boolean).join(' ');
  return h('button', { class: classe, onclick }, texte, compte != null ? h('small', null, String(compte)) : null);
}

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
