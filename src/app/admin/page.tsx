// src/app/admin/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatNumber } from '@/lib/utils'

type Tab = 'overview' | 'quests' | 'users' | 'transactions'

export default function AdminDashboard() {
  const [tab, setTab]         = useState<Tab>('overview')
  const [stats, setStats]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 401) { router.replace('/admin/login'); return }
      const json = await res.json()
      setStats(json)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Auto-refresh alle 30 Sekunden
  useEffect(() => {
    const t = setInterval(fetchStats, 30_000)
    return () => clearInterval(t)
  }, [fetchStats])

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.replace('/admin/login')
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',     label: 'Übersicht',   icon: '📊' },
    { key: 'quests',       label: 'Quests',      icon: '⚔️' },
    { key: 'users',        label: 'Nutzer',      icon: '👥' },
    { key: 'transactions', label: 'TON TXs',     icon: '💎' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#020207', color: 'white' }}>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(6,6,16,0.95)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, position: 'sticky', top: 0, zIndex: 50,
      }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18 }}>
          VEX<span style={{ color: '#A855F7' }}>ALGO</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 8 }}>Admin</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stats && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              🟢 Live · {new Date(stats.timestamp).toLocaleTimeString('de-DE')}
            </span>
          )}
          <button onClick={logout}
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
            }}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
      }}>
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 13,
              fontWeight: tab === key ? 700 : 400, cursor: 'pointer',
              background: tab === key ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              border: tab === key ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
              color: tab === key ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap',
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* ── OVERVIEW ───────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Live Übersicht</h2>

            {loading ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40 }}>
                Lade Daten...
              </div>
            ) : stats && (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Nutzer gesamt', value: formatNumber(stats.users.total),       icon: '👥', color: '#A855F7' },
                    { label: 'Aktiv heute',   value: formatNumber(stats.users.activeToday), icon: '🟢', color: '#10B981' },
                    { label: 'Neu heute',     value: formatNumber(stats.users.newToday),    icon: '✨', color: '#3B82F6' },
                    { label: 'Neu (7 Tage)',  value: formatNumber(stats.users.newLast7d),   icon: '📈', color: '#F59E0B' },
                    { label: 'XP heute',      value: formatNumber(stats.xp.totalToday),     icon: '⭐', color: '#F59E0B' },
                    { label: 'TX pending',    value: stats.transactions.pending,            icon: '⏳', color: stats.transactions.pending > 0 ? '#F59E0B' : '#10B981' },
                    { label: 'TX bestätigt',  value: stats.transactions.confirmed,          icon: '✅', color: '#10B981' },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, padding: 16,
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Top Players + Clans */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Top Players */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 16,
                  }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🏆 Top Spieler</h3>
                    {stats.topPlayers.map((p: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: i < stats.topPlayers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13 }}>{p.telegram_first_name}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Lv.{p.level}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#A855F7', fontFamily: 'monospace' }}>
                          {formatNumber(p.season_xp)} XP
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Top Clans */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 16,
                  }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🛡️ Top Clans</h3>
                    {stats.topClans.map((c: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: i < stats.topClans.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13 }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{c.member_count}👥</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace' }}>
                          {formatNumber(c.season_xp)} XP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Transactions */}
                {stats.transactions.recent.length > 0 && (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 16, marginTop: 16,
                  }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💎 Letzte TON Transaktionen</h3>
                    {stats.transactions.recent.map((tx: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 0', fontSize: 12,
                        borderBottom: i < stats.transactions.recent.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                          {tx.tx_hash.slice(0, 20)}...
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: tx.status === 'confirmed' ? 'rgba(16,185,129,0.15)' :
                            tx.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                          color: tx.status === 'confirmed' ? '#10B981' :
                            tx.status === 'pending' ? '#F59E0B' : '#F43F5E',
                        }}>
                          {tx.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── QUESTS ─────────────────────────────────────── */}
        {tab === 'quests' && <QuestManager />}

        {/* ── USERS ──────────────────────────────────────── */}
        {tab === 'users' && <UserManager />}

        {/* ── TRANSACTIONS ───────────────────────────────── */}
        {tab === 'transactions' && <TxManager />}
      </div>
    </div>
  )
}

// ── Quest Manager ─────────────────────────────────────────────
function QuestManager() {
  const [quests, setQuests]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    internal_code: '', title: '', description: '',
    difficulty: 'easy', quest_type: 'daily',
    energy_cost: 5, xp_reward: 80, icon_key: '⚔️',
    verification_type: 'none', verification_value: '',
  })

  useEffect(() => {
    fetch('/api/admin/quests').then(r => r.json())
      .then(d => { setQuests(d.quests ?? []); setLoading(false) })
  }, [])

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/quests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    setQuests(q => q.map(qt => qt.id === id ? { ...qt, is_active: !is_active } : qt))
  }

  async function createQuest() {
    setCreating(true)
    const res  = await fetch('/api/admin/quests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.quest) {
      setQuests(q => [...q, data.quest])
      setShowForm(false)
      setForm({ internal_code: '', title: '', description: '',
        difficulty: 'easy', quest_type: 'daily',
        energy_cost: 5, xp_reward: 80, icon_key: '⚔️',
        verification_type: 'none', verification_value: '' })
    }
    setCreating(false)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px',
    color: 'white', fontSize: 13, width: '100%',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Quest Templates</h2>
        <button onClick={() => setShowForm(!showForm)}
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          + Neue Quest
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Neue Quest erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'internal_code', label: 'Code (z.B. daily_easy_login)' },
              { key: 'title',         label: 'Titel' },
              { key: 'icon_key',      label: 'Icon (Emoji)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Typ</label>
              <select value={form.quest_type} onChange={e => setForm(f => ({ ...f, quest_type: e.target.value }))} style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Schwierigkeit</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} style={inputStyle}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Energie Kosten</label>
              <input type="number" value={form.energy_cost} onChange={e => setForm(f => ({ ...f, energy_cost: parseInt(e.target.value) }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>XP Belohnung</label>
              <input type="number" value={form.xp_reward} onChange={e => setForm(f => ({ ...f, xp_reward: parseInt(e.target.value) }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Verifikation</label>
              <select value={form.verification_type} onChange={e => setForm(f => ({ ...f, verification_type: e.target.value }))} style={inputStyle}>
                <option value="none">Keine</option>
                <option value="telegram_channel">Telegram Kanal folgen</option>
                <option value="streak">Streak Anzahl</option>
                <option value="energy_used">Energie verbraucht</option>
                <option value="quests_done">Quests abgeschlossen</option>
                <option value="xp_earned">XP verdient</option>
              </select>
            </div>
            {form.verification_type !== 'none' && (
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                  {form.verification_type === 'telegram_channel' ? 'Kanal Username (z.B. @vexalgo)' : 'Zielwert'}
                </label>
                <input value={form.verification_value}
                  onChange={e => setForm(f => ({ ...f, verification_value: e.target.value }))}
                  style={inputStyle} />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>Beschreibung</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={createQuest} disabled={creating}
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
              {creating ? 'Erstelle...' : '✓ Quest erstellen'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '8px 16px', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: 'pointer',
              }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Quest List */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40 }}>Lade...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quests.map(q => (
            <div key={q.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 10,
              background: q.is_active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
              border: `1px solid ${q.is_active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              opacity: q.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span>{q.icon_key}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{q.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {q.quest_type} · {q.difficulty} · {q.energy_cost}⚡ · +{q.xp_reward}XP
                    {q.metadata?.verification_type && q.metadata.verification_type !== 'none' && (
                      <span style={{ color: '#A855F7', marginLeft: 6 }}>
                        · 🔍 {q.metadata.verification_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => toggleActive(q.id, q.is_active)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: q.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                  border: `1px solid ${q.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                  color: q.is_active ? '#10B981' : '#F43F5E',
                }}>
                {q.is_active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── User Manager ─────────────────────────────────────────────
function UserManager() {
  const [search, setSearch] = useState('')
  const [users, setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function searchUsers() {
    if (!search.trim()) return
    setLoading(true)
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`)
    const json = await res.json()
    setUsers(json.users ?? [])
    setLoading(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Nutzer suchen</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchUsers()}
          placeholder="Username oder Name..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px',
            color: 'white', fontSize: 13,
          }} />
        <button onClick={searchUsers}
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          Suchen
        </button>
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Suche...</p>}

      {users.map(u => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 10, marginBottom: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {u.telegram_first_name} {u.telegram_last_name ?? ''}
              {u.telegram_username && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 6 }}>
                  @{u.telegram_username}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Lv.{u.level} · {u.league} · {formatNumber(u.season_xp)} Season XP
              {u.is_banned && <span style={{ color: '#F43F5E', marginLeft: 8 }}>🚫 Gesperrt</span>}
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            ID: {u.telegram_id}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Transaction Manager ───────────────────────────────────────
function TxManager() {
  const [txs, setTxs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/transactions').then(r => r.json())
      .then(d => { setTxs(d.transactions ?? []); setLoading(false) })
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>TON Transaktionen</h2>
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.3)' }}>Lade...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {txs.map((tx: any) => (
            <div key={tx.id} style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>
                    {tx.tx_hash?.slice(0, 40)}...
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {tx.amount_nano ? `${(tx.amount_nano / 1e9).toFixed(2)} TON` : '—'} ·{' '}
                    {new Date(tx.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: tx.status === 'confirmed' ? 'rgba(16,185,129,0.15)' :
                    tx.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                  color: tx.status === 'confirmed' ? '#10B981' :
                    tx.status === 'pending' ? '#F59E0B' : '#F43F5E',
                }}>
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
