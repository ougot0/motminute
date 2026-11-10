import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { getLaunchTarget } from './launchTarget';

/**
 * Écran de lancement animé.
 *
 * 1. Splash natif (expo-splash-screen, app.json) : fond bleu électrique + logo,
 *    220 pt, centré. Il s'affiche immédiatement.
 * 2. Cette superposition, identique au départ (un disque bleu qui couvre tout
 *    l'écran + le même logo au même endroit), prend le relais ; le splash natif
 *    n'est masqué qu'une fois elle affichée → ni flash blanc ni saut.
 * 3. Dès que l'accueil est prêt :
 *    - 0–350 ms : le logo passe de 100 % à 94 % ; le point menthe émet deux ondes
 *      (elles continuent pendant la suite) ;
 *    - 350–950 ms : l'écran bleu se replie en disque jusque dans le bouton
 *      « Enregistrer » de la barre d'onglets, le point menthe y vole, le logo
 *      s'efface ; l'accueil apparaît autour ;
 *    - fin : courte disparition, la superposition est retirée, l'app est interactive.
 *    « Réduire les animations » : simple fondu de 150 ms, sans mouvement.
 *
 * Joué une seule fois par lancement à froid.
 */

export const BRAND_BLUE = '#2B00FF';
export const MINT = '#63F0C7';
export const LOGO_WIDTH = 220; // identique à imageWidth dans app.json
const LOGO = require('../../assets/splash-logo.png');
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 658) / 1248);
// Point menthe dans le logo (fractions de l'image) et diamètre affiché.
const DOT_X = (LOGO_WIDTH * (795 / 832 - 0.5));
const DOT_Y = (LOGO_HEIGHT * (339 / 439 - 0.5));
const DOT_SIZE = (LOGO_WIDTH * 54) / 832;

export const SHRINK_MS = 350;
export const COLLAPSE_MS = 600;
export const REDUCED_DURATION_MS = 150;
export const END_SCALE = 0.94;

SplashScreen.preventAutoHideAsync().catch(() => undefined);
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

const ease = Easing.bezier(0.2, 0, 0, 1);
const t = (v: Animated.Value, toValue: number, duration: number, delay = 0, easing = ease) =>
  Animated.timing(v, { toValue, duration, delay, easing, useNativeDriver: true });

export function LaunchOverlay({ ready, onFinished }: { ready: boolean; onFinished?: () => void }) {
  const [visible, setVisible] = useState(!playedThisLaunch);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const [v] = useState(() => ({
    root: new Animated.Value(1),
    logoScale: new Animated.Value(1),
    logoOpacity: new Animated.Value(1),
    ring1: new Animated.Value(0),
    ring2: new Animated.Value(0),
    discScale: new Animated.Value(1),
    discX: new Animated.Value(0),
    discY: new Animated.Value(0),
    dotX: new Animated.Value(0),
    dotY: new Animated.Value(0),
    dotScale: new Animated.Value(1),
  }));

  useEffect(() => {
    if (!visible || !ready || !size) return;
    let cancelled = false;
    (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      await new Promise((r) => requestAnimationFrame(() => r(null))); // l'accueil est peint derrière
      if (cancelled) return;
      const done = () => {
        playedThisLaunch = true;
        setVisible(false);
        onFinished?.();
      };
      if (reduce) {
        t(v.root, 0, REDUCED_DURATION_MS, 0, Easing.out(Easing.quad)).start(done);
        return;
      }
      // Cible : centre du bouton « Enregistrer », dans le repère de la superposition.
      // Mesures bornées à 50 ms : en cas d'absence de réponse, cible par défaut (bas de l'écran, au centre).
      const target = await withTimeout(getLaunchTarget(), null);
      const origin = await withTimeout(
        new Promise<{ x: number; y: number }>((resolve) =>
          rootRef.current ? rootRef.current.measureInWindow((x, y) => resolve({ x, y })) : resolve({ x: 0, y: 0 }),
        ),
        { x: 0, y: 0 },
      );
      if (cancelled) return;
      const tx = (target ? target.x - origin.x : size.w / 2) - size.w / 2;
      const ty = (target ? target.y - origin.y : size.h - 60) - size.h / 2;
      const button = target?.size ?? 52;
      const disc = discDiameter(size.w, size.h);

      // Les ondes du point menthe se poursuivent pendant le repli : aucune attente.
      Animated.parallel([
        t(v.ring1, 1, 700, 0, Easing.out(Easing.quad)),
        t(v.ring2, 1, 700, 160, Easing.out(Easing.quad)),
        Animated.sequence([
          t(v.logoScale, END_SCALE, SHRINK_MS),
          Animated.parallel([
            t(v.logoOpacity, 0, 220),
            t(v.discScale, button / disc, COLLAPSE_MS),
            t(v.discX, tx, COLLAPSE_MS),
            t(v.discY, ty, COLLAPSE_MS),
            t(v.dotX, tx - DOT_X, COLLAPSE_MS),
            t(v.dotY, ty - DOT_Y, COLLAPSE_MS),
            t(v.dotScale, 16 / DOT_SIZE, COLLAPSE_MS),
          ]),
          t(v.root, 0, 120, 0, Easing.linear),
        ]),
      ]).start(done);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, ready, size, v, onFinished]);

  if (!visible) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size) {
      setSize({ w: width, h: height });
      // La copie React Native est à l'écran : on peut retirer le splash natif.
      SplashScreen.hideAsync().catch(() => undefined);
    }
  };
  const disc = size ? discDiameter(size.w, size.h) : 0;
  const ring = (p: Animated.Value) => ({
    opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
    transform: [{ translateX: DOT_X }, { translateY: DOT_Y }, { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 7] }) }],
  });

  return (
    <Animated.View
      ref={rootRef}
      testID="launch-overlay"
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: v.root, backgroundColor: size ? 'transparent' : BRAND_BLUE }]}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <StatusBar style="light" />
      {size ? (
        <Animated.View
          style={[
            styles.disc,
            { width: disc, height: disc, borderRadius: disc / 2 },
            { transform: [{ translateX: v.discX }, { translateY: v.discY }, { scale: v.discScale }] },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.ring, ring(v.ring1)]} />
      <Animated.View style={[styles.ring, ring(v.ring2)]} />
      <Animated.View style={{ opacity: v.logoOpacity, transform: [{ scale: v.logoScale }] }}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Animated.View>
      <Animated.View
        style={[
          styles.dot,
          {
            transform: [
              { translateX: Animated.add(v.dotX, DOT_X) },
              { translateY: Animated.add(v.dotY, DOT_Y) },
              { scale: v.dotScale },
            ],
            opacity: v.logoOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          },
        ]}
      />
    </Animated.View>
  );
}

function withTimeout<T>(p: Promise<T>, fallback: T, ms = 50): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/** Disque centré assez grand pour couvrir tout l'écran. */
function discDiameter(w: number, h: number) {
  return Math.ceil(Math.hypot(w, h)) + 4;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  disc: { position: 'absolute', backgroundColor: BRAND_BLUE },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  ring: { position: 'absolute', width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, borderWidth: 2.5, borderColor: MINT },
  dot: { position: 'absolute', width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: MINT },
});
