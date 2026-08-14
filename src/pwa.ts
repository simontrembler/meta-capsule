export function registerPwa(): void {
  if (!import.meta.env.PROD) return;
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          const check = () => {
            void registration.update();
          };
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
          window.setInterval(check, 15 * 60 * 1000);
        }
      });
    })
    .catch(() => {
      // Service worker is optional; the app still works without it.
    });
}
