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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const shared_1 = require("@digital-auction/shared");
const mongo_session_1 = require("../../common/mongo/mongo-session");
const ledger_repo_1 = require("./ledger.repo");
const wallet_repo_1 = require("./wallet.repo");
function isDuplicateKeyError(err) {
    return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}
let WalletService = class WalletService {
    connection;
    walletRepo;
    ledgerRepo;
    constructor(connection, walletRepo, ledgerRepo) {
        this.connection = connection;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
    }
    async credit(params) {
        const { entryKey, userId, currency, amount, meta } = params;
        if (amount <= 0)
            throw new Error("credit amount must be > 0");
        await (0, mongo_session_1.runInMongoTransaction)(this.connection, async (session) => {
            await this.walletRepo.ensureWallet(userId, currency, session);
            try {
                await this.ledgerRepo.createEntry({
                    entryKey,
                    userId,
                    currency,
                    type: shared_1.LedgerEntryType.CREDIT,
                    amount,
                    from: shared_1.LedgerBalanceBucket.EXTERNAL,
                    to: shared_1.LedgerBalanceBucket.AVAILABLE,
                    meta,
                }, session);
            }
            catch (e) {
                if (isDuplicateKeyError(e))
                    return;
                throw e;
            }
            await this.walletRepo.moveBalance({ userId, currency, incAvailable: amount, incReserved: 0 }, session);
        });
    }
    async reserve(params) {
        const { entryKey, userId, currency, amount, meta, auctionId, roundId, bidId, bidEventId } = params;
        if (amount <= 0)
            throw new Error("reserve amount must be > 0");
        await (0, mongo_session_1.runInMongoTransaction)(this.connection, async (session) => {
            await this.walletRepo.ensureWallet(userId, currency, session);
            try {
                await this.ledgerRepo.createEntry({
                    entryKey,
                    userId,
                    currency,
                    type: shared_1.LedgerEntryType.RESERVE,
                    amount,
                    from: shared_1.LedgerBalanceBucket.AVAILABLE,
                    to: shared_1.LedgerBalanceBucket.RESERVED,
                    auctionId,
                    roundId,
                    bidId,
                    bidEventId,
                    meta,
                }, session);
            }
            catch (e) {
                if (isDuplicateKeyError(e))
                    return;
                throw e;
            }
            const updated = await this.walletRepo.moveBalance({
                userId,
                currency,
                incAvailable: -amount,
                incReserved: +amount,
                requireAvailableGte: amount,
            }, session);
            if (!updated)
                throw new shared_1.InsufficientBalanceError();
        });
    }
    async release(params) {
        const { entryKey, userId, currency, amount, meta, auctionId, roundId, bidId } = params;
        if (amount <= 0)
            throw new Error("release amount must be > 0");
        await (0, mongo_session_1.runInMongoTransaction)(this.connection, async (session) => {
            await this.walletRepo.ensureWallet(userId, currency, session);
            try {
                await this.ledgerRepo.createEntry({
                    entryKey,
                    userId,
                    currency,
                    type: shared_1.LedgerEntryType.RELEASE,
                    amount,
                    from: shared_1.LedgerBalanceBucket.RESERVED,
                    to: shared_1.LedgerBalanceBucket.AVAILABLE,
                    auctionId,
                    roundId,
                    bidId,
                    meta,
                }, session);
            }
            catch (e) {
                if (isDuplicateKeyError(e))
                    return;
                throw e;
            }
            const updated = await this.walletRepo.moveBalance({
                userId,
                currency,
                incAvailable: +amount,
                incReserved: -amount,
                requireReservedGte: amount,
            }, session);
            if (!updated)
                throw new Error("Reserved balance is insufficient for release");
        });
    }
    async capture(params) {
        const { entryKey, userId, currency, amount, meta, auctionId, roundId, bidId } = params;
        if (amount <= 0)
            throw new Error("capture amount must be > 0");
        await (0, mongo_session_1.runInMongoTransaction)(this.connection, async (session) => {
            await this.walletRepo.ensureWallet(userId, currency, session);
            try {
                await this.ledgerRepo.createEntry({
                    entryKey,
                    userId,
                    currency,
                    type: shared_1.LedgerEntryType.CAPTURE,
                    amount,
                    from: shared_1.LedgerBalanceBucket.RESERVED,
                    to: shared_1.LedgerBalanceBucket.SINK,
                    auctionId,
                    roundId,
                    bidId,
                    meta,
                }, session);
            }
            catch (e) {
                if (isDuplicateKeyError(e))
                    return;
                throw e;
            }
            const updated = await this.walletRepo.moveBalance({
                userId,
                currency,
                incAvailable: 0,
                incReserved: -amount,
                requireReservedGte: amount,
            }, session);
            if (!updated)
                throw new Error("Reserved balance is insufficient for capture");
        });
    }
    async runInTx(fn) {
        return (0, mongo_session_1.runInMongoTransaction)(this.connection, fn);
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection,
        wallet_repo_1.WalletRepo,
        ledger_repo_1.LedgerRepo])
], WalletService);
