import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './Api'
import type { CreateAuctionBody } from './Api'

function uuid() {
  const c = (globalThis as any)?.crypto
  const v = c?.randomUUID?.()
  return v ?? `${Date.now()}-${Math.random()}`
}

type BotState = {
  running: boolean
  count: number
  minAmount: number
  maxAmount: number
  rps: number
}

function safeId(x: any): string {
  return String(x?.auctionId || x?.id || x?._id || x || '')
}

function safeRoundId(auction: any): string {
  const r = auction?.activeRound
  return String(r?.id || r?._id || r || '')
}

function clip(s: string, n = 10) {
  if (!s) return ''
  return s.length <= n ? s : `${s.slice(0, n)}…`
}

function statusDot(status: string): 'ok' | 'warn' | 'bad' {
  const s = (status || '').toUpperCase()
  if (s.includes('OPEN') || s.includes('LIVE')) return 'ok'
  if (s.includes('CLOSE') || s.includes('FINISH')) return 'warn'
  return 'bad'
}

function fmtTime(x: any) {
  try {
    const d = new Date(x)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
  } catch {
    return ''
  }
}

function pickWalletNumbers(w: any) {
  const keys = ['available', 'reserved', 'external', 'sink', 'version']
  const out: Record<string, number> = {}
  for (const k of keys) {
    if (typeof w?.[k] === 'number') out[k] = w[k]
  }
  return out
}

function normalizeLeaderboard(raw: any): Array<{ userId: string; amount: number; rank: number }> {
  const arr: any[] = Array.isArray(raw) ? raw : (raw?.items ?? raw?.entries ?? raw?.leaderboard ?? [])
  const rows = arr
    .map((x, i) => ({
      userId: String(x?.userId ?? x?.uid ?? x?.user ?? x?.id ?? ''),
      amount: Number(x?.amount ?? x?.bidAmount ?? x?.value ?? 0),
      rank: Number(x?.rank ?? (i + 1)),
    }))
    .filter((x) => x.userId)
    .sort((a, b) => a.rank - b.rank)
  return rows
}

