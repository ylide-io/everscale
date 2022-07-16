"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractMessagesQuery = void 0;
var getContractMessagesQuery = function (dst, contractAddress) { return "\nquery {\n\tmessages(\n\t  filter: {\n\t\tmsg_type: { eq: 2 },\n\t\tdst: { eq: \"".concat(dst, "\" },\n\t\tsrc: { eq: \"").concat(contractAddress, "\" },\n\t  }\n\t  orderBy: [{path: \"created_at\", direction: DESC}]\n\t) {\n\t  body\n\t  id\n\t  src\n\t  created_at\n\t  created_lt\n\t  dst\n\t}\n  }\n"); };
exports.getContractMessagesQuery = getContractMessagesQuery;
//# sourceMappingURL=gqlQueries.js.map