# MotMinute

Application iPhone pour journalistes, podcasteurs et créateurs : importer une interview, la transcrire **sur l’iPhone**, retrouver une citation en la décrivant avec ses propres mots, réécouter le passage d’origine et copier la citation avec son minutage.

> Parcours : **importer → transcrire → chercher → réécouter → copier**.
> Exemple de la démo : on tape « pourquoi il a démissionné », l’app propose l’extrait **18:42** « J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision. », le lecteur s’ouvre à 18:42 et la citation se copie avec son titre et son minutage.

Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · SQLite local · module natif Swift `SpeechAnalyzer` (iOS 26) · abonnements StoreKit 2 via `expo-iap`.

---

## 1. État réel de cette version

| Fonction | État | Comment c’est vérifié |
|---|---|---|
| Bibliothèque (titre, durée, date, état, renommer, supprimer) | ✅ | Tests + rendu navigateur |
| Interview démo fictive (audio + transcription minutée) | ✅ | Minutages **mesurés** sur l’audio généré ; parole présente à 18:42 vérifiée avec ffmpeg |
| Import `.m4a` / `.mp3` / `.wav` depuis Fichiers, copie privée, message clair si illisible | ✅ codé | Compilation iOS + typecheck. **Pas testé sur iPhone** (sélecteur de fichiers natif) |
| Transcription réelle `SpeechAnalyzer` (iOS 26), téléchargement du modèle, compatibilité | ⚠️ codé, **non exécuté** | Swift écrit selon l’API iOS 26 ; ni compilé ni lancé ici (pas de Mac/iPhone). À valider avec un build de développement (section 4) |
| Blocs cliquables, correction du texte sans toucher aux repères audio | ✅ | Tests (base SQLite réelle) + interface |
| Relance après erreur / interruption sans réimport | ✅ | Tests (moteur simulé, base réelle, redémarrage simulé) |
| Lecteur : lecture/pause, barre de position, −15 s / +15 s, ouverture au début du passage, « −5 s » de contexte | ✅ | Tests d’interface (lecteur simulé) + lecture **réelle** dans Chromium (18:42, puis 18:37 après « −5 s ») |
| Copier (texte affiché mot pour mot + titre + minutage), enregistrer une citation, y revenir | ✅ | Tests + presse-papiers réel dans Chromium |
| Persistance après redémarrage | ✅ | Tests : fermeture puis réouverture du même fichier SQLite ; navigateur : rechargement complet |
| Recherche textuelle (accents, casse, expressions exactes, reformulations françaises) | ✅ | 25 tests avec reformulations et distracteurs |
| Recherche **par sens** (modèle local) | ⚠️ **non activée** | Code présent (Apple `NLEmbedding`, français), mais qualité **non vérifiée** sur iPhone → désactivée par défaut, diagnostic intégré dans Réglages |
| Quota gratuit (60 min de transcription **terminée**) et Pro | ✅ | Tests : erreurs, annulations et transcriptions vides ne comptent pas ; la démo ne compte pas |
| Achat / restauration des abonnements | ⚠️ codé, non testé | Nécessite la configuration App Store Connect (section 6). Sans elle, l’app reste utilisable en gratuit |

**La recherche active est textuelle.** Elle ne « comprend » pas le sens : elle s’appuie sur un lexique explicite de reformulations françaises (`src/lib/lexicon.ts`, ex. « démissionner » ≈ « quitter mon poste », « licencié » ≈ « a été remercié »). C’est indiqué dans l’app (sous la barre de recherche et dans Réglages).

---

## 2. Installation

Prérequis : Node 20+ (testé avec Node 22), npm, un compte Expo, votre compte Apple Developer.

```bash
npm install
```

## 3. Tests et vérifications

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

Ce que couvrent les 40 tests (`__tests__/`) :

