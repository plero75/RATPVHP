Dashboard IDFM – Fullscreen (DEBUG)
==================================

Déploiement
-----------
1) Déposez ce dossier à la racine du dépôt `plero75/RATPVHP`.
2) GitHub → Settings → Pages → Source : `main` / `(root)`.
3) Ouvrez https://plero75.github.io/RATPVHP/

Notes
-----
- Toutes les requêtes PRIM passent par votre proxy Cloudflare (header `apikey` côté worker).
- Le Worker doit autoriser `Access-Control-Allow-Headers: apikey` (préflight CORS).
- Le script tente d'abord via le proxy, puis bascule en fallback direct (utile en test).
- Les logs sont regroupés et colorés dans la console (F12).
- La pastille en bas à droite indique l'état du proxy : 🟢 OK / 🔴 Erreur.
