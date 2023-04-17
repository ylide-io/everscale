import { GenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { EverscaleMailerV7Wrapper } from '../contract-wrappers/EverscaleMailerV7Wrapper';
import { EverscaleBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class EverscaleMailerV7Source extends GenericMessagesSource {
	constructor(
		private readonly controller: EverscaleBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: EverscaleMailerV7Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'EverscaleMailerV7Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, false, toMessage, false, limit),
			20000,
			50,
		);
	}
}