- `search.test.ts` — « pourquoi il a démissionné » → bloc réel à 18:42, en tête, y compris dans toute la bibliothèque ; distracteurs écartés (« J’ai quitté Lyon », « Pourquoi avez-vous accepté ce poste ? », « Je vous remercie ») ; 8 autres reformulations ; expressions exactes ; état vide ; chaque résultat pointe vers un bloc existant avec son vrai minutage.
- `persistence-quota.test.ts` — vraie base SQLite sur fichier (`node:sqlite`) fermée puis rouverte ; quota uniquement sur les traitements terminés ; relance après interruption ; Pro et expiration ; suppression qui ne rend pas de minutes ; format de citation copiée.
- `journey-search.test.tsx`, `journey-restart.test.tsx`, `journey-edit.test.tsx` — vrais écrans et vrai routeur Expo : recherche → toucher le résultat → `seekTo(1122)` → « −5 s » → `seekTo(1117)` + lecture → copie mot pour mot → citation enregistrée → retrouvée après redémarrage → correction d’un bloc sans changement de minutage.

## 4. Lancer l’app sur votre iPhone (build de développement)

Le module natif de transcription et StoreKit ne fonctionnent pas dans Expo Go : il faut un **build de développement**. Aucun projet Xcode n’est versionné : le dossier `ios/` est généré par EAS au moment du build (Continuous Native Generation).

1. Connexion et liaison du projet (renseigne `extra.eas.projectId` dans `app.json`) :

   ```bash
   npx eas-cli@latest login
   ```

   ```bash
   npx eas-cli@latest init
   ```

2. Vérifiez l’identifiant de bundle dans `app.json` → `ios.bundleIdentifier` (par défaut `com.motminute.app`). Remplacez-le s’il n’est pas disponible sur votre compte ; adaptez alors aussi les identifiants de produits dans `src/config.ts`.

3. Enregistrez votre iPhone pour la distribution interne (lien à ouvrir sur l’iPhone) :

   ```bash
   npx eas-cli@latest device:create
   ```

4. Lancez le build de développement (EAS crée ou réutilise certificat et profil de provisionnement avec votre compte Apple) :

   ```bash
   npm run build:dev
   ```

5. Sur l’iPhone : installez le build via le lien/QR code d’EAS, activez **Réglages › Confidentialité et sécurité › Mode développeur**, puis redémarrez l’iPhone si demandé.

6. Sur votre ordinateur, démarrez Metro et ouvrez l’app MotMinute sur l’iPhone (même réseau Wi-Fi) :

   ```bash
   npm start
   ```

Build autonome sans Metro (pour tester hors de chez vous) :

```bash
npm run build:preview
```

Aperçu web de l’interface uniquement (pas de transcription ni d’achat) : `npm run web`.

### Tester la vraie transcription (iOS 26)

1. Réglages de l’app › Transcription : l’état doit indiquer « prête » ou « le modèle français doit être téléchargé ». Touchez **Télécharger le modèle français** (une seule fois, Wi-Fi conseillé).
2. Importez un court enregistrement en français (2–5 min, `.m4a` depuis Dictaphone ou Fichiers). La transcription démarre automatiquement ; gardez l’app au premier plan.
3. Vérifiez qu’un bloc touché lance l’audio au bon endroit, puis cherchez une phrase prononcée.

Messages possibles : iOS < 26 → « nécessite iOS 26 » ; appareil non pris en charge → message dédié ; français indisponible → message dédié. Dans tous les cas la démo reste utilisable.

Si le build échoue sur `MotMinuteSpeechModule.swift` (API iOS 26 non compilée pendant cette session), l’erreur sera dans les logs EAS « Run fastlane » ; le reste de l’app ne dépend pas de ce fichier.

## 5. Données et confidentialité

- Audios : copie privée dans `Documents/interviews/` de l’app (seul le **nom** du fichier est stocké, pour survivre aux mises à jour iOS qui changent le chemin du conteneur).
- Transcriptions, corrections, citations, journal du quota, réglages : base SQLite `motminute.db`.
- Aucun envoi réseau pour la transcription ni la recherche. Les fichiers sont inclus dans la sauvegarde iCloud/ordinateur de l’iPhone, comme les autres documents de l’app.

