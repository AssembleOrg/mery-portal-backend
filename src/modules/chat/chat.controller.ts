import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Roles } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatEmailService } from './chat-email.service';
import { ListAdminRoomsDto, ListMessagesDto, SendMessageDto } from './dto';
import { ChatRoomStatus } from '@prisma/client';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
    private readonly email: ChatEmailService,
  ) {}

  // --------------------- Alumno ---------------------

  @Get('rooms')
  async myRooms(@CurrentUser() user: JwtPayload) {
    return this.chat.listStudentRooms(user.sub);
  }

  @Get('rooms/by-category/:categoryId')
  async myRoomForCategory(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId') categoryId: string,
  ) {
    const room = await this.chat.ensureRoom(user.sub, categoryId);
    const computed = await this.chat.computeStatus(user.sub, categoryId);
    return { room, computed };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN) {
      const total = await this.chat.getAdminUnreadTotal();
      return { total };
    }
    const total = await this.chat.getStudentUnreadTotal(user.sub);
    return { total };
  }

  @Get('rooms/:id/messages')
  async messages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() q: ListMessagesDto,
  ) {
    return this.chat.listMessages(id, user.sub, user.role, q);
  }

  @Post('rooms/:id/messages')
  async send(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const { message, firstStudentMessage, room } = await this.chat.sendMessage({
      roomId: id,
      senderId: user.sub,
      senderRole: user.role,
      content: dto.content,
      imageUrl: dto.imageUrl,
      imageKey: dto.imageKey,
    });
    this.gateway.broadcastNewMessage(message, room);
    if (firstStudentMessage) {
      await this.email.notifyAdminsOfNewConversation(room);
    }
    return message;
  }

  @Post('rooms/:id/read')
  async read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const result = await this.chat.markRead(id, user.sub, user.role);
    this.gateway.broadcastRead(id, user.role);
    return { read: result.count };
  }

  @Post('rooms/:id/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ) {
    return this.chat.uploadImage(id, user.sub, user.role, file);
  }

  // --------------------- Admin ---------------------

  @Get('admin/rooms')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async adminRooms(@Query() q: ListAdminRoomsDto) {
    return this.chat.listAdminRooms({
      categoryId: q.categoryId,
      search: q.search,
      status: q.status as ChatRoomStatus | undefined,
    });
  }
}
