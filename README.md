# Naruto Kayou Checklist

Site statique pour consulter les cartes Naruto Kayou par rarete, avec pages dediees, filtres et images locales optimisees.

## Site

Le site public se trouve dans :

```text
outputs/naruto-kayou/
```

La page d'accueil est :

```text
outputs/naruto-kayou/index.html
```

## Deploiement GitHub Pages

Le depot contient un workflow GitHub Actions qui publie automatiquement `outputs/naruto-kayou` sur GitHub Pages a chaque push sur `main`.

Depot GitHub prevu :

```text
https://github.com/Gandolfi-G/kayoudex.git
```

Dans GitHub :

1. Aller dans `Settings > Pages`.
2. Dans `Build and deployment`, choisir `GitHub Actions`.
3. Pousser le depot sur GitHub.

Pour un nom de domaine personnalise, ajouter ensuite un fichier `CNAME` dans `outputs/naruto-kayou/` contenant le domaine.

## Scripts utiles

```text
node .\work\scrape-narutopia.mjs
node .\work\generate-rarity-pages.mjs
node .\work\localize-card-images.mjs
node .\work\add-image-metadata.mjs
```

Apres une regeneration des pages, relancer la localisation des images puis les metadonnees.

## Premier push

Quand Git est installe sur la machine, lancer depuis la racine du projet :

```powershell
.\scripts\publish-to-github.ps1
```
