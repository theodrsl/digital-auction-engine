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
exports.LedgerEntrySchema = exports.LedgerEntryModel = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const shared_1 = require("@digital-auction/shared");
let LedgerEntryModel = class LedgerEntryModel {
    entryKey;
    userId;
    currency;
    type;
    amount;
    from;
    to;
    auctionId;
    roundId;
    bidId;
    bidEventId;
    meta;
};
exports.LedgerEntryModel = LedgerEntryModel;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "entryKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, enum: Object.values(shared_1.LedgerEntryType) }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], LedgerEntryModel.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, enum: Object.values(shared_1.LedgerBalanceBucket) }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "from", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, enum: Object.values(shared_1.LedgerBalanceBucket) }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "to", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "auctionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "roundId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "bidId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], LedgerEntryModel.prototype, "bidEventId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], LedgerEntryModel.prototype, "meta", void 0);
exports.LedgerEntryModel = LedgerEntryModel = __decorate([
    (0, mongoose_1.Schema)({ collection: "ledger_entries", timestamps: { createdAt: true, updatedAt: false } })
], LedgerEntryModel);
exports.LedgerEntrySchema = mongoose_1.SchemaFactory.createForClass(LedgerEntryModel);
exports.LedgerEntrySchema.index({ entryKey: 1 }, { unique: true });
exports.LedgerEntrySchema.index({ userId: 1, currency: 1, createdAt: -1 });
exports.LedgerEntrySchema.index({ auctionId: 1, roundId: 1, createdAt: -1 });
exports.LedgerEntrySchema.index({ bidId: 1, createdAt: -1 });