export default function App() {
  const [auctions, setAuctions] = useState<any[]>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('')

  const [auction, setAuction] = useState<any | null>(null)
  const [leaderboardRaw, setLeaderboardRaw] = useState<any | null>(null)

  const [wallets, setWallets] = useState<any[] | null>(null)
  const [inventory, setInventory] = useState<any[] | null>(null)

  const [error, setError] = useState<string>('')

  const [createForm, setCreateForm] = useState<CreateAuctionBody>({
    currency: 'TON',
    roundDurationSec: 60,
    winnersPerRound: 10,
    maxRounds: 1,
    antiSnipe: { windowSec: 10, extendSec: 10, maxTotalExtendSec: 120 },
    item: { kind: 'TELEGRAM_GIFT', name: 'Limited Gift', totalSupply: 100 },
  })

  const [userId, setUserId] = useState('u1')
  const [bidAmount, setBidAmount] = useState(100)

  const [bots, setBots] = useState<BotState>({
    running: false,
    count: 20,
    minAmount: 1,
    maxAmount: 500,
    rps: 15,
  })

  const botTimerRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  const roundId = useMemo(() => safeRoundId(auction), [auction])

  const auctionStatus = useMemo(() => {
    const s =
      auction?.status ||
      auction?.state ||
      auction?.activeRound?.status ||
      auction?.activeRound?.state ||
      ''
    return String(s || '')
  }, [auction])

  const dotKind = statusDot(auctionStatus)
  const canBid = Boolean(selectedAuctionId && roundId)

  const leaderboard = useMemo(() => normalizeLeaderboard(leaderboardRaw), [leaderboardRaw])

  const loadAuctions = useCallback(async () => {
    try {
      setError('')
      const list = await api.listAuctions()
      const arr = Array.isArray(list) ? list : (list?.items ?? [])
      setAuctions(arr)

      if (!selectedAuctionId) {
        const first = arr?.[0]
        const id = safeId(first?._id || first?.id || first)
        if (id) setSelectedAuctionId(id)
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }, [selectedAuctionId])

  const refreshAll = useCallback(
    async (auctionId: string) => {
      try {
        setError('')
        const a = await api.getAuction(auctionId)
        setAuction(a)

        const [lb, w, inv] = await Promise.all([
          api.leaderboard(auctionId, 20).catch(() => null),
          api.getWallets(userId, createForm.currency).catch(() => ({ wallets: [] })),
          api.getInventory(userId, auctionId, 50).catch(() => ({ items: [] })),
        ])

        setLeaderboardRaw(lb)
        setWallets(w.wallets || [])
        setInventory(inv.items || [])
      } catch (e: any) {
        setError(e?.message || String(e))
      }
    },
    [userId, createForm.currency]
  )

  useEffect(() => {
    loadAuctions()
  }, [loadAuctions])

  useEffect(() => {
    if (!selectedAuctionId) return

    refreshAll(selectedAuctionId)

    if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = window.setInterval(() => refreshAll(selectedAuctionId), 1500)

    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [selectedAuctionId, refreshAll])

  function stopBots() {
    if (botTimerRef.current) window.clearInterval(botTimerRef.current)
    botTimerRef.current = null
    setBots((b) => ({ ...b, running: false }))
  }

  function startBots() {
    if (!selectedAuctionId || !roundId) {
      setError('Select auction with active round first')
      return
    }
    setError('')
    stopBots()

    const botIds = Array.from({ length: bots.count }, (_, i) => `bot${i + 1}`)
    const tickMs = 200
    const perTick = Math.max(1, Math.round((bots.rps * tickMs) / 1000))

    botTimerRef.current = window.setInterval(async () => {
      const jobs: Promise<any>[] = []
      for (let i = 0; i < perTick; i++) {
        const u = botIds[Math.floor(Math.random() * botIds.length)]
        const amt =
          bots.minAmount +
          Math.floor(Math.random() * Math.max(1, bots.maxAmount - bots.minAmount + 1))

        jobs.push(
          api
            .placeBid({
              auctionId: selectedAuctionId,
              roundId,
              userId: u,
              currency: createForm.currency,
              amount: amt,
              idempotencyKey: uuid(),
            })
            .catch(() => null)
        )
      }
      await Promise.all(jobs)
    }, tickMs)

    setBots((b) => ({ ...b, running: true }))
  }

  useEffect(() => {
    return () => {
      stopBots()
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
    }
  }, [])

  async function onCreateAuction() {
    try {
      setError('')
      const created = await api.createAuction(createForm)
      const id = safeId(created)
      await loadAuctions()
      if (id) setSelectedAuctionId(id)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  async function onPlaceBid() {
    try {
      setError('')
      if (!selectedAuctionId) throw new Error('Select auction')
      if (!roundId) throw new Error('No activeRound.id in /auctions/:id response')

      await api.placeBid({
        auctionId: selectedAuctionId,
        roundId,
        userId,
        currency: createForm.currency,
        amount: bidAmount,
        idempotencyKey: uuid(),
      })

      await refreshAll(selectedAuctionId)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  const item = auction?.item || null
  const distributedSupply = Number(auction?.distributedSupply ?? 0)
  const totalSupply = Number(item?.totalSupply ?? 0)

  const invItems = Array.isArray(inventory) ? inventory : []
  const statusLabel = auctionStatus ? String(auctionStatus) : '—'

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="brandMark" />
          <div className="brandTitle">
            <b>Digital Auction Engine</b>
          </div>
        </div>

        <div className="pillRow">
          <div className="pill" title="Auction status">
            <span className={`dot ${dotKind}`} />
            <span>Status: {statusLabel}</span>
          </div>
          <div className="pill" title="Active user">
            <span className="dot accent" />
            <span>User: {userId}</span>
          </div>
          <div className="pill" title="Selected auction id">
            <span className="dot" />
            <span>Auction: {selectedAuctionId ? clip(selectedAuctionId, 14) : '—'}</span>
          </div>
          <div className="pill" title="Active round id">
            <span className="dot" />
            <span>Round: {roundId ? clip(roundId, 14) : '—'}</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="toast">
          <b>Ошибка:</b> {error}
        </div>
      ) : null}

      <div className="grid">
        <div className="stack">
          <div className="card">
            <div className="cardHeader">
              <h3>Auctions</h3>
              <div className="hint">select + auto refresh</div>
            </div>
            <div className="cardBody">
              <div className="stack">
                <div className="field">
                  <label>Choose auction</label>
                  <select
                    className="select"
                    value={selectedAuctionId}
                    onChange={(e) => setSelectedAuctionId(e.target.value)}
                  >
                    <option value="">(select)</option>
                    {auctions.map((a) => {
                      const id = safeId(a?._id || a?.id || a)
                      return (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="row2">
                  <div className="field">
                    <label>UserId</label>
                    <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <input
                      className="input"
                      value={createForm.currency}
                      onChange={(e) => setCreateForm((s) => ({ ...s, currency: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn" onClick={loadAuctions}>
                    Refresh list
                  </button>
                  <button
                    className="btn btnPrimary"
                    onClick={() => selectedAuctionId && refreshAll(selectedAuctionId)}
                    disabled={!selectedAuctionId}
                  >
                    Refresh state
                  </button>
                </div>

                <div className="kv">
                  <b>API</b>
                  <span>
                    <span className="smallLink">/api</span> (proxy → localhost:3000)
                  </span>
                  <b>UI</b>
                  <span>localhost:5173</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Create auction</h3>
              <div className="hint">includes prize item</div>
            </div>
            <div className="cardBody">
              <div className="stack">
                <div className="row2">
                  <div className="field">
                    <label>roundDurationSec</label>
                    <input
                      className="input"
                      type="number"
                      value={createForm.roundDurationSec}
                      onChange={(e) => setCreateForm((s) => ({ ...s, roundDurationSec: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label>winnersPerRound</label>
                    <input
                      className="input"
                      type="number"
                      value={createForm.winnersPerRound}
                      onChange={(e) => setCreateForm((s) => ({ ...s, winnersPerRound: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="row2">
                  <div className="field">
                    <label>maxRounds</label>
                    <input
                      className="input"
                      type="number"
                      value={createForm.maxRounds}
                      onChange={(e) => setCreateForm((s) => ({ ...s, maxRounds: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label>item.kind</label>
                    <select
                      className="select"
                      value={createForm.item?.kind || 'TELEGRAM_GIFT'}
                      onChange={(e) =>
                        setCreateForm((s) => ({
                          ...s,
                          item: { ...(s.item ?? { name: 'Limited Gift', totalSupply: 100 }), kind: e.target.value as any },
                        }))
                      }
                    >
                      <option value="TELEGRAM_GIFT">TELEGRAM_GIFT</option>
                      <option value="NFT">NFT</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>item.name</label>
                  <input
                    className="input"
                    value={createForm.item?.name ?? 'Limited Gift'}
                    onChange={(e) =>
                      setCreateForm((s) => ({
                        ...s,
                        item: { ...(s.item ?? { kind: 'TELEGRAM_GIFT', totalSupply: 100 }), name: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label>item.totalSupply</label>
                  <input
                    className="input"
                    type="number"
                    value={createForm.item?.totalSupply ?? 100}
                    onChange={(e) =>
                      setCreateForm((s) => ({
                        ...s,
                        item: { ...(s.item ?? { kind: 'TELEGRAM_GIFT', name: 'Limited Gift' }), totalSupply: Number(e.target.value) },
                      }))
                    }
                  />
                </div>

                <div className="actions">
                  <button className="btn btnPrimary" onClick={onCreateAuction}>
                    Create auction
                  </button>
                </div>

                <div className="footerNote">Приз = цифровой подарок/NFT. Деньги используются только как валюта ставок.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Bid</h3>
              <div className="hint">POST /bids</div>
            </div>
            <div className="cardBody">
              <div className="stack">
                <div className="row2">
                  <div className="field">
                    <label>amount</label>
                    <input
                      className="input"
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>roundId</label>
                    <input className="input" value={roundId || ''} disabled />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btnPrimary" onClick={onPlaceBid} disabled={!canBid}>
                    Place bid
                  </button>
                </div>

                <div className="footerNote">Кнопка отключена, если нет active round.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Bot bids</h3>
              <div className="hint">live load</div>
            </div>
            <div className="cardBody">
              <div className="stack">
                <div className="row2">
                  <div className="field">
                    <label>bots</label>
                    <input
                      className="input"
                      type="number"
                      value={bots.count}
                      onChange={(e) => setBots((b) => ({ ...b, count: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label>total RPS</label>
                    <input
                      className="input"
                      type="number"
                      value={bots.rps}
                      onChange={(e) => setBots((b) => ({ ...b, rps: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="row2">
                  <div className="field">
                    <label>min amount</label>
                    <input
                      className="input"
                      type="number"
                      value={bots.minAmount}
                      onChange={(e) => setBots((b) => ({ ...b, minAmount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label>max amount</label>
                    <input
                      className="input"
                      type="number"
                      value={bots.maxAmount}
                      onChange={(e) => setBots((b) => ({ ...b, maxAmount: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btnPrimary" onClick={startBots} disabled={bots.running || !canBid}>
                    Start bots
                  </button>
                  <button className="btn btnDanger" onClick={stopBots} disabled={!bots.running}>
                    Stop bots
                  </button>
                </div>

                <div className="footerNote">Тик 200ms. На тик отправляется пачка запросов, чтобы получился total RPS.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="cardHeader">
              <h3>Prize</h3>
              <div className="hint">auction.item</div>
            </div>
            <div className="cardBody">
              <div className="badgeRow">
                <span className="badge">kind: {item?.kind ?? '—'}</span>
                <span className="badge">name: {item?.name ?? '—'}</span>
                <span className="badge">
                  supply:{' '}
                  {Number.isFinite(totalSupply) && totalSupply > 0 ? `${distributedSupply}/${totalSupply}` : `${distributedSupply}/—`}
                </span>
              </div>
              <div className="footerNote">WIN → деньги CAPTURE в SINK + создаётся delivery (инвентарь). CARRY → деньги RELEASE.</div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Wallet</h3>
              <div className="hint">GET /wallets/:userId</div>
            </div>
            <div className="cardBody">
              <div className="badgeRow">
                {(wallets ?? []).length === 0 ? (
                  <span className="badge">No wallets</span>
                ) : (
                  (wallets ?? []).map((w, idx) => {
                    const currency = String(w?.currency ?? createForm.currency ?? '—')
                    const nums = pickWalletNumbers(w)
                    const avail = nums.available ?? 0
                    const resv = nums.reserved ?? 0
                    const sink = nums.sink ?? 0
                    const ext = nums.external ?? 0

                    return (
                      <span key={`${currency}-${idx}`} className="chip">
                        <span className="dot accent" />
                        <b>{currency}</b>
                        <span className="muted">avail</span> {avail}
                        <span className="muted">res</span> {resv}
                        {Number.isFinite(ext) && ext !== 0 ? (<><span className="muted">ext</span> {ext}</>) : null}
                        {Number.isFinite(sink) && sink !== 0 ? (<><span className="muted">sink</span> {sink}</>) : null}
                      </span>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Inventory</h3>
              <div className="hint">GET /inventory/:userId</div>
            </div>
            <div className="cardBody">
              {invItems.length === 0 ? (
                <div className="badgeRow">
                  <span className="badge">No delivered items yet</span>
                </div>
              ) : (
                <div className="chatList">
                  {invItems.map((x: any) => {
                    const status = String(x?.status ?? '')
                    const tagClass = status === 'DELIVERED' ? 'ok' : status === 'PENDING' ? 'warn' : 'bad'

                    return (
                      <div key={String(x?._id ?? x?.deliveryKey ?? uuid())} className="bubble">
                        <div className="bubbleTop">
                          <div className="bubbleTitle">
                            <span className="dot ok" />
                            <span><b>{String(x?.itemName ?? 'Item')}</b></span>
                            <span className={`tag ${tagClass}`}>{status || '—'}</span>
                          </div>
                          <div className="bubbleMeta">{fmtTime(x?.createdAt)}</div>
                        </div>

                        <div className="bubbleBody">
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="tag">{String(x?.itemKind ?? '—')}</span>
                            {x?.itemCollection ? <span className="tag">{String(x.itemCollection)}</span> : null}
                            {x?.units ? <span className="tag">x{String(x.units)}</span> : null}
                          </div>
                          <div className="muted" style={{ marginTop: 8 }}>
                            allocation:{' '}
                            <span className="codeInline">{clip(String(x?.allocationId ?? ''), 18)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Leaderboard</h3>
              <div className="hint">GET /auctions/:id/leaderboard</div>
            </div>
            <div className="cardBody">
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>User</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="muted">No data</td>
                      </tr>
                    ) : (
                      leaderboard.map((r) => (
                        <tr key={`${r.rank}-${r.userId}`}>
                          <td className="muted">{r.rank}</td>
                          <td>{r.userId}</td>
                          <td className="right">{r.amount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="footerNote">Если leaderboard у тебя другой формы — я подстрою парсер под твой реальный ответ.</div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Live state</h3>
              <div className="hint">GET /auctions/:id (raw)</div>
            </div>
            <div className="cardBody">
              <pre className="pre mono">{auction ? JSON.stringify(auction, null, 2) : 'Select auction…'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
