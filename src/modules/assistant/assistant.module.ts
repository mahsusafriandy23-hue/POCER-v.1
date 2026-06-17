import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { OperatorAssistantController } from './operator-assistant.controller';
import { AssistantAdminService } from './assistant-admin.service';

@Module({
  imports: [IdentityModule],
  providers: [AssistantService, AssistantAdminService],
  controllers: [AssistantController, OperatorAssistantController],
})
export class AssistantModule {}
