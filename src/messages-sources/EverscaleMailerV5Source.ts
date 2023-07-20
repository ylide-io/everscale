import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { EverscaleMailerV5Wrapper } from '../contract-wrappers/EverscaleMailerV5Wrapper';
import { EverscaleBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class EverscaleMailerV5Source extends GenericMessagesSource {
	constructor(
		private readonly controller: EverscaleBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: EverscaleMailerV5Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'EverscaleMailerV5Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
