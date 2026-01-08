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
exports.BiddingController = void 0;
const common_1 = require("@nestjs/common");
const place_bid_dto_1 = require("./dto/place-bid.dto");
const bidding_service_1 = require("./bidding.service");
let BiddingController = class BiddingController {
    biddingService;
    constructor(biddingService) {
        this.biddingService = biddingService;
    }
    async placeBid(dto) {
        return this.biddingService.placeBid({
            auctionId: dto.auctionId,
            roundId: dto.roundId,
            userId: dto.userId,
            currency: dto.currency,
            amount: dto.amount,
            idempotencyKey: dto.idempotencyKey,
            antiSnipe: {
                windowSec: 10,
                extendSec: 10,
                maxTotalExtendSec: 60,
            },
        });
    }
};
exports.BiddingController = BiddingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [place_bid_dto_1.PlaceBidDto]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "placeBid", null);
exports.BiddingController = BiddingController = __decorate([
    (0, common_1.Controller)('bids'),
    __metadata("design:paramtypes", [bidding_service_1.BiddingService])
], BiddingController);
