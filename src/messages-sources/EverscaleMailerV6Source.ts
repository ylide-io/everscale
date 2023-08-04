import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { EverscaleMailerV6Wrapper } from '../contract-wrappers/EverscaleMailerV6Wrapper';
import { EverscaleBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class EverscaleMailerV6Source extends GenericMessagesSource {
	constructor(
		private readonly controller: EverscaleBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: EverscaleMailerV6Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'EverscaleMailerV6Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
