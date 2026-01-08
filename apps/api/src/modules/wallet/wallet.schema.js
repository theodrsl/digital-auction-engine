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
exports.WalletSchema = exports.WalletModel = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let WalletModel = class WalletModel {
    userId;
    currency;
    available;
    reserved;
    version;
};
exports.WalletModel = WalletModel;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], WalletModel.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], WalletModel.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, default: 0 }),
    __metadata("design:type", Number)
], WalletModel.prototype, "available", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, default: 0 }),
    __metadata("design:type", Number)
], WalletModel.prototype, "reserved", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, default: 0 }),
    __metadata("design:type", Number)
], WalletModel.prototype, "version", void 0);
exports.WalletModel = WalletModel = __decorate([
    (0, mongoose_1.Schema)({ collection: "wallets", timestamps: true })
], WalletModel);
exports.WalletSchema = mongoose_1.SchemaFactory.createForClass(WalletModel);
exports.WalletSchema.index({ userId: 1, currency: 1 }, { unique: true });
exports.WalletSchema.index({ userId: 1, currency: 1, available: 1 });
