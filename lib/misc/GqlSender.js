"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GqlSender = void 0;
var gql_1 = require("everscale-standalone-client/client/ConnectionController/gql");
var GqlSender = /** @class */ (function () {
    function GqlSender(params) {
        this.nextLatencyDetectionTime = 0;
        this.params = params;
        this.latencyDetectionInterval = params.latencyDetectionInterval || 60000;
        this.endpoints = params.endpoints.map(gql_1.GqlSocket.expandAddress);
        if (this.endpoints.length === 1) {
            this.currentEndpoint = this.endpoints[0];
            this.nextLatencyDetectionTime = Number.MAX_VALUE;
        }
    }
    GqlSender.prototype.isLocal = function () {
        return this.params.local;
    };
    GqlSender.prototype.send = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var now, endpoint, e_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        endpoint = void 0;
                        if (!(this.currentEndpoint != null && now < this.nextLatencyDetectionTime)) return [3 /*break*/, 2];
                        // Default route
                        endpoint = this.currentEndpoint;
                        return [3 /*break*/, 6];
                    case 2:
                        if (!(this.resolutionPromise != null)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.resolutionPromise];
                    case 3:
                        // Already resolving
                        endpoint = _a.sent();
                        delete this.resolutionPromise;
                        return [3 /*break*/, 6];
                    case 4:
                        delete this.currentEndpoint;
                        // Start resolving (current endpoint is null, or it is time to refresh)
                        this.resolutionPromise = this._selectQueryingEndpoint().then(function (_endpoint) {
                            _this.currentEndpoint = _endpoint;
                            _this.nextLatencyDetectionTime = Date.now() + _this.latencyDetectionInterval;
                            return _endpoint;
                        });
                        return [4 /*yield*/, this.resolutionPromise];
                    case 5:
                        endpoint = _a.sent();
                        delete this.resolutionPromise;
                        _a.label = 6;
                    case 6: return [2 /*return*/, fetch(endpoint, {
                            method: 'post',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: data,
                        }).then(function (response) { return response.json(); })];
                    case 7:
                        e_1 = _a.sent();
                        throw e_1;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    GqlSender.prototype._selectQueryingEndpoint = function () {
        return __awaiter(this, void 0, void 0, function () {
            var maxLatency, endpointCount, _loop_1, this_1, retryCount, state_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        maxLatency = this.params.maxLatency || 60000;
                        endpointCount = this.endpoints.length;
                        _loop_1 = function (retryCount) {
                            var handlers, promise, checkedEndpoints, lastLatency, _loop_2, _i, _b, endpoint, _c, e_2, resolveDelay_1, delayPromise;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        promise = new Promise(function (resolve, reject) {
                                            handlers = {
                                                resolve: function (endpoint) { return resolve(endpoint); },
                                                reject: function () { return reject(undefined); },
                                            };
                                        });
                                        checkedEndpoints = 0;
                                        _loop_2 = function (endpoint) {
                                            gql_1.GqlSocket.checkLatency(endpoint).then(function (latency) {
                                                ++checkedEndpoints;
                                                if (latency !== undefined && latency <= maxLatency) {
                                                    return handlers.resolve(endpoint);
                                                }
                                                if (lastLatency === undefined ||
                                                    lastLatency.latency === undefined ||
                                                    (latency !== undefined && latency < lastLatency.latency)) {
                                                    lastLatency = { endpoint: endpoint, latency: latency };
                                                }
                                                if (checkedEndpoints >= endpointCount) {
                                                    if ((lastLatency === null || lastLatency === void 0 ? void 0 : lastLatency.latency) !== undefined) {
                                                        handlers.resolve(lastLatency.endpoint);
                                                    }
                                                    else {
                                                        handlers.reject();
                                                    }
                                                }
                                            });
                                        };
                                        for (_i = 0, _b = this_1.endpoints; _i < _b.length; _i++) {
                                            endpoint = _b[_i];
                                            _loop_2(endpoint);
                                        }
                                        _d.label = 1;
                                    case 1:
                                        _d.trys.push([1, 3, , 5]);
                                        _c = {};
                                        return [4 /*yield*/, promise];
                                    case 2: return [2 /*return*/, (_c.value = _d.sent(), _c)];
                                    case 3:
                                        e_2 = _d.sent();
                                        delayPromise = new Promise(function (resolve) {
                                            resolveDelay_1 = function () { return resolve(); };
                                        });
                                        setTimeout(function () { return resolveDelay_1(); }, Math.min(100 * retryCount, 5000));
                                        return [4 /*yield*/, delayPromise];
                                    case 4:
                                        _d.sent();
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        retryCount = 0;
                        _a.label = 1;
                    case 1:
                        if (!(retryCount < 5)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(retryCount)];
                    case 2:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _a.label = 3;
                    case 3:
                        ++retryCount;
                        return [3 /*break*/, 1];
                    case 4: throw new Error('Not available endpoint found');
                }
            });
        });
    };
    return GqlSender;
}());
exports.GqlSender = GqlSender;
//# sourceMappingURL=GqlSender.js.map