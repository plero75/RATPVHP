<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Dashboard Transports RATPVHP - Version VHP3 Optimisée

## 🚀 Nouvelles fonctionnalités VHP3

Cette version intègre les optimisations avancées conformément au cahier des charges VHP3 :

### 🔄 Actualisation adaptative intelligente
- **RER A** : 15-90s selon proximité des passages
- **Bus** : 20-90s selon activité du service  
- **Vélib'** : 90-180s selon variation des vélos
- **Trafic** : 120-180s (ralenti si aucun message)
- **Économie d'API** : Réduction ciblée de 65% (9000 → 3150 appels/jour)

### 🗄️ Cache intelligent multi-niveaux
- TTL adaptatifs par type de données (1min à 24h)
- Compression automatique des gros objets
- Nettoyage intelligent basé sur l'usage
- Statistiques de performance en temps réel

### 🎨 Composants UX optimisés
- **StatusIndicator** : États visuels unifiés (loading/ok/warning/error/ended)
- **TimeBadge** : Badges temps avec états (imminent/retard/suppression)
- **LineChip** : Puces de lignes avec couleurs officielles IDFM
- **PerformanceDashboard** : Monitoring flottant des performances

### 📋 Dashboard de performance
Tableau de bord intégré affichant :
- Pourcentage de réduction d'appels API
- Taux de hit du cache en temps réel  
- Intervalles adaptatifs par module
- Actions de maintenance (clear cache, refresh)

## 🛠️ Installation et développement

**Prérequis :** Node.js 18+

### Développement local

1. **Installer les dépendances :**
   ```bash
   npm install
   ```

2. **Configurer l'environnement :**
   ```bash
   # Copier le fichier d'exemple
   cp .env.local.example .env.local
   
   # Définir la clé API Gemini (optionnelle pour AI Studio)
   echo "GEMINI_API_KEY=your_key_here" >> .env.local
   ```

3. **Démarrer en mode développement :**
   ```bash
   npm run dev
   ```

4. **Build de production :**
   ```bash
   npm run build
   npm run preview
   ```

### 🔍 Tests et debugging

```bash
# Vérification TypeScript
npm run type-check

# Linting
npm run lint
```

## 🎯 Architecture VHP3

### Structure du projet
```
src/
├── lib/                    # Utilitaires VHP3
│   ├── adaptive-scheduler.ts  # Scheduler adaptatif
│   ├── intelligent-cache.ts   # Cache multi-niveaux  
│   └── ux-components.tsx      # Composants UX
├── components/            # Composants React
├── services/              # API et logique métier
├── hooks/                 # Hooks personnalisés
└── types.ts               # Définitions TypeScript
```

### APIs intégrées
- **PRIM IDFM** : Transport temps réel (RER/Bus/Trafic)
- **Vélib' Metropole** : Disponibilité stations
- **PMU TurfInfo** : Courses hippiques Vincennes/Enghien
- **Open-Meteo** : Conditions météorologiques
- **France Info RSS** : Actualités

### Proxy et sécurité
- Proxy Cloudflare Workers pour contournement CORS
- Authentification API PRIM automatique
- Timeouts et retry configurables
- Gestion robuste des erreurs

## 📊 Performance et monitoring

### Accès au dashboard
1. Cliquer sur l'icône 📊 en bas à droite
2. Visualiser les métriques en temps réel :
   - % réduction API vs fréquence fixe
   - Taux de hit du cache  
   - Intervalles adaptatifs par module
   - Historique d'erreurs

### Utilisation du cache
```typescript
// Exemple d'utilisation du cache intelligent
import { useCachedData } from './lib/intelligent-cache';

const { data, loading, fromCache } = useCachedData(
  'weather_vincennes',
  'weather', 
  fetchWeatherData
);
```

### Scheduler adaptatif
```typescript
// Exemple d'utilisation du scheduler
import { useAdaptiveUpdate } from './lib/adaptive-scheduler';

const { data, stats } = useAdaptiveUpdate(
  'rer_a',
  fetchRerData,
  []
);
```

## 🌍 Déploiement

### GitHub Pages (version simple)
- URL : [plero75.github.io/RATPVHP](https://plero75.github.io/RATPVHP/)
- Version : JavaScript vanilla (démo)

### Version React optimisée
```bash
# Build et déploiement
npm run build
# Déployer le dossier dist/ sur votre hébergeur
```

### Variables d'environnement
```bash
# Production
VITE_PRIM_API_KEY=your_prim_key
VITE_PROXY_URL=https://your-proxy.workers.dev
```

## 📈 Indicateurs de performance VHP3

| Métrique | Objectif | Actuel |
|----------|----------|--------|
| Réduction API | 65% | Calculé en temps réel |
| Cache Hit Rate | >80% | Surveillé |
| Temps de réponse | <2s | Optimisé |
| Disponibilité | 99.5% | Fallbacks GTFS |

## 🐛 Support et contribution

### Issues courantes
- **CORS errors** : Le proxy Cloudflare Workers est automatique
- **API timeouts** : Retry automatique (3x) avec backoff
- **Cache plein** : Nettoyage intelligent par usage
- **TypeScript errors** : `npm run type-check`

### Logs de débogage
```javascript
// Accéder aux stats via console
console.log(adaptiveScheduler.getStats());
console.log(intelligentCache.export());
```

## 📦 À propos

Dashboard de transports en temps réel pour l'Hippodrome de Vincennes, développé avec :
- **React 19** + **TypeScript 5.8**
- **Vite 6** + **Tailwind CSS 3.4** 
- **Architecture adaptative VHP3**
- **Optimisations API avancées**

**Licence :** MIT  
**Auteur :** plero75

---

> 🎆 **Version VHP3** - Optimisations intelligentes pour un dashboard haute performance