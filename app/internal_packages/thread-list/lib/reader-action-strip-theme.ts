import { Rx } from 'mailspring-exports';

/**
 * Whether the active theme shows conversation actions in a strip above the open message
 * (`"readerActionStrip": true` in the theme's package.json) rather than in the top bar.
 * Exactly one of the two may render the action buttons, because each button binds its
 * keyboard shortcut while mounted and two copies would run every shortcut twice.
 */
export function readerActionStripEnabled() {
  const theme = AppEnv.themes && AppEnv.themes.getActiveTheme();
  return !!(theme && theme.readerActionStrip);
}

export function readerActionStripObservable(): Rx.Observable<boolean> {
  return Rx.Observable.create((observer) => {
    observer.onNext(readerActionStripEnabled());
    const disposable = AppEnv.themes.onDidChangeActiveThemes(() =>
      observer.onNext(readerActionStripEnabled())
    );
    return Rx.Disposable.create(() => disposable.dispose());
  });
}
