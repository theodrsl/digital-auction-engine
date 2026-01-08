"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const shared_1 = require("@digital-auction/shared");
const wallet_service_1 = require("../wallet/wallet.service");
const round_repo_1 = require("../round/round.repo");
const bid_repo_1 = require("./bid.repo");
const bid_event_repo_1 = require("./bid-event.repo");
function isDuplicateKeyError(err) {
    return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
let BiddingService = class BiddingService {
    walletService;
    roundRepo;
    bidRepo;
    bidEventRepo;
    constructor(walletService, roundRepo, bidRepo, bidEventRepo) {
        this.walletService = walletService;
        this.roundRepo = roundRepo;
        this.bidRepo = bidRepo;
        this.bidEventRepo = bidEventRepo;
    }
    /**
     * placeBid: 1 активная ставка на пользователя на весь аукцион.
     * idempotencyKey обязателен.
     */
    async placeBid(params) {
        const now = new Date();
        if (!params.idempotencyKey)
            throw new Error('idempotencyKey is required');
        if (params.amount <= 0)
            throw new shared_1.InvalidBidError('amount must be > 0');
        // единая транзакция: event + reserve + bid update + round extension
        return this.walletService.runInTx(async (session) => {
            // 0) идемпотентность на входе
            const existingEvent = await this.bidEventRepo.findByIdempotency({ auctionId: params.auctionId, userId: params.userId, idempotencyKey: params.idempotencyKey }, session);
            if (existingEvent) {
                // Мы не восстанавливаем bidId тут (можно расширить), но возвращаем факт.
                return {
                    bidId: '',
                    prevAmount: existingEvent.prevAmount,
                    newAmount: existingEvent.newAmount,
                    delta: existingEvent.delta,
                    roundExtended: false,
                };
            }
            // 1) round checks
            const round = await this.roundRepo.findById(params.roundId, session);
            if (!round)
                throw new Error('Round not found');
            if (round.status !== 'OPEN')
                throw new Error('Round is not OPEN');
            if (now >= round.endAt)
                throw new Error('Round already ended');
            // 2) find/create bid
            const existingBid = await this.bidRepo.findByAuctionUser({ auctionId: params.auctionId, userId: params.userId }, session);
            const prevAmount = existingBid?.amount ?? 0;
            if (params.amount <= prevAmount) {
                throw new shared_1.InvalidBidError('new amount must be greater than previous amount');
            }
            const delta = params.amount - prevAmount;
            // 3) create bid_event first (idempotent by unique index)
            let bidEventId;
            try {
                const ev = await this.bidEventRepo.create({
                    auctionId: params.auctionId,
                    roundId: params.roundId,
                    userId: params.userId,
                    idempotencyKey: params.idempotencyKey,
                    prevAmount,
                    newAmount: params.amount,
                    delta,
                }, session);
                bidEventId = ev._id.toString();
            }
            catch (e) {
                if (isDuplicateKeyError(e)) {
                    // если параллельно такой же ключ прилетел — читаем и возвращаем
                    const ev = await this.bidEventRepo.findByIdempotency({ auctionId: params.auctionId, userId: params.userId, idempotencyKey: params.idempotencyKey }, session);
                    if (!ev)
                        throw e;
                    return {
                        bidId: '',
                        prevAmount: ev.prevAmount,
                        newAmount: ev.newAmount,
                        delta: ev.delta,
                        roundExtended: false,
                    };
                }
                throw e;
            }
            // 4) reserve delta
            await this.walletService.reserve({
                entryKey: `reserve:${params.auctionId}:${params.userId}:${bidEventId}`,
                userId: params.userId,
                currency: params.currency,
                amount: delta,
                auctionId: params.auctionId,
                roundId: params.roundId,
                bidEventId,
            });
            // 5) write/update bid
            let bidId;
            if (!existingBid) {
                const created = await this.bidRepo.create(
                // currentRoundId = roundId, status ACTIVE
                {
                    auctionId: params.auctionId,
                    roundId: params.roundId,
                    userId: params.userId,
                    currency: params.currency,
                    amount: params.amount,
                    now,
                }, session);
                bidId = created._id.toString();
            }
            else {
                // optional: ensure currency is same
                if (existingBid.currency !== params.currency) {
                    throw new Error('Currency mismatch for existing bid');
                }
                const ok = await this.bidRepo.updateAmountCAS({
                    bidId: new mongoose_1.Types.ObjectId(existingBid._id),
                    expectedVersion: existingBid.version,
                    newAmount: params.amount,
                    now,
                }, session);
                if (!ok) {
                    // конфликт обновления — безопаснее отдать 409 и пусть клиент ретраит с новым состоянием
                    throw new Error('Concurrent bid update (retry)');
                }
                bidId = existingBid._id.toString();
            }
            // 6) anti-snipe (в той же транзакции)
            const windowMs = params.antiSnipe.windowSec * 1000;
            const extendMs = params.antiSnipe.extendSec * 1000;
            const maxTotalExtendMs = params.antiSnipe.maxTotalExtendSec * 1000;
            const { extended, newEndAt } = await this.roundRepo.maybeExtendEndAt({
                roundId: params.roundId,
                now,
                windowMs,
                extendMs,
                maxTotalExtendMs,
            }, session);
            return {
                bidId,
                prevAmount,
                newAmount: params.amount,
                delta,
                roundExtended: extended,
                newRoundEndAt: newEndAt,
            };
        });
    }
};
exports.BiddingService = BiddingService;
exports.BiddingService = BiddingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wallet_service_1.WalletService,
        round_repo_1.RoundRepo,
        bid_repo_1.BidRepo,
        bid_event_repo_1.BidEventRepo])
], BiddingService);
