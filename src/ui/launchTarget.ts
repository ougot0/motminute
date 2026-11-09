/** Position (dans la fenêtre) du bouton « Enregistrer » de la barre d'onglets, cible de l'animation de lancement. */
export type Target = { x: number; y: number; size: number };

let current: Target | null = null;
let measure: (() => Promise<Target | null>) | null = null;

export function registerLaunchTarget(fn: () => Promise<Target | null>) {
  measure = fn;
  return () => {
    if (measure === fn) measure = null;
  };
}

export async function getLaunchTarget(): Promise<Target | null> {
  if (measure) current = (await measure()) ?? current;
  return current;
}
