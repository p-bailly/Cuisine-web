// Les données de l'appli web : lues sur la branche « data » de GitHub (comme l'appli Android), gardées dans le
// navigateur pour l'affichage hors-ligne, écrites par l'API Contents (un commit par modification).
import { Depot, ErreurReseau } from './api.js';
import {
  recetteDepuisJson, recetteVersJson, nouvelId, planVersJson, boutiqueVersJson, boutiqueDepuisJson,
} from './coeur.js';

const lireLocal = (cle, defaut) => {
  try {
    const v = localStorage.getItem(cle);
    return v == null ? defaut : JSON.parse(v);
  } catch {
    return defaut;
  }
};
const ecrireLocal = (cle, valeur) => {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* navigateur plein ou privé : on s'en passe */
  }
};

export const reglages = {
  get jeton() { return lireLocal('cuisine.jeton', ''); },
  set jeton(v) { ecrireLocal('cuisine.jeton', (v ?? '').trim()); },
  get cleClaude() { return lireLocal('cuisine.claude', ''); },
  set cleClaude(v) { ecrireLocal('cuisine.claude', (v ?? '').trim()); },
  get vues() { return lireLocal('cuisine.vues', []); },
  set vues(v) { ecrireLocal('cuisine.vues', v); },
  get banque() { return lireLocal('cuisine.banque', {}); },
  set banque(v) { ecrireLocal('cuisine.banque', v); },
};

/** L'état de l'appli : recettes, planning, courses. `ecouter` est appelé à chaque changement. */
export class Donnees {
  constructor(fabriqueDepot = (jeton) => new Depot(jeton)) {
    this.fabriqueDepot = fabriqueDepot;
    this.recettes = [];
    this.plan = {};
    this.boutique = { manuels: [], coches: new Set() };
    this.shas = {}; // chemin → identifiant git connu
    this.cache = lireLocal('cuisine.cache', {}); // chemin → { sha, contenu }
    this.etat = 'repos'; // repos | charge | erreur
    this.erreur = '';
    this.ecouteurs = new Set();
    this.files = new Map(); // écritures en attente, par chemin
    this.appliquerCache();
  }

  ecouter(f) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }
  notifier() { this.ecouteurs.forEach((f) => f()); }
  get depot() { return this.fabriqueDepot(reglages.jeton); }

  appliquerCache() {
    const recettes = [];
    for (const [chemin, { sha, contenu }] of Object.entries(this.cache)) {
      this.shas[chemin] = sha;
      try {
        if (chemin === 'plan.json') this.plan = JSON.parse(contenu);
        else if (chemin === 'shop.json') this.boutique = { ...boutiqueDepuisJson(contenu), coches: new Set(boutiqueDepuisJson(contenu).coches) };
        else recettes.push(recetteDepuisJson(contenu));
      } catch { /* fichier abîmé : ignoré */ }
    }
    this.recettes = recettes.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  }

  enCache(chemin, sha, contenu) {
    this.cache[chemin] = { sha, contenu };
    this.shas[chemin] = sha;
    ecrireLocal('cuisine.cache', this.cache);
  }

  /** Lit la branche de données ; seuls les fichiers dont l'identifiant a changé sont téléchargés. */
  async actualiser() {
    this.etat = 'charge';
    this.erreur = '';
    this.notifier();
    try {
      const depot = this.depot;
      const arbre = await depot.arbre();
      if (arbre === null) {
        this.existe = false;
      } else {
        this.existe = true;
        const aLire = Object.entries(arbre).filter(([ch, sha]) => this.cache[ch]?.sha !== sha);
        const file = [...aLire];
        await Promise.all(Array.from({ length: 6 }, async () => {
          for (let e = file.shift(); e; e = file.shift()) this.enCache(e[0], e[1], await depot.lire(e[1]));
        }));
        for (const ch of Object.keys(this.cache)) if (!(ch in arbre)) delete this.cache[ch], delete this.shas[ch];
        ecrireLocal('cuisine.cache', this.cache);
        this.plan = {};
        this.boutique = { manuels: [], coches: new Set() };
        this.appliquerCache();
      }
      this.etat = 'repos';
    } catch (e) {
      this.etat = 'erreur';
      this.erreur = e instanceof ErreurReseau ? e.message : `Erreur : ${e.message}`;
    }
    this.notifier();
  }

  /** Écrit un fichier (crée la branche au tout premier envoi) ; plusieurs écritures du même fichier se suivent. */
  async ecrireFichier(chemin, contenu, message) {
    const precedente = this.files.get(chemin) ?? Promise.resolve();
    const suite = precedente.catch(() => {}).then(async () => {
      const depot = this.depot;
      if (this.existe === false) {
        await depot.creer({ [chemin]: contenu });
        this.existe = true;
        const arbre = await depot.arbre();
        this.enCache(chemin, arbre?.[chemin] ?? '', contenu);
        return;
      }
      let sha = this.shas[chemin] ?? null;
      try {
        sha = await depot.ecrire(chemin, contenu, sha, message);
      } catch (e) {
        if (e.code !== 409 && e.code !== 422) throw e;
        const arbre = await depot.arbre();
        sha = await depot.ecrire(chemin, contenu, arbre?.[chemin] ?? null, message);
      }
      this.enCache(chemin, sha, contenu);
    });
    this.files.set(chemin, suite);
    try {
      await suite;
    } catch (e) {
      this.erreur = e.message;
      this.etat = 'erreur';
      this.notifier();
      throw e;
    }
  }

  // --- Recettes ---

  async enregistrer(r) {
    const id = r.id || nouvelId(r.titre);
    const recette = { ...r, id };
    const avant = this.recettes.findIndex((x) => x.id === id);
    if (avant >= 0) this.recettes[avant] = recette;
    else this.recettes.push(recette);
    this.recettes.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    this.notifier();
    await this.ecrireFichier(`recipes/${id}.json`, recetteVersJson(recette), avant >= 0 ? `Modifier ${recette.titre}` : `Ajouter ${recette.titre}`);
    return id;
  }

  async supprimer(id) {
    const r = this.recettes.find((x) => x.id === id);
    this.recettes = this.recettes.filter((x) => x.id !== id);
    this.notifier();
    const chemin = `recipes/${id}.json`;
    const sha = this.shas[chemin];
    delete this.cache[chemin];
    delete this.shas[chemin];
    ecrireLocal('cuisine.cache', this.cache);
    if (sha) await this.depot.supprimer(chemin, sha, `Supprimer ${r?.titre ?? id}`);
  }

  // --- Planning et courses (écrits après un court délai : plusieurs gestes de suite font un seul commit) ---

  planifier(cle, idRecette) {
    if (idRecette) this.plan[cle] = idRecette;
    else delete this.plan[cle];
    this.notifier();
    this.differer('plan.json', () => planVersJson(this.plan), 'Planning');
  }

  modifierCourses(f) {
    this.boutique = f(this.boutique);
    this.notifier();
    this.differer('shop.json', () => boutiqueVersJson(this.boutique), 'Courses');
  }

  differer(chemin, contenu, message) {
    clearTimeout(this.minuteries?.[chemin]);
    this.minuteries ??= {};
    this.minuteries[chemin] = setTimeout(() => this.ecrireFichier(chemin, contenu(), message).catch(() => {}), 800);
  }
}
