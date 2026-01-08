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
exports.WalletRepo = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_schema_1 = require("./wallet.schema");
let WalletRepo = class WalletRepo {
    walletModel;
    constructor(walletModel) {
        this.walletModel = walletModel;
    }
    async findByUserCurrency(userId, currency, session) {
        return this.walletModel.findOne({ userId, currency }).session(session ?? null).exec();
    }
    async ensureWallet(userId, currency, session) {
        const doc = await this.walletModel
            .findOneAndUpdate({ userId, currency }, { $setOnInsert: { userId, currency, available: 0, reserved: 0, version: 0 } }, { upsert: true, new: true, session })
            .exec();
        return doc;
    }
    async moveBalance(params, session) {
        const { userId, currency, incAvailable, incReserved, requireAvailableGte, requireReservedGte } = params;
        const filter = { userId, currency };
        if (typeof requireAvailableGte === "number") {
            filter.available = { $gte: requireAvailableGte };
        }
        if (typeof requireReservedGte === "number") {
            filter.reserved = { $gte: requireReservedGte };
        }
        return this.walletModel
            .findOneAndUpdate(filter, { $inc: { available: incAvailable, reserved: incReserved, version: 1 } }, { new: true, session })
            .exec();
    }
};
exports.WalletRepo = WalletRepo;
exports.WalletRepo = WalletRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wallet_schema_1.WalletModel.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], WalletRepo);
