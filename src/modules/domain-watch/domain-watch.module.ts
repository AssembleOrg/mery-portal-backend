import { Module } from '@nestjs/common';
import { DomainWatchService } from './domain-watch.service';

@Module({ providers: [DomainWatchService] })
export class DomainWatchModule {}
