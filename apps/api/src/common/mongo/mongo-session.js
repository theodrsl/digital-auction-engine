"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInMongoTransaction = runInMongoTransaction;
async function runInMongoTransaction(connection, fn) {
    const session = await connection.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await fn(session);
        });
        return result;
    }
    finally {
        await session.endSession();
    }
}
