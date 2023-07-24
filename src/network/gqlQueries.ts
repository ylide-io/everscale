// export const getContractMessagesQuery = (dst: string, contractAddress: string, limit?: number) => `
// query {
// 	messages(
// 	  filter: {
// 		msg_type: { eq: 2 },
// 		dst: { eq: "${dst}" },
// 		src: { eq: "${contractAddress}" },
// 	  }
// 	  orderBy: [{path: "created_at", direction: DESC}]
// 	  ${limit ? `limit: ${limit}` : ''}
// 	) {
// 	  body
// 	  id
// 	  src
// 	  created_at
// 	  created_lt
// 	  dst
// 	}
//   }
// `;

export const getContractMessagesQuery = (
	dst: string | null,
	cursor: null | { type: 'before'; cursor: string } | { type: 'after'; cursor: string },
	contractAddress: string,
	limit?: number,
) => `
query {
	blockchain {
		account(address:"${contractAddress}") {
			messages(
				msg_type: [ExtOut],
				${dst ? `counterparties: ["${dst}"]` : ''}
				${cursor ? `${cursor.type}: "${cursor.cursor}"` : ''}
				${limit ? `${cursor ? (cursor.type === 'before' ? 'last' : 'first') : 'last'}: ${limit}` : ''}
			) {
				edges {
					node {
						body
						msg_type
						id
						src
						created_at
						created_lt
						dst
					}
					cursor
				}
			}
		}
	}
}
`;
