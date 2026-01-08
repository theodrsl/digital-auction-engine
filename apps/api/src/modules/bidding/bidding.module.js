"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const wallet_module_1 = require("../wallet/wallet.module");
const round_module_1 = require("../round/round.module");
const bid_schema_1 = require("./bid.schema");
const bid_event_schema_1 = require("./bid-event.schema");
const bid_repo_1 = require("./bid.repo");
const bid_event_repo_1 = require("./bid-event.repo");
const bidding_service_1 = require("./bidding.service");
const bidding_controller_1 = require("./bidding.controller");
let BiddingModule = class BiddingModule {
};
exports.BiddingModule = BiddingModule;
exports.BiddingModule = BiddingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: bid_schema_1.BidModel.name, schema: bid_schema_1.BidSchema },
                { name: bid_event_schema_1.BidEventModel.name, schema: bid_event_schema_1.BidEventSchema },
            ]),
            wallet_module_1.WalletModule,
            round_module_1.RoundModule,
        ],
        controllers: [bidding_controller_1.BiddingController],
        providers: [bid_repo_1.BidRepo, bid_event_repo_1.BidEventRepo, bidding_service_1.BiddingService],
        exports: [bidding_service_1.BiddingService],
    })
], BiddingModule);
