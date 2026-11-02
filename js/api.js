// Les accès réseau : GitHub (les données), Wikibooks (Explorer), Open Food Facts (nutrition), Claude (idées).
import { titresLivre, recetteDepuisWikitexte, nomPageLivre, valeursOff, recetteDepuisTexte } from './coeur.js';

export class ErreurReseau extends Error {}

const octets = (s) => new TextEncoder().encode(s);
export function versBase64(texte) {
  let bin = '';
  const o = octets(texte);
  for (let i = 0; i < o.length; i += 0x8000) bin += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const depuisBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

const estDonnee = (chemin) => (chemin.startsWith('recipes/') && chemin.endsWith('.json')) || chemin === 'plan.json' || chemin === 'shop.json';

/** La branche « data » du dépôt Cuisine par l'API GitHub (jeton fine-grained : Contents, lecture et écriture). */
export class Depot {
  constructor(jeton, depot = 'p-bailly/Cuisine', branche = 'data', hote = 'https://api.github.com') {
    Object.assign(this, { jeton, depot, branche, hote });
  }

  async appeler(methode, chemin, corps) {
    if (!this.jeton) throw new ErreurReseau('Pas de jeton GitHub : à saisir dans les réglages');
    let r;
    try {
      r = await fetch(`${this.hote}/repos/${this.depot}${chemin}`, {
        method: methode,
        headers: {
          Authorization: `Bearer ${this.jeton}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(corps ? { 'Content-Type': 'application/json' } : {}),
        },
        body: corps ? JSON.stringify(corps) : undefined,
      });
    } catch {
      throw new ErreurReseau('Pas de connexion à GitHub');
    }
    const texte = await r.text();
    return { code: r.status, corps: texte ? JSON.parse(texte) : null };
  }

  verifier(r) {
    if (r.code >= 200 && r.code < 300) return r;
    const e = new ErreurReseau(
      {
        401: 'Jeton GitHub refusé (expiré ?)',
        403: `Accès refusé : le jeton doit avoir « Contents : Read and write » sur ${this.depot}`,
        404: `Dépôt ${this.depot} introuvable : le jeton doit le voir`,
        409: 'Conflit avec une modification récente : actualiser puis recommencer',
        422: 'Conflit avec une modification récente : actualiser puis recommencer',
      }[r.code] ?? `GitHub a répondu ${r.code}`,
    );
    e.code = r.code;
    throw e;
  }

  /** Les fichiers de données : chemin → identifiant git ; null si la branche n'existe pas encore. */
  async arbre() {
    const r = await this.appeler('GET', `/git/trees/${this.branche}?recursive=1`);
    if (r.code === 404) {
      this.verifier(await this.appeler('GET', ''));
      return null;
    }
    this.verifier(r);
    return Object.fromEntries(r.corps.tree.filter((e) => e.type === 'blob' && estDonnee(e.path)).map((e) => [e.path, e.sha]));
  }

  async lire(sha) {
    return depuisBase64(this.verifier(await this.appeler('GET', `/git/blobs/${sha}`)).corps.content);
  }

  /** Crée la branche avec ces fichiers (chemin → contenu), comme l'appli Android. */
  async creer(fichiers) {
    const tree = Object.entries({ ...fichiers, 'README.md': '# Données de Cuisine\n\nRecettes, plan et courses, écrits par l\'appli.\n' })
      .map(([path, content]) => ({ path, mode: '100644', type: 'blob', content }));
    const arbre = this.verifier(await this.appeler('POST', '/git/trees', { tree })).corps.sha;
    const commit = this.verifier(await this.appeler('POST', '/git/commits', { message: 'Premier envoi', tree: arbre, parents: [] })).corps.sha;
    this.verifier(await this.appeler('POST', '/git/refs', { ref: `refs/heads/${this.branche}`, sha: commit }));
  }

  /** Écrit un fichier (un commit) ; `sha` est null pour un nouveau fichier. Renvoie le nouvel identifiant. */
  async ecrire(chemin, contenu, sha, message) {
    const corps = { message, content: versBase64(contenu), branch: this.branche, ...(sha ? { sha } : {}) };
    return this.verifier(await this.appeler('PUT', `/contents/${chemin}`, corps)).corps.content.sha;
  }

  async supprimer(chemin, sha, message) {
    this.verifier(await this.appeler('DELETE', `/contents/${chemin}`, { message, sha, branch: this.branche }));
  }

  /** Les modifications d'un fichier, de la plus récente à la plus ancienne : { sha, message, date }. */
  async versions(chemin) {
    const r = this.verifier(await this.appeler('GET', `/commits?sha=${this.branche}&path=${encodeURIComponent(chemin)}&per_page=30`));
    return r.corps.map((o) => ({ sha: o.sha, message: o.commit.message.split('\n')[0], date: o.commit.committer.date }));
  }

  /** Le fichier tel qu'il était à ce commit, ou null s'il n'existait pas encore. */
  async contenuA(chemin, sha) {
    const r = await this.appeler('GET', `/contents/${chemin}?ref=${sha}`);
    if (r.code === 404) return null;
    return depuisBase64(this.verifier(r).corps.content);
  }
}

// --- Wikibooks ---

const WIKI = 'https://fr.wikibooks.org/w/api.php?format=json&formatversion=2&origin=*&';

async function json(url, entetes) {
  let r;
  try {
    r = await fetch(url, entetes ? { headers: entetes } : undefined);
  } catch {
    throw new ErreurReseau('Pas de connexion');
  }
  if (!r.ok) throw new ErreurReseau(`${new URL(url).hostname} a répondu ${r.status}`);
  return r.json();
}

/** Toutes les recettes d'une catégorie du Livre de cuisine (titres de pages), en suivant les pages de l'API. */
export async function livreParCategorie(categorie) {
  const base = WIKI + 'action=query&list=categorymembers&cmnamespace=0&cmlimit=500&cmtitle=' + encodeURIComponent('Catégorie:' + categorie);
  const tous = [];
  let suite = null;
  for (let i = 0; i < 4; i++) {
    const o = await json(suite ? base + '&cmcontinue=' + encodeURIComponent(suite) : base);
    tous.push(...titresLivre(o));
    suite = o.continue?.cmcontinue;
    if (!suite) break;
  }
  return [...new Set(tous)].map((t) => ({ page: t, titre: nomPageLivre(t) }));
}

export async function livreChercher(requete) {
  const o = await json(WIKI + 'action=query&list=search&srnamespace=0&srlimit=50&srsearch=' + encodeURIComponent(requete));
  return titresLivre(o).map((t) => ({ page: t, titre: nomPageLivre(t) }));
}

/** La recette entière d'une page du Livre de cuisine. */
export async function livreRecette(page) {
  async function lire(titre) {
    const o = await json(WIKI + 'action=query&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(titre));
    return o.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? '';
  }
  let texte = await lire(page);
  const redir = /^\s*#(?:REDIRECT|REDIRECTION)\s*\[\[([^\]|#]+)/i.exec(texte);
  if (redir) texte = await lire(redir[1].trim());
  const r = recetteDepuisWikitexte(page, texte);
  if (!r.ingredients.length && !r.etapes.length) throw new ErreurReseau('Page sans recette lisible');
  return r;
}

// --- Open Food Facts ---

/** Les valeurs pour 100 g d'une catégorie Open Food Facts ; null s'il n'y a pas assez de produits français. */
export async function valeursCategorie(categorie) {
  const o = await json(`https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${categorie}&countries_tags_en=france&page_size=24&fields=nutriments`);
  return valeursOff(o);
}

// --- Claude (idées de recettes, clé facultative) ---

const INVITE = (demande) => `Tu es un cuisinier. Propose 3 recettes en français pour cette demande : « ${demande} ».
Réponds uniquement avec les recettes, sans introduction ni conclusion, chacune dans ce format exact, séparées
par une ligne contenant seulement ===

# Titre de la recette
portions: 4
minutes: 30
tags: tag1, tag2

## ingredients
- 200 g farine
- 3 oeufs
- sel

## etapes
1. Première étape.
2. Deuxième étape.

## notes
Une astuce.`;

export async function idees(cle, demande) {
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 4096, messages: [{ role: 'user', content: INVITE(demande) }] }),
    });
  } catch {
    throw new ErreurReseau('Pas de connexion');
  }
  if (!r.ok) throw new ErreurReseau(r.status === 401 ? 'Clé API Claude refusée' : r.status === 429 ? 'Limite de requêtes Claude atteinte, réessayer plus tard' : `Claude a répondu ${r.status}`);
  const o = await r.json();
  const texte = o.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  return texte.split(/^===\s*$/m).map((t) => recetteDepuisTexte(t.trim())).filter((x) => x.titre && x.ingredients.length);
}
