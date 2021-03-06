export const getContractMessagesQuery = (dst: string, contractAddress: string) => `
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
