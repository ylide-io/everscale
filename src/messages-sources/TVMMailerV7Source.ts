import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { TVMMailerV7Wrapper } from '../contract-wrappers/TVMMailerV7Wrapper';
import { TVMBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class TVMMailerV7Source extends GenericMessagesSource {
	constructor(
		private readonly controller: TVMBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: TVMMailerV7Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'TVMMailerV7Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
