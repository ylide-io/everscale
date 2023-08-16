import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { TVMMailerV8Wrapper } from '../contract-wrappers/TVMMailerV8Wrapper';
import { TVMBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class TVMMailerV8Source extends GenericMessagesSource {
	constructor(
		private readonly controller: TVMBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: TVMMailerV8Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'TVMMailerV8Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
