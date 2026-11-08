# Cuisine (ancienne version web)

Ce dépôt n'est plus utilisé : la version web de Cuisine est hébergée par Cloudflare depuis le dossier `docs/` du dépôt
Cuisine, sur https://cuisine.pbailly.fr/.

L'ancienne copie du site a été retirée le 2026-11-08 : elle datait du 2026-11-02 et ne connaissait pas une partie des
données (placard, rayons, achats et origines des courses, photos des recettes) ; une modification faite depuis elle les
aurait effacées. Il ne reste qu'une page qui renvoie vers le vrai site et un service worker qui efface l'ancien cache.

Si `cuisine.pbailly.fr` pointe encore vers GitHub Pages (zone DNS chez OVHcloud), cette page renvoie vers l'adresse de
Cloudflare, https://cuisine.plbailly25.workers.dev/ (jeton à ressaisir une fois dans ⚙ : chaque adresse a sa mémoire).

Le fichier `CNAME` est gardé exprès : tant que GitHub Pages est actif, il évite qu'un autre dépôt puisse revendiquer
`cuisine.pbailly.fr` si le DNS pointait encore vers GitHub. Une fois le DNS vérifié (il doit pointer vers Cloudflare),
désactiver Pages (Settings › Pages) et archiver le dépôt.
