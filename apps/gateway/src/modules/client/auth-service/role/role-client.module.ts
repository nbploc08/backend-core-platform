import { Module } from '@nestjs/common';
import { RoleClientService } from './role-client.service';
import { RoleClientController } from './role-client.controller';
import { InternalJwtModule } from '../../../share/internal-jwt/internal-jwt.module';

@Module({
  imports: [InternalJwtModule],
  providers: [RoleClientService],
  exports: [RoleClientService],
  controllers: [RoleClientController],
})
export class RoleClientModule {}
