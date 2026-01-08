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
exports.RoundRepo = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const round_schema_1 = require("./round.schema");
const shared_1 = require("@digital-auction/shared");
let RoundRepo = class RoundRepo {
    roundModel;
    constructor(roundModel) {
        this.roundModel = roundModel;
    }
    async findById(roundId, session) {
        return this.roundModel.findById(new mongoose_2.Types.ObjectId(roundId)).session(session ?? null).exec();
    }
    /**
     * Anti-sniping extension: атомарно продлевает endAt, если раунд всё ещё OPEN
     * и если текущее endAt <= threshold (то есть мы действительно в "окне").
     */
    async maybeExtendEndAt(params, session) {
        const { roundId, now, windowMs, extendMs, maxTotalExtendMs } = params;
        const roundObjectId = new mongoose_2.Types.ObjectId(roundId);
        // Мы продлеваем только если осталось <= windowMs.
        // И не превышаем maxTotalExtendMs.
        const doc = await this.roundModel.findOneAndUpdate({
            _id: roundObjectId,
            status: shared_1.RoundStatus.OPEN,
            endAt: { $lte: new Date(now.getTime() + windowMs) },
            'antiSnipe.totalExtendedSec': { $lte: Math.floor(maxTotalExtendMs / 1000) - Math.floor(extendMs / 1000) },
        }, {
            $set: { endAt: new Date(now.getTime() + extendMs + windowMs) }, // (см. ниже пояснение)
            $inc: { 'antiSnipe.totalExtendedSec': Math.floor(extendMs / 1000) },
        }, { new: true, session }).exec();
        if (!doc)
            return { extended: false };
        return { extended: true, newEndAt: doc.endAt };
    }
};
exports.RoundRepo = RoundRepo;
exports.RoundRepo = RoundRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(round_schema_1.RoundModel.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], RoundRepo);
