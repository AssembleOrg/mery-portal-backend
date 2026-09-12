import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards';
import { CurrentUser } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { NotificationsService } from './notifications.service';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.sub);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    return { unread: await this.service.unreadCount(user.sub) };
  }

  @Post('read-all')
  readAll(@CurrentUser() user: JwtPayload) {
    return this.service.markAllRead(user.sub);
  }

  @Post(':id/read')
  read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.markRead(user.sub, id);
  }

  // ----- Web Push (PWA) -----

  @Get('push/public-key')
  publicKey() {
    return this.service.publicKey();
  }

  @Post('push/subscribe')
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PushSubscribeDto,
    @Headers('user-agent') ua?: string,
  ) {
    return this.service.subscribePush(user.sub, dto, ua);
  }

  @Delete('push/subscribe')
  unsubscribe(@CurrentUser() user: JwtPayload, @Body() dto: PushUnsubscribeDto) {
    return this.service.unsubscribePush(user.sub, dto.endpoint);
  }
}
