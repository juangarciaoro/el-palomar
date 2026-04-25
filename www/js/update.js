// ═══════════════════════════════════════════════════════
// IN-APP UPDATE — Google Play In-App Updates API
// Solo se ejecuta en entorno nativo Android (Capacitor).
// Usa "Immediate Update" (forzado, no cancelable).
// ═══════════════════════════════════════════════════════

async function checkForUpdate() {
  // Guard: solo en nativo
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  const AppUpdate = window.Capacitor.Plugins.AppUpdate;
  if (!AppUpdate) return;

  try {
    const info = await AppUpdate.getAppUpdateInfo();

    // updateAvailability: 1 = UP_TO_DATE, 2 = UPDATE_AVAILABLE, 3 = IN_PROGRESS
    if (info.updateAvailability !== 2) return;

    // Lanzar actualización inmediata (pantalla nativa de Google, no cancelable)
    await _performImmediateUpdate(AppUpdate);
  } catch (e) {
    // Silencioso: si falla (sin conexión, no publicado en Play, etc.) la app sigue cargando normal
    console.warn('[Update] checkForUpdate error:', e);
  }
}

async function _performImmediateUpdate(AppUpdate) {
  try {
    await AppUpdate.performImmediateUpdate();
    // Si llega aquí, el usuario pulsó atrás para cancelar → volver a forzar
    await _performImmediateUpdate(AppUpdate);
  } catch (e) {
    // performImmediateUpdate rechaza si el usuario cancela → forzar de nuevo
    await _performImmediateUpdate(AppUpdate);
  }
}

