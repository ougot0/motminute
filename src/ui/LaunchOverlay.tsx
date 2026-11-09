import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet } from 'react-native';

/**
 * Écran de lancement animé.
 *
 * 1. Le splash natif (expo-splash-screen, voir app.json) affiche aussitôt le fond
 *    bleu électrique et le logo, centré, 220 pt de large.
 * 2. Cette superposition, identique au pixel près (même fond, même image, même
 *    taille, centrée sur tout l'écran), prend le relais : on ne cache le splash
 *    natif qu'une fois elle affichée → pas de flash blanc ni de saut.
 * 3. Dès que l'accueil est prêt : 350 ms, logo 100 % → 94 % et fondu de tout
 *    l'écran ; l'accueil apparaît derrière. La superposition est ensuite retirée.
 *    « Réduire les animations » activé : fondu court, sans changement d'échelle.
 *
 * Joué une seule fois par lancement à froid (un retour depuis l'arrière-plan ne
 * remonte pas ce composant).
 */

export const BRAND_BLUE = '#2B00FF';
export const LOGO_WIDTH = 220; // identique à imageWidth dans app.json
const LOGO = require('../../assets/splash-logo.png');
const LOGO_RATIO = 658 / 1248; // hauteur / largeur de assets/splash-logo.png
export const DURATION_MS = 350;
export const REDUCED_DURATION_MS = 150;
export const END_SCALE = 0.94;

// Le splash natif reste affiché tant que la superposition n'est pas prête.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Pas de fondu natif : la superposition identique prend le relais instantanément.
try {
  SplashScreen.setOptions({ fade: false });
} catch {
  // option indisponible sur cette plateforme
}

let playedThisLaunch = false;

/** Tests uniquement : simule un nouveau lancement à froid. */
export function resetLaunchOverlayForTests() {
  playedThisLaunch = false;
}

export function LaunchOverlay({ ready, onFinished }: { ready: boolean; onFinished?: () => void }) {
  const [visible, setVisible] = useState(!playedThisLaunch);
  const [laidOut, setLaidOut] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!visible || !ready || !laidOut) return;
    let cancelled = false;
    (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      // Une image : l'accueil, déjà rendu derrière, est peint avant le fondu.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      const fade = Animated.timing(opacity, {
        toValue: 0,
        duration: reduce ? REDUCED_DURATION_MS : DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      const animation = reduce
        ? fade
        : Animated.parallel([
            fade,
            Animated.timing(scale, { toValue: END_SCALE, duration: DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]);
      animation.start(() => {
        playedThisLaunch = true;
        setVisible(false);
        onFinished?.();
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, ready, laidOut, opacity, scale, onFinished]);

  if (!visible) return null;
  return (
    <Animated.View
      testID="launch-overlay"
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      onLayout={() => {
        // La copie React Native est à l'écran : on peut retirer le splash natif.
        SplashScreen.hideAsync().catch(() => undefined);
        setLaidOut(true);
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <StatusBar style="light" />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  logo: { width: LOGO_WIDTH, height: Math.round(LOGO_WIDTH * LOGO_RATIO) },
});
