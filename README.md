# Solde d'heures — application agents

Application web statique permettant à chaque agent de consulter son solde
d'heures du mois en cours et des mois précédents, directement depuis le
fichier Excel administratif.

Aucun serveur, aucune base de données : tout tourne dans le navigateur.
Hébergée gratuitement sur **GitHub Pages**.

---

## ⚠️ À lire avant de déployer

Le dépôt sera **public** (choix confirmé pour utiliser GitHub Pages gratuit).
Sur un dépôt public :

- **`data/HeureAdmin.xlsx` est lisible par n'importe qui**, y compris les soldes
  de tous les agents, en téléchargeant simplement l'URL brute du fichier.
- Le code personnel (« PIN ») demandé sur l'écran de connexion est vérifié
  **côté navigateur** : il empêche une personne de cliquer sur un nom au hasard
  et de voir un autre solde par erreur, mais **il n'empêche pas quelqu'un de
  déterminé** (qui sait lire du code source) d'accéder aux données. Ce n'est
  pas une vraie authentification.

C'est un niveau de protection raisonnable pour éviter les erreurs et la
consultation *involontaire* du solde d'un collègue, mais **ce n'est pas
confidentiel au sens strict**. Si les soldes d'heures doivent rester
réellement privés vis-à-vis de l'extérieur, il faudra :

- soit un dépôt **privé** + GitHub Pages via un plan payant (GitHub Pro/Team/Enterprise),
  ou un autre hébergeur supportant un contrôle d'accès réel,
- soit une vraie authentification côté serveur (hors périmètre de cette version statique).

Si cette version convient (usage interne, confiance entre collègues), vous pouvez
déployer tel quel.

---

## Structure du dépôt

```
index.html                 Écran de connexion + tableau de bord
style.css                  Habillage visuel
app.js                     Lecture du fichier Excel, logique de connexion, affichage
admin-pin-generator.html   Outil pour générer les codes personnels (usage admin uniquement)
data/
  HeureAdmin.xlsx          Fichier de données — à remplacer chaque mois
  agents.json              Liste des agents + code personnel (haché)
```

## Déploiement sur GitHub Pages

1. Créez un nouveau dépôt GitHub (ou utilisez un dépôt existant) et poussez-y
   tout le contenu de ce dossier.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source**,
   choisissez **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute environ, GitHub affiche l'URL publique
   (`https://<votre-utilisateur>.github.io/<nom-du-depot>/`).

## Mise à jour mensuelle des données

Chaque mois, une fois le fichier `HeureAdmin.xlsx` à jour :

1. Remplacez `data/HeureAdmin.xlsx` par la nouvelle version (même nom de fichier).
2. Commitez et poussez (`git add`, `git commit`, `git push`) — ou faites-le
   directement depuis l'interface GitHub (« Upload files » sur le dossier `data`).
3. GitHub Pages republie automatiquement en 1 à 2 minutes. Aucune autre
   manipulation n'est nécessaire : l'application relit le fichier à chaque
   visite.

**Format attendu**, identique au fichier actuel :
- Une feuille par année (ex. `2026`, puis `2027` l'an prochain — l'application
  détecte automatiquement toutes les feuilles et propose un sélecteur d'année
  s'il y en a plusieurs).
- Colonne A : nom de l'agent, exactement comme dans `data/agents.json`.
- Colonne B : solde reporté initial.
- Colonnes suivantes : une par mois (Janvier à Décembre), au format durée
  Excel (`[h]:mm`). Les mois non encore atteints peuvent rester vides.

## Gérer la liste des agents et leurs codes personnels

`data/agents.json` associe chaque nom au **hachage SHA-256** de son code
personnel (jamais le code en clair) :

```json
{
  "Beckers Michel": "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0"
}
```

Pour changer ou ajouter un code :

1. Ouvrez `admin-pin-generator.html` dans un navigateur (en local, ou en le
   visitant sur votre site publié).
2. Entrez le nom exact de l'agent et le nouveau code, cliquez sur
   « Ajouter à la liste ».
3. Copiez le JSON généré dans `data/agents.json`, commitez et poussez.

**Tous les agents ont par défaut le code `0000`.** Changez-le avant de
communiquer l'accès à l'équipe — un code à 6 chiffres est préférable à 4.

## Tester en local avant de publier

Le navigateur bloque `fetch()` sur des fichiers ouverts directement
(`file://`). Lancez un petit serveur local depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvrez `http://localhost:8000` dans votre navigateur.
(Le hachage SHA-256 nécessite aussi un contexte sécurisé : `https://` une fois
publié, ou `http://localhost` en local — ça fonctionne dans les deux cas.)
