import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { TVMMailerV5Wrapper } from '../contract-wrappers/TVMMailerV5Wrapper';
import { TVMBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class TVMMailerV5Source extends GenericMessagesSource {
	constructor(
		private readonly controller: TVMBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: TVMMailerV5Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'TVMMailerV5Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
