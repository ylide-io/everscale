"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractMessagesQuery = void 0;
const getContractMessagesQuery = (dst, contractAddress) => `
query {
	messages(
	  filter: {
		msg_type: { eq: 2 },
		dst: { eq: "${dst}" },
		src: { eq: "${contractAddress}" },
	  }
	  orderBy: [{path: "created_at", direction: DESC}]
	) {
	  body
	  id
	  src
	  created_at
	  created_lt
	  dst
	}
  }
`;
exports.getContractMessagesQuery = getContractMessagesQuery;
//# sourceMappingURL=gqlQueries.js.map