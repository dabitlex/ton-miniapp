// src/app/api/v1/_lib/achievements.ts
// VEXALGO — zentraler Helper für Achievement-Checks.
//
// Ruft die DB-Funktion check_achievements auf und gibt die NEU
// freigeschalteten Achievements im Frontend-Format zurück.
//
// Wird nach relevanten Aktionen aufgerufen (Quest, Ad, Streak, Box, ...).
// Solange das Feature-Flag aus ist, gibt check_achievements eine leere
// Liste zurück → dieser Helper liefert dann [] und nichts passiert.
//
// WICHTIG: Nie werfen — Achievement-Checks dürfen die eigentliche Aktion
// (z.B. Quest abschließen) niemals scheitern lassen. Bei jedem Fehler: [].
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NewAchievement {
  code:     string
  title:    string
  iconCode: string
  xp:       number
}

/**
 * Prüft & schaltet Achievements für einen User frei.
 * @returns Liste der NEU freigeschalteten Achievements (für das Popup),
 *          oder [] wenn nichts neu / Flag aus / Fehler.
 */
export async function checkAchievements(
  db: SupabaseClient,
  userId: string,
): Promise<NewAchievement[]> {
  try {
    const { data, error } = await db.rpc('check_achievements', { p_user_id: userId })
    if (error || !Array.isArray(data)) return []

    return data.map((r: any) => ({
      code:     r.out_code,
      title:    r.out_title,
      iconCode: r.out_icon_code,
      xp:       r.out_xp_reward,
    }))
  } catch {
    // Niemals die aufrufende Aktion scheitern lassen.
    return []
  }
}
