// src/stores/useUIStore.ts
import { create } from 'zustand'
import type { NotificationItem } from '@/types/game'

interface Toast {
  id:      string
  type:    'success' | 'error' | 'info' | 'warning'
  message: string
  timeout: number
}

interface XPPopup {
  id:       string
  xp:       number
  levelUp?: boolean
  newLevel?: number
}

/** Ein freigeschaltetes Achievement, das als Popup angezeigt wird. */
interface AchievementUnlock {
  code:     string   // z.B. 'streak_7' → für AchievementIcon
  title:    string
  iconCode: string
  xp:       number
}

interface UIState {
  toasts:        Toast[]
  xpPopups:      XPPopup[]
  achievementQueue: AchievementUnlock[]   // FIFO-Queue freigeschalteter Achievements
  notifications: NotificationItem[]
  isNavVisible:  boolean
  activeModal:   string | null

  // Toast system
  toast:        (type: Toast['type'], message: string, timeout?: number) => void
  removeToast:  (id: string) => void

  // XP popup system
  showXPGain:   (xp: number, levelUp?: boolean, newLevel?: number) => void
  removeXPPopup:(id: string) => void

  // Achievement popup queue
  enqueueAchievements: (items: AchievementUnlock[]) => void  // mehrere auf einmal anhängen
  dismissAchievement:  () => void                            // vorderstes wegklicken → nächstes

  // Notification queue
  addNotification:    (n: Omit<NotificationItem, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Layout
  setNavVisible:(v: boolean) => void
  openModal:    (id: string) => void
  closeModal:   () => void

  // Telegram haptics
  haptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => void
}

let _idCounter = 0
const nextId = () => String(++_idCounter)

export const useUIStore = create<UIState>()((set, get) => ({
  toasts:        [],
  xpPopups:      [],
  achievementQueue: [],
  notifications: [],
  isNavVisible:  true,
  activeModal:   null,

  toast(type, message, timeout = 3500) {
    const id = nextId()
    set(s => ({ toasts: [...s.toasts, { id, type, message, timeout }] }))
    setTimeout(() => get().removeToast(id), timeout)
  },

  removeToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },

  showXPGain(xp, levelUp = false, newLevel) {
    const id = nextId()
    set(s => ({ xpPopups: [...s.xpPopups, { id, xp, levelUp, newLevel }] }))
    get().haptic(levelUp ? 'heavy' : 'light')

    // Add to notification queue
    get().addNotification({
      type:      levelUp ? 'level_up' : 'xp_gain',
      title:     levelUp ? `Level ${newLevel}! 🎉` : 'XP Earned',
      message:   `+${xp} XP${levelUp ? ` — You reached level ${newLevel}!` : ''}`,
      xpAmount:  xp,
      newLevel,
    })

    setTimeout(() => get().removeXPPopup(id), 2500)
  },

  removeXPPopup(id) {
    set(s => ({ xpPopups: s.xpPopups.filter(p => p.id !== id) }))
  },

  enqueueAchievements(items) {
    if (!items || items.length === 0) return
    // Haptik beim ersten Eintreffen — fühlt sich nach Belohnung an.
    get().haptic('success')
    set(s => ({ achievementQueue: [...s.achievementQueue, ...items] }))

    // Optional zusätzlich in die Notification-Historie (wie XP-Gains).
    items.forEach(a => {
      get().addNotification({
        type:     'achievement',
        title:    'Achievement Unlocked',
        message:  `${a.title} — +${a.xp} XP`,
        xpAmount: a.xp,
      })
    })
  },

  dismissAchievement() {
    // Vorderstes entfernen → das nächste rückt nach (Queue).
    set(s => ({ achievementQueue: s.achievementQueue.slice(1) }))
  },

  addNotification(n) {
    const item: NotificationItem = { ...n, id: nextId(), timestamp: Date.now() }
    set(s => ({
      notifications: [item, ...s.notifications].slice(0, 20), // keep last 20
    }))
  },

  removeNotification(id) {
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
  },

  clearNotifications() {
    set({ notifications: [] })
  },

  setNavVisible: (isNavVisible) => set({ isNavVisible }),
  openModal:     (activeModal)  => set({ activeModal }),
  closeModal:    ()             => set({ activeModal: null }),

  haptic(type) {
    try {
      const tg = (window as any).Telegram?.WebApp
      if (!tg?.HapticFeedback) return
      if (type === 'success' || type === 'error' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type)
      } else {
        tg.HapticFeedback.impactOccurred(type)
      }
    } catch {
      // Haptics not available (desktop / dev mode)
    }
  },
}))
