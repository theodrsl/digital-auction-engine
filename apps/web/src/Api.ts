export type CreateAuctionBody = {
  currency: string
  roundDurationSec: number
  winnersPerRound: number
  maxRounds: number
  antiSnipe?: {
    windowSec: number
    extendSec: number
    maxTotalExtendSec: number
  }
  item?: {
    kind: 'TELEGRAM_GIFT' | 'NFT'
    name: string
    collection?: string
    totalSupply: number
  }
}

export type PlaceBidBody = {
  auctionId: string
  roundId: string
  userId: string
  currency: string
  amount: number
  idempotencyKey: string
}

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      text ||
      `${res.status} ${res.statusText}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }

  return json as T
}

export const api = {
  listAuctions: () => http<any>('GET', `/auctions`),
  getAuction: (auctionId: string) => http<any>('GET', `/auctions/${auctionId}`),
  createAuction: (body: CreateAuctionBody) => http<any>('POST', `/auctions`, body),
  leaderboard: (auctionId: string, limit = 20) =>
    http<any>('GET', `/auctions/${auctionId}/leaderboard?limit=${limit}`),
  placeBid: (body: PlaceBidBody) => http<any>('POST', `/bids`, body),

  // NEW:
  getWallets: (userId: string, currency?: string) =>
    http<{ wallets: any[] }>(
      'GET',
      `/wallets/${encodeURIComponent(userId)}${
        currency ? `?currency=${encodeURIComponent(currency)}` : ''
      }`,
    ),

  getInventory: (userId: string, auctionId?: string, limit = 50) => {
    const qs = new URLSearchParams()
    if (auctionId) qs.set('auctionId', auctionId)
    qs.set('limit', String(limit))
    return http<{ items: any[] }>(
      'GET',
      `/inventory/${encodeURIComponent(userId)}?${qs.toString()}`,
    )
  },
}
