// src/components/clan/ClanEditSheet.tsx — Clan bearbeiten (Leader)
// Avatar hochladen/entfernen + Beschreibung speichern/leeren. Bild wird
// clientseitig auf 256×256 (center-crop) verkleinert -> winzige Payload.

'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore }   from '@/stores/useUIStore'
import { BottomSheet }  from '@/components/ui/BottomSheet'
import { Button }       from '@/components/ui/Button'
import { Camera, Trash2 } from 'lucide-react'

const DESC_MAX = 280

function initials(name?: string) { return (name?.trim()?.[0] ?? 'C').toUpperCase() }

// Datei -> quadratisches 256er JPEG als Data-URL (center-crop "cover").
function resizeToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas')); return }
      const min = Math.min(img.width, img.height)
      const sx  = (img.width - min) / 2
      const sy  = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

export function ClanEditSheet({ clanId, open, onClose }: {
  clanId: string; open: boolean; onClose: () => void
}) {
  const token  = useAuthStore(s => s.accessToken)
  const toast  = useUIStore(s => s.toast)
  const haptic = useUIStore(s => s.haptic)
  const qc     = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [desc, setDesc] = useState('')

  const { data } = useQuery({
    queryKey: ['clan-edit', clanId],
    enabled:  open && !!token && !!clanId,
    staleTime: 0,
    queryFn: async () => {
      const res  = await fetch(`/api/v1/clans/${clanId}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      const c = json?.data?.clan
      return { name: c?.name as string, description: (c?.description as string) ?? '', avatarUrl: (c?.avatar_url as string | null) ?? null }
    },
  })

  useEffect(() => { if (data) setDesc(data.description ?? '') }, [data])

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['clan-edit', clanId] }),
      qc.invalidateQueries({ queryKey: ['my-membership'] }),
      qc.invalidateQueries({ queryKey: ['clans'] }),
    ])
  }

  const upload = useMutation({
    mutationFn: async (dataUrl: string) => {
      const res  = await fetch(`/api/v1/clans/${clanId}/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => { toast('success', 'Picture updated'); haptic?.('success'); await refresh() },
    onError: (e: Error) => toast('error', e.message),
  })

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const res  = await fetch(`/api/v1/clans/${clanId}/avatar`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => { toast('info', 'Picture removed'); await refresh() },
    onError: (e: Error) => toast('error', e.message),
  })

  const saveDesc = useMutation({
    mutationFn: async () => {
      const res  = await fetch(`/api/v1/clans/${clanId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: async () => { toast('success', 'Description saved'); haptic?.('light'); await refresh() },
    onError: (e: Error) => toast('error', e.message),
  })

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // erneutes Wählen desselben Files erlauben
    if (!file) return
    try {
      const dataUrl = await resizeToDataUrl(file)
      upload.mutate(dataUrl)
    } catch { toast('error', 'Could not read that image') }
  }

  const avatarUrl = data?.avatarUrl ?? null
  const busy = upload.isPending || removeAvatar.isPending

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit clan">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-3xl shrink-0 flex items-center justify-center overflow-hidden display-xl text-2xl text-white"
          style={{ background: 'var(--aurora)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : initials(data?.name)}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <Button size="sm" variant="secondary" loading={upload.isPending} disabled={busy}
            onClick={() => fileRef.current?.click()}>
            <Camera size={15} /> {avatarUrl ? 'Change picture' : 'Upload picture'}
          </Button>
          {avatarUrl && (
            <button onClick={() => removeAvatar.mutate()} disabled={busy}
              className="press inline-flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-xl disabled:opacity-40"
              style={{ color: 'var(--rose)', background: 'rgba(251,113,133,0.12)', fontFamily: 'var(--font-display)' }}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Description</p>
          <span className="text-[10px] tabular-nums" style={{ color: desc.length > DESC_MAX - 20 ? 'var(--rose)' : 'var(--text-faint)' }}>
            {desc.length}/{DESC_MAX}
          </span>
        </div>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value.slice(0, DESC_MAX))}
          rows={3}
          placeholder="What's your clan about?"
          className="w-full rounded-2xl px-3.5 py-3 text-sm text-white placeholder-white/25 focus:outline-none resize-none"
          style={{ background: 'var(--surface-1)', boxShadow: 'inset 0 1px 0 var(--edge-light)' }}
        />
        <div className="flex gap-2">
          <Button fullWidth size="sm" loading={saveDesc.isPending}
            onClick={() => saveDesc.mutate()}>Save</Button>
          {desc.length > 0 && (
            <Button size="sm" variant="ghost" disabled={saveDesc.isPending}
              onClick={() => setDesc('')}>Clear</Button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
