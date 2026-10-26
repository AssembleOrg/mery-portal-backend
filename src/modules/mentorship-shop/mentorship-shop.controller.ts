import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Public, Roles } from '../../shared/decorators';
import type { JwtPayload } from '../../shared/types';
import { UserRole } from '../../shared/types';
import { MentorshipShopService } from './mentorship-shop.service';
import {
  CreateOrderDto,
  CreatePackDto,
  GiftCreditDto,
  ListOrdersQueryDto,
  PromoDto,
  QuoteDto,
  ReviewOrderDto,
  ShopProductDto,
  UpdatePackDto,
} from './dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('mentorship-shop')
@ApiBearerAuth()
@Controller('mentorship/shop')
@UseGuards(JwtAuthGuard)
export class MentorshipShopController {
  constructor(private readonly shop: MentorshipShopService) {}

  // --------------------- Público / alumna ---------------------

  @Get('catalog')
  @Public()
  catalog() {
    return this.shop.catalog();
  }

  @Post('quote')
  @Public()
  quote(@Body() dto: QuoteDto) {
    return this.shop.quote(dto);
  }

  @Post('orders')
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.shop.createOrder(user.sub, dto);
  }

  @Get('orders/:id')
  myOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.shop.myOrder(user.sub, id);
  }

  @Post('orders/:id/pay')
  payOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.shop.payOrder(user.sub, id);
  }

  @Post('orders/:id/cancel')
  cancelOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.shop.cancelOrder(user.sub, id);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.shop.myShop(user.sub);
  }

  @Post('credits/:id/gift')
  gift(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GiftCreditDto,
  ) {
    return this.shop.giftCredit(user.sub, id, dto.email);
  }

  // --------------------- Admin ---------------------

  @Get('admin/products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  adminProducts() {
    return this.shop.listProductsAdmin();
  }

  @Patch('admin/products/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateProduct(@Param('id') id: string, @Body() dto: ShopProductDto) {
    return this.shop.updateProductShop(id, dto);
  }

  @Post('admin/images')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.shop.uploadImage(file);
  }

  @Get('admin/packs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listPacks() {
    return this.shop.listPacks();
  }

  @Post('admin/packs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createPack(@Body() dto: CreatePackDto) {
    return this.shop.createPack(dto);
  }

  @Patch('admin/packs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updatePack(@Param('id') id: string, @Body() dto: UpdatePackDto) {
    return this.shop.updatePack(id, dto);
  }

  @Delete('admin/packs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removePack(@Param('id') id: string) {
    return this.shop.removePack(id);
  }

  @Get('admin/promos')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listPromos() {
    return this.shop.listPromos();
  }

  @Post('admin/promos')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createPromo(@Body() dto: PromoDto) {
    return this.shop.createPromo(dto);
  }

  @Put('admin/promos/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updatePromo(@Param('id') id: string, @Body() dto: PromoDto) {
    return this.shop.updatePromo(id, dto);
  }

  @Delete('admin/promos/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removePromo(@Param('id') id: string) {
    return this.shop.removePromo(id);
  }

  // Validar pagos es tarea de administración: también la puede hacer SUBADMIN
  // (igual que otorgar créditos a mano).
  @Get('admin/orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  listOrders(@Query() q: ListOrdersQueryDto) {
    return this.shop.listOrders(q);
  }

  @Post('admin/orders/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  approveOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto,
  ) {
    return this.shop.approveOrder(id, user.sub, dto.note);
  }

  @Post('admin/orders/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  rejectOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto,
  ) {
    return this.shop.rejectOrder(id, user.sub, dto.note);
  }
}
