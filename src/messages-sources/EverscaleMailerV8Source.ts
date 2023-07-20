import { NewGenericMessagesSource, ISourceSubject } from '@ylide/sdk';
import { EverscaleMailerV8Wrapper } from '../contract-wrappers/EverscaleMailerV8Wrapper';
import { EverscaleBlockchainController } from '../controllers';
import { ITVMMailerContractLink } from '../misc';

export class EverscaleMailerV8Source extends NewGenericMessagesSource {
	constructor(
		private readonly controller: EverscaleBlockchainController,
		private readonly mailer: ITVMMailerContractLink,
		private readonly wrapper: EverscaleMailerV8Wrapper,
		private readonly source: ISourceSubject,
	) {
		super(
			'EverscaleMailerV8Source',
			controller.compareMessagesTime.bind(controller),
			(fromMessage, toMessage, limit) =>
				wrapper.retrieveHistoryDesc(mailer, source, fromMessage, toMessage, limit),
			20000,
			50,
		);
	}
}