## 6. Abonnements (à configurer dans App Store Connect)

Le code (`src/services/subscriptions.ts`, écran `src/app/paywall.tsx`) affiche les **prix renvoyés par l’App Store**, gère achat, restauration et état hors ligne. Ce qu’il vous reste à faire :

1. **Contrats, taxes et banque** : contrat « Apps payantes » actif.
2. Créer l’app dans App Store Connect avec le même bundle ID que `app.json`.
3. **Groupe d’abonnements** « MotMinute Pro », avec deux abonnements à renouvellement automatique :

   | Référence | ID produit (modifiable dans `src/config.ts`) | Durée | Prix à tester |
   |---|---|---|---|
   | Pro mensuel | `com.motminute.app.pro.monthly` | 1 mois | 11,99 € |
   | Pro annuel | `com.motminute.app.pro.yearly` | 1 an | 99,99 € |

   Ajoutez nom et description en français, et une capture d’écran pour la revue.
4. Créer un **testeur Sandbox** (Utilisateurs et accès › Sandbox) et l’utiliser sur l’iPhone (Réglages › App Store › Compte Sandbox).
5. Remplacer les URL de `LEGAL_URLS` dans `src/config.ts` (conditions et politique de confidentialité, exigées pour les abonnements).
6. Pour la soumission plus tard : compléter `submit.production.ios` dans `eas.json` (`appleId`, `ascAppId`, `appleTeamId`).

Règles appliquées : version gratuite = démo + **60 minutes cumulées de transcription terminée** ; Pro = nouvelles transcriptions sans quota ; à l’expiration, les interviews, transcriptions et citations restent accessibles et cherchables. Tant que les produits ne sont pas configurés, l’écran Pro l’indique et le parcours gratuit reste testable. Dans un build de développement, Réglages propose « Simuler Pro » pour tester le déblocage sans StoreKit.

Non inclus : validation des reçus côté serveur et App Store Server Notifications (les droits sont lus via StoreKit 2 sur l’appareil).

## 7. Organisation du code

```
src/app/                 écrans (Expo Router)
  index.tsx              bibliothèque + recherche globale + import
  interview/[id].tsx     lecteur, transcription, recherche locale, citation
  quotes.tsx             citations enregistrées
  settings.tsx           abonnement, moteur, recherche, démo
  paywall.tsx            MotMinute Pro
src/lib/                 logique pure testée : search, lexicon, text, quota, quote, time
src/data/                SQLite (repository.ts), démo (demo.ts, demoTranscript.json)
src/services/            import audio, moteur natif, orchestration de transcription, abonnements, recherche par sens
src/state/AppState.tsx   état global (Pro, quota, transcription en cours)
src/ui/                  thème, composants, lecteur
modules/motminute-speech module Expo local (Swift) : SpeechAnalyzer + NLEmbedding
scripts/                 génération de la démo et de l’icône provisoire
```

Régénérer la démo (Linux, `espeak-ng`, `mbrola-fr1`, `mbrola-fr4`, `ffmpeg`) : `npm run demo:generate`.
Icône et splash sont **provisoires** (`scripts/generate-placeholder-icons.py`) : remplacez `assets/icon.png` et `assets/splash-icon.png` par l’icône finale.

## 8. Limites connues et suites possibles

- Valider `SpeechAnalyzer` sur iPhone ; prévoir `DictationTranscriber` comme repli pour les appareils où `SpeechTranscriber` n’est pas disponible.
- Transcription longue en arrière-plan (iOS 26 `BGContinuedProcessingTask`) : aujourd’hui l’app doit rester ouverte ; une interruption est détectée au relancement et proposée à la relance.
- Pas d’identification des locuteurs.
- Recherche par sens : à activer seulement si le diagnostic de Réglages donne de bons résultats sur l’iPhone.
