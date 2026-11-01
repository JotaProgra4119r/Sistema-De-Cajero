// Sistema de Asistencia Sonora (Desactivado a solicitud del usuario)
class AudioAccessibilityService {
  private enabled: boolean = false;

  constructor() {
    this.enabled = false;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("atm_audio_enabled", "false");
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = false;
    return false;
  }

  public playKeyClick() {
    // Sonidos desactivados
  }

  public playSuccessChime() {
    // Sonidos desactivados
  }

  public playWarningTone() {
    // Sonidos desactivados
  }

  public playErrorTone() {
    // Sonidos desactivados
  }
}

export const soundEffects = new AudioAccessibilityService();
