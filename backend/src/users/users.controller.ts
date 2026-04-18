import { Controller, Get, Patch, Body, Param, Post, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { InviteUserDto } from './dto/invite-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user._id, dto);
  }

  @Get()
  @Roles('admin', 'manager')
  async listUsers() {
    return this.usersService.list();
  }

  @Patch(':id')
  @Roles('admin')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post('invite')
  @Roles('admin', 'manager')
  async inviteUser(@Body() dto: InviteUserDto) {
    return this.usersService.invite(dto);
  }

  @Delete(':id')
  @Roles('admin')
  async removeUser(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
