// Lecteur simulé pour les tests d'interface : on vérifie où il est positionné.
export const mockPlayer = {
  isLoaded: true,
  playing: false,
  duration: 1274.85,
  currentTime: 0,
  seekTo: jest.fn(async (t: number) => {
    mockPlayer.currentTime = t;
  }),
  play: jest.fn(() => {
    mockPlayer.playing = true;
  }),
  pause: jest.fn(() => {
    mockPlayer.playing = false;
  }),
  remove: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
export const useAudioPlayer = () => mockPlayer;
export const useAudioPlayerStatus = () => ({
  isLoaded: mockPlayer.isLoaded,
  currentTime: mockPlayer.currentTime,
  duration: mockPlayer.duration,
  playing: mockPlayer.playing,
  didJustFinish: false,
});
export const createAudioPlayer = () => mockPlayer;
export const setAudioModeAsync = jest.fn(async () => undefined);
