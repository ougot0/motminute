/** Écran de lancement : relais du splash natif, 350 ms, 100 % → 94 %, réduction des animations, lancement à froid. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import * as splash from 'expo-splash-screen';

import * as Overlay from '../src/ui/LaunchOverlay';

// Appelés au chargement du module, avant que les tests ne réinitialisent les espions.
const preventCalled = (splash.preventAutoHideAsync as jest.Mock).mock.calls.length;
const setOptionsArgs = (splash.setOptions as jest.Mock).mock.calls.map((c) => c[0]);

beforeEach(() => {
  Overlay.resetLaunchOverlayForTests();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function play(reduce: boolean, ready = true) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
  const timing = jest.spyOn(Animated, 'timing');
  const onFinished = jest.fn();
  const { LaunchOverlay } = Overlay;
  await render(<LaunchOverlay ready={ready} onFinished={onFinished} />);
  await fireEvent(screen.getByTestId('launch-overlay', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 390, height: 844 } } });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  return { timing, onFinished };
}

it('garde le splash natif jusqu’à ce que la copie React Native soit affichée, sans fondu natif', async () => {
  expect(preventCalled).toBeGreaterThan(0);
  expect(setOptionsArgs).toContainEqual({ fade: false });
  await play(false);
  expect(splash.hideAsync).toHaveBeenCalled();
});

it('350 ms : logo 100 % → 94 % et fondu de tout l’écran, puis retrait', async () => {
  const { timing, onFinished } = await play(false);
  const configs = timing.mock.calls.map((c) => c[1]);
  expect(configs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ toValue: 0, duration: 350 }),
      expect.objectContaining({ toValue: 0.94, duration: 350 }),
    ]),
  );
  expect(onFinished).toHaveBeenCalled();
  expect(screen.queryByTestId('launch-overlay', { includeHiddenElements: true })).toBeNull();
});

it('« Réduire les animations » : fondu court, sans changement d’échelle', async () => {
  const { timing, onFinished } = await play(true);
  const configs = timing.mock.calls.map((c) => c[1]);
  expect(configs).toHaveLength(1);
  expect(configs[0]).toMatchObject({ toValue: 0, duration: 150 });
  expect(onFinished).toHaveBeenCalled();
});

it('attend que l’accueil soit prêt, sans délai ajouté', async () => {
  const { timing } = await play(false, false);
  expect(timing).not.toHaveBeenCalled();
  expect(screen.getByTestId('launch-overlay', { includeHiddenElements: true })).toBeTruthy();
});

it('ne rejoue pas l’animation dans le même lancement', async () => {
  await play(false);
  await screen.unmount();
  const { LaunchOverlay } = Overlay;
  await render(<LaunchOverlay ready />);
  expect(screen.queryByTestId('launch-overlay', { includeHiddenElements: true })).toBeNull();
});
