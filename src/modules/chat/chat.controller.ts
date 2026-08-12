import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { QuickRepliesService } from './quick-replies.service';
import { TranscriptionService } from './transcription.service';
import {
  CreateQuickReplyDto,
  ExtendRoomDto,
  ListAdminRoomsDto,
  ListMessagesDto,
  ListQuickRepliesDto,
  SendMessageDto,
  UpdateQuickReplyDto,
} from './dto';
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
    private readonly quickReplies: QuickRepliesService,
    private readonly transcription: TranscriptionService,
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
    return { room: await this.chat.serializeRoomAsync(room), computed };
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

  // --------------------- Bloqueo + vida del chat (admin) ---------------------

  @Post('admin/rooms/:id/block')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async blockRoom(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.chat.setBlocked({
      roomId: id,
      adminId: user.sub,
      adminRole: user.role,
      blocked: true,
    });
    if (result.changed) this.gateway.broadcastRoomUpdated(result.room);
    return result;
  }

  @Post('admin/rooms/:id/unblock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async unblockRoom(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.chat.setBlocked({
      roomId: id,
      adminId: user.sub,
      adminRole: user.role,
      blocked: false,
    });
    if (result.changed) this.gateway.broadcastRoomUpdated(result.room);
    return result;
  }

  @Post('admin/rooms/:id/extend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async extendRoom(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ExtendRoomDto,
  ) {
    const result = await this.chat.extendRoom({
      roomId: id,
      adminId: user.sub,
      adminRole: user.role,
      days: dto.days,
    });
    if (result.changed) this.gateway.broadcastRoomUpdated(result.room);
    return result;
  }

  // --------------------- Transcripción de audio (admin) ---------------------

  @Post('transcribe')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async transcribe(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 25 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ) {
    const text = await this.transcription.transcribe(file);
    return { text };
  }

  // --------------------- Respuestas rápidas (admin) ---------------------

  @Get('admin/quick-replies')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async listQuickReplies(@Query() q: ListQuickRepliesDto) {
    return this.quickReplies.list(q.search);
  }

  @Post('admin/quick-replies')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async createQuickReply(@Body() dto: CreateQuickReplyDto) {
    return this.quickReplies.create(dto);
  }

  @Patch('admin/quick-replies/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async updateQuickReply(
    @Param('id') id: string,
    @Body() dto: UpdateQuickReplyDto,
  ) {
    return this.quickReplies.update(id, dto);
  }

  @Delete('admin/quick-replies/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async deleteQuickReply(@Param('id') id: string) {
    return this.quickReplies.remove(id);
  }
}
