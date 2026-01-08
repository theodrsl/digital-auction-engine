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
exports.RoundSchema = exports.RoundModel = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const shared_1 = require("@digital-auction/shared");
let RoundModel = class RoundModel {
    auctionId;
    no;
    status;
    startAt;
    endAt;
    antiSnipe;
    closeJobId;
    closedAt;
};
exports.RoundModel = RoundModel;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoundModel.prototype, "auctionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], RoundModel.prototype, "no", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, enum: Object.values(shared_1.RoundStatus) }),
    __metadata("design:type", String)
], RoundModel.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], RoundModel.prototype, "startAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], RoundModel.prototype, "endAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            totalExtendedSec: { type: Number, required: true, default: 0 },
        },
        required: true,
        default: { totalExtendedSec: 0 },
    }),
    __metadata("design:type", Object)
], RoundModel.prototype, "antiSnipe", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], RoundModel.prototype, "closeJobId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], RoundModel.prototype, "closedAt", void 0);
exports.RoundModel = RoundModel = __decorate([
    (0, mongoose_1.Schema)({ collection: 'rounds', timestamps: true })
], RoundModel);
exports.RoundSchema = mongoose_1.SchemaFactory.createForClass(RoundModel);
exports.RoundSchema.index({ auctionId: 1, no: 1 }, { unique: true });
exports.RoundSchema.index({ auctionId: 1, status: 1, endAt: 1 });
