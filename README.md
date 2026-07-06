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

Le site est publie avec GitHub Pages depuis la branche `main`.
La racine du depot contient un `index.html` qui redirige vers le site statique dans `outputs/naruto-kayou/`.

Depot GitHub prevu :

```text
https://github.com/Gandolfi-G/kayoudex.git
```

Dans GitHub :

1. Aller dans `Settings > Pages`.
2. Dans `Build and deployment`, choisir `Deploy from a branch`.
3. Choisir la branche `main` et le dossier `/ (root)`.

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
