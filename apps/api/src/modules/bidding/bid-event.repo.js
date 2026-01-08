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
exports.BidEventRepo = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bid_event_schema_1 = require("./bid-event.schema");
let BidEventRepo = class BidEventRepo {
    bidEventModel;
    constructor(bidEventModel) {
        this.bidEventModel = bidEventModel;
    }
    async findByIdempotency(params, session) {
        return this.bidEventModel.findOne({
            auctionId: new mongoose_2.Types.ObjectId(params.auctionId),
            userId: params.userId,
            idempotencyKey: params.idempotencyKey,
        }).session(session ?? null).exec();
    }
    async create(params, session) {
        const doc = await this.bidEventModel.create([{
                auctionId: new mongoose_2.Types.ObjectId(params.auctionId),
                roundId: new mongoose_2.Types.ObjectId(params.roundId),
                userId: params.userId,
                idempotencyKey: params.idempotencyKey,
                prevAmount: params.prevAmount,
                newAmount: params.newAmount,
                delta: params.delta,
            }], { session });
        return doc[0];
    }
};
exports.BidEventRepo = BidEventRepo;
exports.BidEventRepo = BidEventRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(bid_event_schema_1.BidEventModel.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], BidEventRepo);
