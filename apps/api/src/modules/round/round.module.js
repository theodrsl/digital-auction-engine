"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoundModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const round_schema_1 = require("./round.schema");
const round_repo_1 = require("./round.repo");
let RoundModule = class RoundModule {
};
exports.RoundModule = RoundModule;
exports.RoundModule = RoundModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: round_schema_1.RoundModel.name, schema: round_schema_1.RoundSchema }])],
        providers: [round_repo_1.RoundRepo],
        exports: [round_repo_1.RoundRepo],
    })
], RoundModule);
