import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { TVMMailerV6Wrapper } from '../contract-wrappers/TVMMailerV6Wrapper';
import { TVMBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class TVMMailerV6Source extends GenericMessagesSource {
	constructor(
		private readonly controller: TVMBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: TVMMailerV6Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'TVMMailerV6Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
