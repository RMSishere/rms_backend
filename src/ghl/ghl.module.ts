// src/ghl/ghl.module.ts
import { Module } from '@nestjs/common';
import { GHLService } from './ghl.service';

@Module({
  providers: [GHLService],
  exports: [GHLService],   // <-- IMPORTANT: make available to other modules
})
export class GHLModule {}
